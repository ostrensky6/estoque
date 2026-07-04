import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
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

const ALERTA_META: Record<string, { label: string; cls: string }> = {
  reposicao: { label: "Repor", cls: "bg-warning-soft text-warning-strong" },
  vencimento: { label: "Vence em breve", cls: "bg-warning-soft text-warning-strong" },
  vencido: { label: "Vencido", cls: "bg-danger-soft text-danger-strong" },
  sem_validade: { label: "Sem validade", cls: "bg-danger-soft text-danger-strong" },
  quarentena: { label: "Quarentena", cls: "bg-info-soft text-info-strong" },
};

export default async function EstoquePage() {
  const supabase = await createClient();
  const [{ data: saldo }, { data: alertas }, { data: lotes }, { data: previsao }] = await Promise.all([
    supabase.from("v_estoque_saldo").select("*").order("especificacao"),
    supabase.from("v_alertas_estoque").select("*"),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumos(especificacao, unidade)")
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
    supabase.from("v_previsao_suprimentos").select("*"),
  ]);
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
    const ins = l.insumos as { especificacao: string | null; unidade: string | null } | null;
    const validadeEfetiva =
      l.validade && l.validade_apos_abertura
        ? l.validade <= l.validade_apos_abertura
          ? l.validade
          : l.validade_apos_abertura
        : l.validade ?? l.validade_apos_abertura;
    return {
      id: l.id as number,
      especificacao: ins?.especificacao ?? "—",
      unidade: ins?.unidade ?? "",
      codigoLote: l.codigo_lote ?? "—",
      validade: validadeEfetiva ?? "—",
      quantidadeAtual: Number(l.quantidade_atual ?? 0),
      status: l.status,
      statusLabel: LOTE_STATUS[l.status] ?? l.status,
      vencido: validadeEfetiva != null && new Date(validadeEfetiva) < hoje,
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <h1 className="text-xl font-semibold tracking-tight">Estoque</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Saldo por reagente (em mãos · reservado · disponível) e alertas de
          reposição e vencimento. Lotes consumidos por FEFO.
        </p>

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
                    {a.validade ? ` · vence ${a.validade}` : ""}
                  </li>
                ))}
                {porTipo[t].length === 0 && <li className="text-muted-foreground/80">Nenhum</li>}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8">
          <SaldoTable rows={saldoRows} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground/80">
          {saldoRows.length} reagentes · previsão usa consumo dos últimos{" "}
          {previsao?.[0]?.janela_dias ?? 90} dias, lead time e estoque de segurança.
          Ajuste o ponto manual em Cadastros → Insumos quando precisar travar uma política.
        </p>

        {/* Lotes (rastreabilidade + estados) */}
        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Lotes em estoque
        </h2>
        <p className="mt-1 text-xs text-muted-foreground/80">
          Material recebido entra em <b>quarentena</b> e só fica disponível após
          aceitação. Consumo por FEFO (vence antes, sai antes).
        </p>
        <div className="mt-3">
          <LotesTable rows={loteRows} podeAceitar={podeAceitar} podeGerir={podeGerir} />
        </div>
      </main>
    </div>
  );
}
