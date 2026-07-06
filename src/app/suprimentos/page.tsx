import Link from "next/link";
import { createClient, createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { GerarReposicaoButton } from "@/components/compras/GerarReposicaoButton";
import { formatDate, formatNumber as fmt } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type LoteOperacional = {
  id: number;
  codigo_lote: string | null;
  validade: string | null;
  validade_apos_abertura: string | null;
  quantidade_atual: number | null;
  status: string;
  insumos: { especificacao: string | null; unidade: string | null } | { especificacao: string | null; unidade: string | null }[] | null;
};

type CompraAberta = {
  id: number;
  status: string;
  data_solicitacao: string | null;
  data_prevista_entrega: string | null;
  fornecedores: { nome: string | null } | { nome: string | null }[] | null;
};

type InsumoCadastro = {
  id: number;
  especificacao: string | null;
  fator_conversao: number | null;
  quantidade_embalagem: number | null;
  categoria_compra: string | null;
  unidade: string | null;
  unidade_consumo: string | null;
};

type FilaHojeItem = {
  key: string;
  prioridade: "critica" | "alta" | "media";
  tipo: string;
  item: string;
  problema: string;
  proximaAcao: string;
  href: string;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function validadeEfetiva(lote: Pick<LoteOperacional, "validade" | "validade_apos_abertura">) {
  if (lote.validade && lote.validade_apos_abertura) {
    return lote.validade <= lote.validade_apos_abertura ? lote.validade : lote.validade_apos_abertura;
  }
  return lote.validade ?? lote.validade_apos_abertura;
}

function pendenciasInsumo(row: InsumoCadastro) {
  const pendencias: string[] = [];
  const fator = Number(row.fator_conversao);
  const quantidadeEmbalagem = Number(row.quantidade_embalagem);

  if (!Number.isFinite(fator) || fator <= 0) pendencias.push("fator de conversão");
  if (!Number.isFinite(quantidadeEmbalagem) || quantidadeEmbalagem <= 0) pendencias.push("quantidade da embalagem");
  if (!row.categoria_compra) pendencias.push("categoria de compra");
  if (!row.unidade) pendencias.push("unidade de estoque");
  if (!row.unidade_consumo) pendencias.push("unidade de consumo");

  return pendencias;
}

function prioridadeCompra(status: string, dataPrevista: string | null) {
  if (!dataPrevista) return 0;
  const hoje = new Date().toISOString().slice(0, 10);
  return dataPrevista < hoje && status !== "recebido" && status !== "cancelado" ? 1 : 0;
}

function adicionarDias(data: string, dias: number) {
  const base = new Date(`${data}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

function prioridadeTone(prioridade: FilaHojeItem["prioridade"]) {
  return prioridade === "critica" ? "red" : prioridade === "alta" ? "amber" : "blue";
}

function prioridadeLabel(prioridade: FilaHojeItem["prioridade"]) {
  return prioridade === "critica" ? "Crítica" : prioridade === "alta" ? "Alta" : "Média";
}

function StatusPill({ children, tone = "zinc" }: { children: React.ReactNode; tone?: "red" | "amber" | "blue" | "brand" | "zinc" }) {
  const cls = {
    red: "bg-danger-soft text-danger-strong",
    amber: "bg-warning-soft text-warning-strong",
    blue: "bg-info-soft text-info-strong",
    brand: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
    zinc: "bg-muted text-foreground",
  }[tone];

  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

function KpiCard({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  tone: "red" | "amber" | "blue" | "brand";
}) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 shadow-sm hover:border-brand-300">
      <div className="flex items-center justify-between gap-3">
        <StatusPill tone={tone}>{label}</StatusPill>
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </Link>
  );
}

function Section({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-input px-4 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export default async function SuprimentosPage() {
  const supabase = await createClient();
  const supabaseUntyped = await createClientUntyped();
  const hoje = new Date().toISOString().slice(0, 10);
  const podeGerarReposicao = await temPapel("coordenador");

  const [
    { data: previsao },
    { data: lotes },
    { data: compras },
    { data: insumos },
  ] = await Promise.all([
    supabase.from("v_previsao_suprimentos").select("*").order("qtd_sugerida_compra", { ascending: false }),
    supabase
      .from("lotes_estoque")
      .select("id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status, insumos(especificacao, unidade)")
      .gt("quantidade_atual", 0)
      .not("status", "in", "(consumido,descartado)")
      .order("validade", { nullsFirst: false }),
    supabase
      .from("pedidos_compra")
      .select("id, status, data_solicitacao, data_prevista_entrega, fornecedores(nome)")
      .in("status", ["solicitado", "aprovado", "enviado", "em_transito"])
      .order("data_prevista_entrega", { ascending: true, nullsFirst: false }),
    supabaseUntyped
      .from("insumos")
      .select("id, especificacao, fator_conversao, quantidade_embalagem, categoria_compra, unidade, unidade_consumo")
      .order("especificacao"),
  ]);

  const limiteVencimento = adicionarDias(hoje, 30);
  const previsoes = previsao ?? [];
  const rupturas = previsoes.filter((item) => Number(item.disponivel ?? 0) <= 0);
  const abaixoReposicao = previsoes.filter((item) => {
    const disponivel = Number(item.disponivel ?? 0);
    const ponto = Number(item.ponto_reposicao_configurado ?? item.ponto_reposicao_sugerido ?? 0);
    return ponto > 0 && disponivel > 0 && disponivel <= ponto;
  });
  const comprasAbertas = ((compras ?? []) as CompraAberta[])
    .map((compra) => ({
      ...compra,
      fornecedorNome: asOne(compra.fornecedores)?.nome ?? "Fornecedor não informado",
      atrasada: prioridadeCompra(compra.status, compra.data_prevista_entrega) > 0,
    }))
    .sort((a, b) => Number(b.atrasada) - Number(a.atrasada));
  const comprasAtrasadas = comprasAbertas.filter((compra) => compra.atrasada);
  const comprasAguardandoRecebimento = comprasAbertas.filter((compra) => ["aprovado", "enviado", "em_transito"].includes(compra.status));
  const lotesOperacionais = (lotes ?? []) as LoteOperacional[];
  const lotesVencidos = lotesOperacionais.filter((lote) => {
    const validade = validadeEfetiva(lote);
    return validade != null && validade < hoje;
  });
  const lotesVencendo = lotesOperacionais.filter((lote) => {
    const validade = validadeEfetiva(lote);
    return validade != null && validade >= hoje && validade <= limiteVencimento;
  });
  const lotesQuarentena = lotesOperacionais.filter((lote) => lote.status === "quarentena");
  const cadastrosCriticosPendentes = ((insumos ?? []) as InsumoCadastro[])
    .map((insumo) => ({ ...insumo, pendencias: pendenciasInsumo(insumo) }))
    .filter((insumo) => insumo.categoria_compra === "critico" && insumo.pendencias.length > 0);

  const filaHoje: FilaHojeItem[] = [
    ...rupturas.map((item) => ({
      key: `ruptura-${item.insumo_id}`,
      prioridade: "critica" as const,
      tipo: "Ruptura",
      item: item.especificacao ?? `Insumo #${item.insumo_id}`,
      problema: `Saldo utilizável ${fmt(item.disponivel)} ${item.unidade ?? ""}`,
      proximaAcao: Number(item.qtd_pedida_aberta ?? 0) > 0 ? "Acompanhar compra aberta" : "Abrir compra formal",
      href: "/compras",
    })),
    ...comprasAtrasadas.map((compra) => ({
      key: `compra-atrasada-${compra.id}`,
      prioridade: "alta" as const,
      tipo: "Compra atrasada",
      item: `Compra formal #${compra.id}`,
      problema: `${compra.fornecedorNome} · previsão ${formatDate(compra.data_prevista_entrega)}`,
      proximaAcao: "Acompanhar fornecedor",
      href: `/compras/${compra.id}`,
    })),
    ...comprasAguardandoRecebimento.filter((compra) => !compra.atrasada).map((compra) => ({
      key: `receber-${compra.id}`,
      prioridade: "media" as const,
      tipo: "Recebimento",
      item: `Compra formal #${compra.id}`,
      problema: `${compra.status} · ${compra.fornecedorNome}`,
      proximaAcao: "Receber pela compra formal",
      href: `/compras/${compra.id}`,
    })),
    ...lotesVencidos.map((lote) => ({
      key: `lote-vencido-${lote.id}`,
      prioridade: "critica" as const,
      tipo: "Lote vencido",
      item: asOne(lote.insumos)?.especificacao ?? `Lote #${lote.id}`,
      problema: `Lote ${lote.codigo_lote ?? lote.id} · venceu ${formatDate(validadeEfetiva(lote))}`,
      proximaAcao: "Revisar, bloquear ou descartar",
      href: `/estoque/lotes/${lote.id}`,
    })),
    ...lotesQuarentena
      .filter((lote) => !lotesVencidos.some((vencido) => vencido.id === lote.id))
      .map((lote) => ({
        key: `quarentena-${lote.id}`,
        prioridade: "media" as const,
        tipo: "Liberação",
        item: asOne(lote.insumos)?.especificacao ?? `Lote #${lote.id}`,
        problema: `Lote ${lote.codigo_lote ?? lote.id} aguardando conferência`,
        proximaAcao: "Liberar lote para uso",
        href: `/estoque/lotes/${lote.id}`,
      })),
    ...cadastrosCriticosPendentes.map((insumo) => ({
      key: `cadastro-critico-${insumo.id}`,
      prioridade: "alta" as const,
      tipo: "Cadastro crítico",
      item: insumo.especificacao ?? `Insumo #${insumo.id}`,
      problema: insumo.pendencias.join(", "),
      proximaAcao: "Completar cadastro",
      href: "/cadastros/insumos",
    })),
    ...abaixoReposicao.slice(0, 6).map((item) => ({
      key: `reposicao-${item.insumo_id}`,
      prioridade: "media" as const,
      tipo: "Reposição",
      item: item.especificacao ?? `Insumo #${item.insumo_id}`,
      problema: `Disponível ${fmt(item.disponivel)} · comprar ${fmt(item.qtd_sugerida_compra)}`,
      proximaAcao: "Revisar compra formal",
      href: "/compras",
    })),
    ...lotesVencendo.slice(0, 4).map((lote) => ({
      key: `vencendo-${lote.id}`,
      prioridade: "media" as const,
      tipo: "Validade",
      item: asOne(lote.insumos)?.especificacao ?? `Lote #${lote.id}`,
      problema: `Vence ${formatDate(validadeEfetiva(lote))}`,
      proximaAcao: "Revisar FEFO",
      href: `/estoque/lotes/${lote.id}`,
    })),
  ].slice(0, 15);

  const critico = rupturas.length + comprasAtrasadas.length + lotesVencidos.length + cadastrosCriticosPendentes.length;
  const comprar = rupturas.length + abaixoReposicao.length;
  const receber = comprasAguardandoRecebimento.length;
  const liberar = lotesQuarentena.length;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Suprimentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Central compacta de exceções para decidir o que precisa de atenção hoje.
              O detalhe operacional continua nas telas próprias de solicitação, compra, recebimento e estoque.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {podeGerarReposicao && <GerarReposicaoButton />}
            <Link href="#hoje" className="rounded-md border border-border px-3 py-1.5 hover:bg-muted/50">Hoje</Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Crítico" value={critico} detail="ruptura, atraso, vencido ou cadastro crítico" href="#hoje" tone={critico > 0 ? "red" : "brand"} />
          <KpiCard label="Comprar" value={comprar} detail="ruptura ou reposição recomendada" href="/compras" tone={rupturas.length > 0 ? "red" : comprar > 0 ? "amber" : "brand"} />
          <KpiCard label="Receber" value={receber} detail="compras aguardando chegada" href="/recebimento" tone={receber > 0 ? "blue" : "brand"} />
          <KpiCard label="Liberar" value={liberar} detail="lotes aguardando conferência" href="/estoque" tone={liberar > 0 ? "blue" : "brand"} />
        </div>

        <Section id="hoje" title="Hoje" action={<span className="text-sm text-muted-foreground">{filaHoje.length} ação(ões)</span>}>
          {filaHoje.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Prioridade</th>
                    <th className="px-4 py-3 text-left">Tipo</th>
                    <th className="px-4 py-3 text-left">Item/processo</th>
                    <th className="px-4 py-3 text-left">Problema</th>
                    <th className="px-4 py-3 text-right">Próxima ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {filaHoje.map((acao) => (
                    <tr key={acao.key}>
                      <td className="px-4 py-3">
                        <StatusPill tone={prioridadeTone(acao.prioridade)}>{prioridadeLabel(acao.prioridade)}</StatusPill>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{acao.tipo}</td>
                      <td className="max-w-xs truncate px-4 py-3 font-medium" title={acao.item}>{acao.item}</td>
                      <td className="max-w-sm truncate px-4 py-3 text-muted-foreground" title={acao.problema}>{acao.problema}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={acao.href} className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                          {acao.proximaAcao}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Nenhuma exceção operacional prioritária para hoje.</EmptyState>
          )}
        </Section>

        <Section
          id="cadastros"
          title="Cadastros críticos"
          action={<Link href="/cadastros/insumos" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">Abrir insumos</Link>}
        >
          {cadastrosCriticosPendentes.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Insumo</th>
                    <th className="px-4 py-3 text-left">Pendências</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {cadastrosCriticosPendentes.slice(0, 10).map((insumo) => (
                    <tr key={insumo.id}>
                      <td className="max-w-xs truncate px-4 py-3 font-medium" title={insumo.especificacao ?? undefined}>
                        {insumo.especificacao ?? `Insumo #${insumo.id}`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{insumo.pendencias.join(", ")}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href="/cadastros/insumos" className="font-medium text-brand-700 hover:underline dark:text-brand-300">
                          Completar cadastro
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>Nenhum insumo crítico com cadastro operacional incompleto.</EmptyState>
          )}
        </Section>
      </main>
    </div>
  );
}
