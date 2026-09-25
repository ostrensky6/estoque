import { createClient, createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import { DownloadButton } from "@/components/common/DownloadButton";
import { HelpExample, HelpLegend, HelpTip } from "@/components/common/HelpTip";
import {
  LotesTable,
  SaldoTable,
  type LoteRow,
  type SaldoRow,
} from "@/components/estoque/EstoqueTables";

export const dynamic = "force-dynamic";

const LOTE_STATUS: Record<string, string> = {
  quarentena: "Quarentena",
  aceito: "Aceito",
  em_uso: "Em uso",
  bloqueado: "Bloqueado",
  consumido: "Consumido",
  descartado: "Descartado",
};

type Alerta = {
  tipo: string;
  insumo_id: number;
  especificacao: string | null;
  validade: string | null;
  valor: number | null;
  referencia: number | null;
};

type CustoEstoque = {
  insumo_id: number;
  especificacao: string | null;
  unidade: string | null;
  custo_padrao: number | null;
  custo_medio_ponderado: number | null;
  divergencia_percentual: number | null;
  situacao: string;
};

const ALERTA_META: Record<string, { label: string; cls: string }> = {
  reposicao: { label: "Repor", cls: "bg-warning-soft text-warning-strong" },
  vencimento: { label: "Vence em breve", cls: "bg-warning-soft text-warning-strong" },
  vencido: { label: "Vencido", cls: "bg-danger-soft text-danger-strong" },
  sem_validade: { label: "Sem validade", cls: "bg-danger-soft text-danger-strong" },
  quarentena: { label: "Quarentena", cls: "bg-info-soft text-info-strong" },
};

export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<{ entrada?: string | string[] }>;
}) {
  const query = await searchParams;
  const entrada = Array.isArray(query.entrada) ? query.entrada[0] : query.entrada;
  const entradaInicialInsumoId = /^\d+$/.test(entrada ?? "") ? Number(entrada) : undefined;
  const supabase = await createClient();
  const [
    { data: saldo },
    { data: alertas },
    { data: lotes },
    { data: previsao },
    { data: custos },
    { data: vinculosCompra, error: vinculosCompraError },
    { data: vinculosInternos, error: vinculosInternosError },
  ] = await Promise.all([
    supabase.from("v_estoque_saldo").select("*").order("especificacao"),
    supabase.from("v_alertas_estoque").select("*"),
    supabase
      .from("lotes_estoque")
      .select("id, insumo_id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumos(especificacao, unidade, categoria_compra)")
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
    supabase.from("v_previsao_suprimentos").select("*"),
    supabase.from("v_custo_estoque_vigente").select("*").order("especificacao"),
    supabase.from("pedidos_compra_item_recebimentos").select("lote_id"),
    supabase.from("pedidos_internos_item_recebimentos").select("lote_id"),
  ]);
  // modelo de contagem por lote (0109); tolerante enquanto o tipo gerado não tem a coluna
  const { data: modelos } = await (await createClientUntyped())
    .from("lotes_estoque")
    .select("id")
    .eq("modelo_quantidade", "EMBALAGEM_FECHADA")
    .gt("quantidade_atual", 0);
  const lotesEmbalagemFechada = new Set(((modelos ?? []) as { id: number }[]).map((m) => Number(m.id)));
  const [podeAceitar, podeGerir] = await Promise.all([
    temPapel("coordenador"),
    temPapel("gestor"),
  ]);

  const al = (alertas ?? []) as Alerta[];
  const porTipo = {
    reposicao: al.filter((a) => a.tipo === "reposicao"),
    vencimento: al.filter((a) => a.tipo === "vencimento"),
    vencido: al.filter((a) => a.tipo === "vencido"),
    sem_validade: al.filter((a) => a.tipo === "sem_validade"),
    quarentena: al.filter((a) => a.tipo === "quarentena"),
  };
  const previsaoMap = new Map((previsao ?? []).map((p) => [p.insumo_id, p]));
  const custosDivergentes = ((custos ?? []) as CustoEstoque[])
    .filter((custo) => custo.situacao === "divergente" || custo.situacao === "sem_custo_padrao")
    .sort((a, b) => Math.abs(Number(b.divergencia_percentual ?? 0)) - Math.abs(Number(a.divergencia_percentual ?? 0)));
  const origemEstornoComprovada = !vinculosCompraError && !vinculosInternosError;
  const lotesVinculados = new Set([
    ...(vinculosCompra ?? []).map((recebimento) => Number(recebimento.lote_id)),
    ...(vinculosInternos ?? []).map((recebimento) => Number(recebimento.lote_id)),
  ]);
  const insumosEmbalagemFechada = new Set(
    (lotes ?? []).filter((l) => lotesEmbalagemFechada.has(Number(l.id))).map((l) => Number(l.insumo_id)),
  );
  const saldoRows: SaldoRow[] = (saldo ?? []).map((s) => {
    const prev = previsaoMap.get(s.insumo_id);
    const pontoReposicao = Number(s.ponto_reposicao ?? 0);
    const disponivel = Number(s.disponivel ?? 0);
    const emMaos = Number(s.em_maos ?? 0);
    const pontoSugerido = Number(prev?.ponto_reposicao_sugerido ?? pontoReposicao);
    const repor = pontoReposicao > 0 && disponivel <= pontoReposicao;
    const semEstoque = emMaos <= 0;
    const status = repor ? "repor" : semEstoque ? "sem_estoque" : "ok";
    return {
      insumoId: s.insumo_id as number,
      embalagemFechada: insumosEmbalagemFechada.has(Number(s.insumo_id)),
      especificacao: s.especificacao ?? "—",
      unidade: s.unidade ?? "—",
      emMaos,
      emQuarentena: Number(s.em_quarentena ?? 0),
      reservado: Number(s.reservado ?? 0),
      disponivel,
      pontoReposicao,
      consumoMedioDiario: Number(prev?.consumo_medio_diario ?? 0),
      diasCobertura: prev?.dias_cobertura == null ? null : Number(prev.dias_cobertura),
      pontoSugerido,
      status,
      statusLabel: status === "repor" ? "Repor" : status === "sem_estoque" ? "Sem estoque" : "OK",
    };
  });
  const hoje = new Date();
  const loteRows: LoteRow[] = (lotes ?? []).map((l) => {
    const ins = l.insumos as { especificacao: string | null; unidade: string | null; categoria_compra: string | null } | null;
    const validadeEfetiva =
      l.validade && l.validade_apos_abertura
        ? l.validade <= l.validade_apos_abertura
          ? l.validade
          : l.validade_apos_abertura
        : l.validade ?? l.validade_apos_abertura;
    return {
      id: l.id as number,
      insumoId: Number(l.insumo_id),
      embalagemFechada: lotesEmbalagemFechada.has(Number(l.id)),
      especificacao: ins?.especificacao ?? "—",
      unidade: ins?.unidade ?? "",
      codigoLote: l.codigo_lote ?? "—",
      validade: validadeEfetiva ? formatDate(validadeEfetiva) : "—",
      quantidadeAtual: Number(l.quantidade_atual ?? 0),
      status: l.status,
      statusLabel: LOTE_STATUS[l.status] ?? l.status,
      vencido: validadeEfetiva != null && new Date(validadeEfetiva) < hoje,
      critico: ins?.categoria_compra === "critico",
      estornoDiretoPermitido:
        origemEstornoComprovada && !lotesVinculados.has(Number(l.id)),
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-1 text-xl font-semibold tracking-tight">
            Estoque
            <HelpTip title="Estoque">
              <p>
                Saldo de cada insumo, alertas de reposição e vencimento e os lotes guardados. O uso
                segue FEFO: o lote que vence antes sai antes.
              </p>
              <p>
                <b>+ Entrada</b> registra material recebido. <b>Saída</b> retira perda, quebra,
                vencido, descarte ou uso fora de plano.
              </p>
            </HelpTip>
          </h1>
          <DownloadButton href="/cadastros/insumos/export" fileName="insumos.xlsx">
            Planilha de insumos
          </DownloadButton>
        </div>

        {/* Alertas */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(["reposicao", "vencimento", "vencido", "sem_validade", "quarentena"] as const).map((t) => (
            <div
              key={t}
              className="rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ALERTA_META[t].cls}`}>
                  {ALERTA_META[t].label}
                </span>
                <span className="text-2xl font-semibold tabular-nums">{porTipo[t].length}</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                {porTipo[t].slice(0, 4).map((a, i) => (
                  <li key={i} className="truncate" title={a.especificacao ?? ""}>
                    {a.especificacao}
                    {a.validade ? ` · vence ${formatDate(a.validade)}` : ""}
                  </li>
                ))}
                {porTipo[t].length === 0 && <li className="text-muted-foreground/80">Nenhum</li>}
              </ul>
            </div>
          ))}
        </div>

        <section className="mt-8 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Custo de estoque vigente
                <HelpTip title="Custo de estoque vigente">
                  <p>
                    Compara o <b>custo padrão</b> do cadastro (usado nas simulações) com o{" "}
                    <b>custo médio</b> dos lotes liberados. Cada consumo guarda o custo real do lote.
                  </p>
                  <HelpExample>
                    Padrão R$ 100, lotes a R$ 120 → variação +20%: revise o custo padrão.
                  </HelpExample>
                </HelpTip>
              </h2>
            </div>
            <span className="text-sm tabular-nums text-warning-strong">{custosDivergentes.length} divergência(s)</span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Insumo</th>
                  <th className="px-2 py-2 text-right">Padrão</th>
                  <th className="px-2 py-2 text-right">Médio vigente</th>
                  <th className="px-2 py-2 text-right">Variação</th>
                  <th className="px-2 py-2 text-left">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {custosDivergentes.slice(0, 10).map((custo) => (
                  <tr key={custo.insumo_id}>
                    <td className="px-2 py-2 font-medium">{custo.especificacao ?? "—"} <span className="text-xs text-muted-foreground">{custo.unidade ?? ""}</span></td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(custo.custo_padrao)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(custo.custo_medio_ponderado)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-warning-strong">{custo.divergencia_percentual == null ? "—" : formatPercent(custo.divergencia_percentual)}</td>
                    <td className="px-2 py-2 text-xs text-warning-strong">{custo.situacao === "sem_custo_padrao" ? "Sem custo padrão" : "Divergente"}</td>
                  </tr>
                ))}
                {custosDivergentes.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-5 text-center text-muted-foreground">Custos vigentes alinhados ou sem lotes liberados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="mt-8">
          <SaldoTable
            rows={saldoRows}
            entradaInicialInsumoId={entradaInicialInsumoId}
            janelaDias={Number(previsao?.[0]?.janela_dias ?? 90)}
          />
        </div>


        {/* Lotes (rastreabilidade + estados) */}
        <h2 className="mt-10 flex items-center gap-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lotes em estoque
          <HelpTip title="Estados do lote">
            <HelpLegend
              items={[
                { tom: "atencao", rotulo: "Quarentena", texto: "recebido, aguardando conferência; ainda não pode ser usado" },
                { tom: "info", rotulo: "Aceito", texto: "liberado para uso" },
                { tom: "info", rotulo: "Em uso", texto: "embalagem aberta; vale a validade após abertura" },
                { tom: "critico", rotulo: "Bloqueado", texto: "retido (recall, não conformidade); não sai para uso" },
              ]}
            />
            <p>O uso segue FEFO: o lote que vence antes sai antes.</p>
          </HelpTip>
        </h2>
        <div className="mt-3">
          <LotesTable rows={loteRows} podeAceitar={podeAceitar} podeGerir={podeGerir} />
        </div>
      </main>
    </div>
  );
}
