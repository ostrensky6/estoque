import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OrcamentosTable, type OrcamentoRow } from "@/components/orcamento/OrcamentosTable";
import { calcularOrcamentoProjetoLegacy, itemProjetoTotal } from "@/lib/project-budget/legacy";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  aprovado: { label: "Aprovado", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

const TIPO = {
  analises: "Só análises",
  projeto: "Só projeto",
  analises_projeto: "Análises + projeto",
} as const;

type ItemAnalise = { n_amostras: number; custo_unitario?: number; preco_unitario: number };
type CustoProjeto = {
  rubrica: string | null;
  quantidade: number;
  custo_unitario?: number;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};

type Linha = {
  key: string;
  href: string;
  titulo: string;
  cliente: string;
  projeto: string;
  data: string;
  tipo: keyof typeof TIPO;
  analises: number;
  custosProjeto: number;
  total: number;
  status: string;
  statusLabel: string;
  criadoEm: string;
};

const MODALIDADE_TIPO: Record<string, keyof typeof TIPO> = {
  analises: "analises",
  projeto: "projeto",
  analises_projeto: "analises_projeto",
  projeto_analises_custos: "analises_projeto",
};

export default async function OrcamentosPage() {
  const supabase = await createClient();
  const [{ data: orcamentos }, { data: orcProjetos }, { data: projetos }, { data: demandas }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select(
        "id, tipo, cliente_nome, data_orcamento, status, criado_em, projeto_id, orcamento_itens(n_amostras, preco_unitario)",
      )
      .order("criado_em", { ascending: false }),
    supabase
      .from("orcamento_projetos")
      .select(
        "id, demanda_id, titulo, cliente_nome, data_orcamento, status, projeto_id, margem_lucro, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, criado_em, orcamento_projeto_analises(n_amostras, custo_unitario, preco_unitario), orcamento_projeto_custos(rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase.from("demandas_propostas").select("id, modalidade"),
  ]);

  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const modalidadePorDemanda = new Map((demandas ?? []).map((d) => [d.id, d.modalidade]));
  const linhasAnalises: Linha[] = (orcamentos ?? []).map((o) => {
    const itens = (o.orcamento_itens as ItemAnalise[]) ?? [];
    const total = itens.reduce((a, it) => a + Number(it.preco_unitario) * Number(it.n_amostras), 0);
    return {
      key: `analises-${o.id}`,
      href: `/orcamento/${o.id}`,
      titulo: `Orçamento ${o.id}`,
      cliente: o.cliente_nome ?? "Cliente sem nome",
      projeto: o.projeto_id != null ? projetoNome.get(o.projeto_id) ?? "—" : "—",
      data: o.data_orcamento ?? "—",
      tipo: (o.tipo ?? "analises") as keyof typeof TIPO,
      analises: itens.length,
      custosProjeto: 0,
      total,
      status: o.status,
      statusLabel: STATUS[o.status]?.label ?? o.status,
      criadoEm: o.criado_em,
    };
  });

  const linhasProjeto: Linha[] = (orcProjetos ?? []).map((o) => {
    const analises = ((o.orcamento_projeto_analises as ItemAnalise[]) ?? []).map((it) => ({
      rubrica: "MC",
      quantidade: Number(it.n_amostras),
      preco_unitario: Number(it.custo_unitario ?? it.preco_unitario ?? 0),
      meses_selecionados: [],
    }));
    const custos = (((o.orcamento_projeto_custos as CustoProjeto[]) ?? [])).map((it) => ({
      ...it,
      preco_unitario: Number(it.custo_unitario ?? it.preco_unitario ?? 0),
    }));
    const calculo = calcularOrcamentoProjetoLegacy([...analises, ...custos], {
      impostos_legacy: Number(o.impostos_legacy ?? o.impostos ?? 0),
      incubacao: Number(o.incubacao ?? 0),
      reserva: Number(o.reserva ?? 0),
      investimentos: Number(o.investimentos ?? 0),
      lucro: Number(o.lucro ?? o.margem_lucro ?? 0),
    });
    const temAnalises = analises.length > 0;
    const temCustosProjeto = custos.length > 0;
    const tipoDaDemanda = o.demanda_id != null ? MODALIDADE_TIPO[modalidadePorDemanda.get(o.demanda_id) ?? ""] : undefined;
    const tipo = tipoDaDemanda ?? (temAnalises && temCustosProjeto ? "analises_projeto" : temAnalises ? "analises_projeto" : "projeto");
    return {
      key: `projeto-${o.id}`,
      href: `/orcamento/projetos/${o.id}`,
      titulo: o.titulo ?? `Projeto ${o.id}`,
      cliente: o.cliente_nome ?? "Cliente sem nome",
      projeto: o.projeto_id != null ? projetoNome.get(o.projeto_id) ?? "—" : "—",
      data: o.data_orcamento ?? "—",
      tipo,
      analises: analises.length,
      custosProjeto: custos.reduce((a, it) => a + itemProjetoTotal(it), 0),
      total: calculo.grossTotal,
      status: o.status,
      statusLabel: STATUS[o.status]?.label ?? o.status,
      criadoEm: o.criado_em,
    };
  });

  const linhas: OrcamentoRow[] = [...linhasAnalises, ...linhasProjeto].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime(),
  ).map((linha) => ({
    key: linha.key,
    href: linha.href,
    titulo: linha.titulo,
    cliente: linha.cliente,
    projeto: linha.projeto,
    data: linha.data,
    tipo: linha.tipo,
    tipoLabel: TIPO[linha.tipo],
    analises: linha.analises,
    custosProjeto: linha.custosProjeto,
    total: linha.total,
    status: linha.status,
    statusLabel: linha.statusLabel,
  }));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Histórico operacional de orçamentos laboratoriais, de projeto e consolidados. Novos orçamentos começam pela demanda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/orcamento/historico" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Histórico de Orçamentos
            </Link>
            <Link href="/orcamento/demandas" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
              Nova demanda
            </Link>
            <Link href="/orcamento/parametros" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Parâmetros econômicos
            </Link>
          </div>
        </div>

        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-3 md:grid-cols-4">
            <Etapa titulo="1. Demanda" faltante={0} detalhe="Entrada obrigatória" />
            <Etapa titulo="2. Custos" faltante={0} detalhe="Laboratório e/ou projeto" />
            <Etapa titulo="3. Parâmetros" faltante={0} detalhe="Aplicação econômica" />
            <Etapa titulo="4. Histórico" faltante={0} detalhe="Versões, validade e auditoria" />
          </div>
        </section>

        <div className="mt-6">
          <OrcamentosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}

function Etapa({ titulo, faltante, detalhe }: { titulo: string; faltante: number; detalhe: string }) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{titulo}</p>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          {faltante}% faltante
        </span>
      </div>
      <p className="mt-2 text-xs text-zinc-500">{detalhe}</p>
    </div>
  );
}
