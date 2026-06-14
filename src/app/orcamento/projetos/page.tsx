import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { criarOrcamentoProjeto } from "@/lib/actions/orcamento-projetos";
import {
  ProjetoOrcamentosTable,
  type ProjetoOrcamentoRow,
} from "@/components/orcamento/ProjetoOrcamentosTable";
import { calcularOrcamentoProjetoLegacy, itemProjetoTotal } from "@/lib/project-budget/legacy";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  em_preparacao: { label: "Em preparação", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  em_analise_cliente: { label: "Em análise", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  enviado: { label: "Enviado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

type Analise = { n_amostras: number; preco_unitario: number };
type Custo = {
  rubrica: string | null;
  quantidade: number;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};

export default async function OrcamentoProjetosPage() {
  const supabase = await createClient();
  const [{ data: orcamentos }, { data: projetos }] = await Promise.all([
    supabase
      .from("orcamento_projetos")
      .select(
        "id, titulo, cliente_nome, data_orcamento, status, projeto_id, margem_lucro, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, criado_em, orcamento_projeto_analises(n_amostras, preco_unitario), orcamento_projeto_custos(rubrica, quantidade, preco_unitario, meses_selecionados)",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);

  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: ProjetoOrcamentoRow[] = (orcamentos ?? []).map((o) => {
    const analises = (o.orcamento_projeto_analises as Analise[]) ?? [];
    const custos = (o.orcamento_projeto_custos as Custo[]) ?? [];
    const totalLab = analises.reduce((a, it) => a + Number(it.n_amostras) * Number(it.preco_unitario), 0);
    const totalCustos = custos.reduce((a, it) => a + itemProjetoTotal(it), 0);
    const calculo = calcularOrcamentoProjetoLegacy(
      [
        ...analises.map((it) => ({
          rubrica: "MC",
          quantidade: Number(it.n_amostras),
          preco_unitario: Number(it.preco_unitario),
        })),
        ...custos,
      ],
      {
        impostos_legacy: Number(o.impostos_legacy ?? o.impostos ?? 0),
        incubacao: Number(o.incubacao ?? 0),
        reserva: Number(o.reserva ?? 0),
        investimentos: Number(o.investimentos ?? 0),
        lucro: Number(o.lucro ?? o.margem_lucro ?? 0),
      },
    );
    const st = STATUS[o.status] ?? { label: o.status, cls: "" };
    return {
      id: o.id as number,
      titulo: o.titulo ?? `Orçamento ${o.id}`,
      cliente: o.cliente_nome ?? "—",
      projeto: o.projeto_id ? projetoNome.get(o.projeto_id) ?? "—" : "—",
      data: o.data_orcamento ?? "sem data",
      totalLab,
      totalCustos,
      total: calculo.grossTotal || totalLab + totalCustos,
      status: o.status,
      statusLabel: st.label,
    };
  });
  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/orcamento" className="text-xs text-zinc-500 hover:underline">
              Orçamentos de análises
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Orçamentos de projetos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Propostas completas por projeto, combinando análises do laboratório com custos de mão de obra,
              deslocamento, equipamentos, terceiros, materiais e cronograma.
            </p>
          </div>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ["Estoque", "materiais, entradas/saídas, lotes, fornecedores, unidades e custo real"],
            ["Orçamento de laboratório", "análises que usam estoque e snapshots do custo por amostra"],
            ["Orçamento de projetos", "escopo completo com custos laboratoriais e custos próprios do projeto"],
          ].map(([titulo, desc]) => (
            <div key={titulo} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">{titulo}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{desc}</p>
            </div>
          ))}
        </section>

        <form
          action={criarOrcamentoProjeto}
          className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr_auto] md:items-end dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Título</label>
            <input name="titulo" placeholder="Ex.: Projeto de sequenciamento 2026" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto vinculado</label>
            <select name="projeto_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">Criar sem vínculo</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Novo orçamento
          </button>
        </form>

        <div className="mt-6">
          <ProjetoOrcamentosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
