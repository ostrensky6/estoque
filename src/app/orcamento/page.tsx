import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarOrcamento } from "@/lib/actions/orcamentos";
import { OrcamentosTable, type OrcamentoRow } from "@/components/orcamento/OrcamentosTable";
import { calcularOrcamentoProjetoLegacy, itemProjetoTotal } from "@/lib/project-budget/legacy";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  aprovado: { label: "Aprovado", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const TIPO = {
  analises: "Só análises",
  projeto: "Só projeto",
  analises_projeto: "Análises + projeto",
} as const;

type ItemAnalise = { n_amostras: number; preco_unitario: number };
type CustoProjeto = {
  rubrica: string | null;
  quantidade: number;
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

export default async function OrcamentosPage() {
  const supabase = await createClient();
  const [{ data: orcamentos }, { data: orcProjetos }, { data: projetos }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select(
        "id, tipo, cliente_nome, data_orcamento, status, criado_em, projeto_id, orcamento_itens(n_amostras, preco_unitario)",
      )
      .order("criado_em", { ascending: false }),
    supabase
      .from("orcamento_projetos")
      .select(
        "id, titulo, cliente_nome, data_orcamento, status, projeto_id, margem_lucro, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, criado_em, orcamento_projeto_analises(n_amostras, preco_unitario), orcamento_projeto_custos(rubrica, quantidade, preco_unitario, meses_selecionados)",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);

  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
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
      preco_unitario: Number(it.preco_unitario),
      meses_selecionados: [],
    }));
    const custos = ((o.orcamento_projeto_custos as CustoProjeto[]) ?? []);
    const calculo = calcularOrcamentoProjetoLegacy([...analises, ...custos], {
      impostos_legacy: Number(o.impostos_legacy ?? o.impostos ?? 0),
      incubacao: Number(o.incubacao ?? 0),
      reserva: Number(o.reserva ?? 0),
      investimentos: Number(o.investimentos ?? 0),
      lucro: Number(o.lucro ?? o.margem_lucro ?? 0),
    });
    const temAnalises = analises.length > 0;
    const temCustosProjeto = custos.length > 0;
    const tipo = temAnalises && temCustosProjeto ? "analises_projeto" : temAnalises ? "analises_projeto" : "projeto";
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

  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Análises/Lab.</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Cálculo de custos e preços para análises. O escopo define se o registro inclui só análises, só projeto ou análises + projeto.
            </p>
          </div>
          <Link href="/orcamento/parametros" className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
            Parâmetros econômicos
          </Link>
        </div>

        <form
          action={criarOrcamento}
          className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto] md:items-end dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Tipo</label>
            <select aria-label="Tipo" name="tipo" defaultValue="analises_projeto" className={`${inp} mt-1 w-full`}>
              <option value="analises">Só análises</option>
              <option value="projeto">Só projeto</option>
              <option value="analises_projeto">Análises + projeto</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Cliente</label>
            <input aria-label="Cliente" name="cliente_nome" placeholder="Ex.: Embrapa Suínos e Aves" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto vinculado</label>
            <select aria-label="Projeto vinculado" name="projeto_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">—</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
            <input type="hidden" name="titulo" value="" />
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
            Novo custo de análise
          </button>
        </form>

        <div className="mt-6">
          <OrcamentosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
