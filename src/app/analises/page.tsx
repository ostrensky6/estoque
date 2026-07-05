import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";
import { calcularTodas } from "@/lib/costing/loader";
import { formatCurrency, formatNumber } from "@/lib/formatters";

export const dynamic = "force-dynamic";

type AnaliseCatalogo = {
  codigo: string;
  nome: string | null;
  nome_simplificado: string | null;
  descricao: string | null;
  status: string | null;
  ativo: boolean;
  ofertavel: boolean;
};

type DiagnosticoAnalise = {
  analise: AnaliseCatalogo;
  nEtapas: number;
  nInsumos: number;
  nEquipamentos: number;
  tempoBancada: number;
  amostrasDia: number;
  preco: number | null;
  avisos: string[];
};

type ConsultaIssue = {
  tabela: string;
  mensagem: string;
};

const card =
  "rounded-lg border border-border bg-card p-4 shadow-sm";
const subtle = "text-sm text-muted-foreground";

function statusTextualIndicaRevisao(status: string | null) {
  return /experimental|experimento|revis|avali|pend|todo/i.test(status ?? "");
}

function grupoDaAnalise(analise: AnaliseCatalogo) {
  if (!analise.ativo) return "inativas";
  if (statusTextualIndicaRevisao(analise.status)) return "revisao";
  return analise.ofertavel ? "ofertaveis" : "ativas_nao_ofertaveis";
}

function rotuloPrincipal(analise: AnaliseCatalogo) {
  return analise.nome_simplificado || analise.nome || analise.codigo;
}

function badgeAtivo(ativo: boolean) {
  return ativo
    ? "bg-success-soft text-success-strong ring-success-strong/30"
    : "bg-muted text-muted-foreground ring-border";
}

function erroConsulta(tabela: string, error: { message?: string | null; code?: string | null } | null) {
  if (!error) return null;
  return {
    tabela,
    mensagem: [error.code, error.message].filter(Boolean).join(" - ") || "Falha ao consultar dados.",
  };
}

export default async function AnalisesPage({
  searchParams,
}: {
  searchParams: Promise<{ codigo?: string }>;
}) {
  const { codigo: codigoSelecionado } = await searchParams;
  const supabase = await createClient();
  const [
    analisesResult,
    etapasResult,
    insumosAnaliseResult,
    equipamentosAnaliseResult,
  ] =
    await Promise.all([
      supabase
        .from("analises")
        .select("codigo, nome, nome_simplificado, descricao, status, ativo, ofertavel")
        .order("codigo"),
      supabase.from("etapas").select("*"),
      supabase
        .from("insumo_analise")
        .select("codigo_analise, insumo_id, quantidade_por_amostra, especificacao_insumo"),
      supabase.from("equipamento_analise").select("codigo_analise, equipamento_id"),
    ]);

  const consultaIssues = [
    erroConsulta("analises", analisesResult.error),
    erroConsulta("etapas", etapasResult.error),
    erroConsulta("insumo_analise", insumosAnaliseResult.error),
    erroConsulta("equipamento_analise", equipamentosAnaliseResult.error),
  ].filter((issue): issue is ConsultaIssue => issue != null);

  const analises = analisesResult.data;
  const etapas = etapasResult.data;
  const insumosAnalise = insumosAnaliseResult.data;
  const equipamentosAnalise = equipamentosAnaliseResult.data;

  let custos = new Map<string, number>();
  let erroCusteio = false;
  try {
    const { breakdowns } = await calcularTodas();
    custos = new Map(breakdowns.map((b) => [b.codigo, b.preco]));
  } catch {
    erroCusteio = true;
    custos = new Map();
  }

  const diagnosticos: DiagnosticoAnalise[] = ((analises ?? []) as AnaliseCatalogo[]).map((analise) => {
    const etapasDaAnalise = ((etapas ?? []) as Etapa[]).filter(
      (etapa) => (etapa as unknown as { codigo_analise: string }).codigo_analise === analise.codigo,
    );
    const insumosDaAnalise = (insumosAnalise ?? []).filter((linha) => linha.codigo_analise === analise.codigo);
    const equipamentosDaAnalise = (equipamentosAnalise ?? []).filter((linha) => linha.codigo_analise === analise.codigo);
    const g = gargalo(etapasDaAnalise);
    const avisos: string[] = [];

    if (etapasDaAnalise.length === 0) avisos.push("sem etapas");
    if (insumosDaAnalise.length === 0) avisos.push("sem materiais/insumos");
    if (equipamentosDaAnalise.length === 0) avisos.push("sem equipamentos");
    if (insumosDaAnalise.some((linha) => Number(linha.quantidade_por_amostra ?? 0) > 0 && !linha.insumo_id)) {
      avisos.push("material consumido sem vínculo com insumo de estoque");
    }
    if (analise.ativo && statusTextualIndicaRevisao(analise.status)) {
      avisos.push("ativa com status textual de revisão");
    }
    if (analise.ativo && !analise.ofertavel) avisos.push("ativa, mas fora da oferta comercial");
    if (analise.ativo && (custos.get(analise.codigo) ?? 0) <= 0) avisos.push("sem preço calculado");

    return {
      analise,
      nEtapas: etapasDaAnalise.length,
      nInsumos: insumosDaAnalise.length,
      nEquipamentos: equipamentosDaAnalise.length,
      tempoBancada: horasBancadaPorAmostra(etapasDaAnalise),
      amostrasDia: g.amostrasDia,
      preco: custos.get(analise.codigo) ?? null,
      avisos,
    };
  });

  const totalOfertaveis = diagnosticos.filter((item) => item.analise.ativo && item.analise.ofertavel);
  const ofertaveisEmRevisao = diagnosticos.filter(
    (item) => item.analise.ativo && item.analise.ofertavel && statusTextualIndicaRevisao(item.analise.status),
  );
  const ativasNaoOfertaveis = diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "ativas_nao_ofertaveis");
  const inativas = diagnosticos.filter((item) => grupoDaAnalise(item.analise) === "inativas");
  const selecionada =
    diagnosticos.find((item) => item.analise.codigo === codigoSelecionado) ??
    diagnosticos.find((item) => item.analise.ativo && item.analise.ofertavel) ??
    diagnosticos[0];

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold tracking-tight">Análises</h1>
          <p className={`mt-2 ${subtle}`}>
            Gerencie a receita técnica de uma análise por vez: etapas, materiais, equipamentos, capacidade e custeio.
          </p>
        </div>

        {consultaIssues.length > 0 && <ConsultaAlert issues={consultaIssues} />}

        {erroCusteio && (
          <div className="mt-4 rounded-lg border border-warning-strong/30 bg-warning-soft p-4 text-sm text-warning-strong">
            <p className="font-medium">Custeio indisponível</p>
            <p className="mt-1">As análises foram carregadas, mas o preço calculado não pôde ser obtido agora.</p>
          </div>
        )}

        {diagnosticos.length > 0 ? (
          <form action="/analises" className={`${card} mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]`}>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Análise</span>
              <select
                name="codigo"
                defaultValue={selecionada?.analise.codigo}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
              >
                {diagnosticos.map((item) => (
                  <option key={item.analise.codigo} value={item.analise.codigo}>
                    {item.analise.codigo} · {rotuloPrincipal(item.analise)}
                  </option>
                ))}
              </select>
            </label>
            <button className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
              Abrir
            </button>
          </form>
        ) : (
          <EmptyAnalises />
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Stat label="Ofertáveis totais" value={String(totalOfertaveis.length)} />
          <Stat label="Ofertáveis em revisão" value={String(ofertaveisEmRevisao.length)} />
          <Stat label="Ativas não ofertáveis" value={String(ativasNaoOfertaveis.length)} />
          <Stat label="Inativas" value={String(inativas.length)} />
        </div>

        {selecionada ? <AnaliseSelecionada item={selecionada} /> : null}
      </main>
    </div>
  );
}

function ConsultaAlert({ issues }: { issues: ConsultaIssue[] }) {
  return (
    <section className="mt-6 rounded-lg border border-danger-strong/30 bg-danger-soft p-4 text-sm text-danger-strong">
      <p className="font-medium">Falha ao carregar dados de análises</p>
      <p className="mt-1">
        Algumas consultas ao Supabase não retornaram corretamente. Nenhum dado sensível foi exibido.
      </p>
      <ul className="mt-3 space-y-1">
        {issues.map((issue) => (
          <li key={issue.tabela}>
            <span className="font-mono text-xs">{issue.tabela}</span>: {issue.mensagem}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyAnalises() {
  return (
    <section className={`${card} mt-6`}>
      <p className="font-medium">Nenhuma análise cadastrada.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        O módulo está acessível, mas o catálogo técnico não retornou registros para seleção.
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AnaliseSelecionada({ item }: { item: DiagnosticoAnalise }) {
  const { analise } = item;
  return (
    <section className={`${card} mt-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium text-muted-foreground">{analise.codigo}</p>
          <h2 className="mt-1 text-xl font-semibold">{rotuloPrincipal(analise)}</h2>
          {analise.descricao && <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{analise.descricao}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${badgeAtivo(analise.ativo)}`}>
            {analise.ativo ? "Ativa" : "Inativa"}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${analise.ofertavel ? "bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900" : "bg-muted text-muted-foreground ring-border"}`}>
            {analise.ofertavel ? "Ofertável" : "Não ofertável"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Mini label="Etapas" value={String(item.nEtapas)} />
        <Mini label="Insumos" value={String(item.nInsumos)} />
        <Mini label="Equipamentos" value={String(item.nEquipamentos)} />
        <Mini label="Capacidade" value={item.amostrasDia > 0 ? `${formatNumber(item.amostrasDia)}/dia` : "-"} />
        <Mini label="Preço" value={item.preco != null && item.preco > 0 ? formatCurrency(item.preco) : "-"} />
      </div>

      {item.avisos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {item.avisos.map((aviso) => (
            <span key={aviso} className="rounded-full bg-warning-soft px-2 py-1 text-xs text-warning-strong">
              {aviso}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/analises/${encodeURIComponent(analise.codigo)}`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
          Gerenciar ficha técnica
        </Link>
        <Link href={`/insumos?analise=${encodeURIComponent(analise.codigo)}`} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted/50">
          Insumos da análise
        </Link>
        <Link href="/custeio" className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted/50">
          Ver custeio
        </Link>
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium tabular-nums">{value}</p>
    </div>
  );
}
