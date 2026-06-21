import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  criarProjetoDeTemplate,
  excluirTemplate,
} from "@/lib/actions/orcamento-projetos";
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
  aprovado: { label: "Aprovado", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  recusado: { label: "Recusado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  cancelado: { label: "Cancelado", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

type Analise = { n_amostras: number; custo_unitario: number };
type Custo = {
  rubrica: string | null;
  quantidade: number;
  custo_unitario: number;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};

export default async function OrcamentoProjetosPage() {
  const supabase = await createClient();
  const [{ data: orcamentos }, { data: projetos }] = await Promise.all([
    supabase
      .from("orcamento_projetos")
      .select(
        "id, titulo, cliente_nome, data_orcamento, status, projeto_id, margem_lucro, impostos, impostos_legacy, incubacao, reserva, investimentos, lucro, criado_em, orcamento_projeto_analises(n_amostras, custo_unitario), orcamento_projeto_custos(rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)",
      )
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);

  const { data: templates } = await supabase
    .from("orcamento_projeto_templates")
    .select("id, nome, descricao, criado_em")
    .order("criado_em", { ascending: false });

  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: ProjetoOrcamentoRow[] = (orcamentos ?? []).map((o) => {
    const analises = (o.orcamento_projeto_analises as Analise[]) ?? [];
    const custos = ((o.orcamento_projeto_custos as Custo[]) ?? []).map((it) => ({
      ...it,
      preco_unitario: Number(it.custo_unitario ?? it.preco_unitario ?? 0),
    }));
    const totalLab = analises.reduce((a, it) => a + Number(it.n_amostras) * Number(it.custo_unitario), 0);
    const totalCustos = custos.reduce((a, it) => a + itemProjetoTotal(it), 0);
    const calculo = calcularOrcamentoProjetoLegacy(
      [
        ...analises.map((it) => ({
          rubrica: "MC",
          quantidade: Number(it.n_amostras),
          preco_unitario: Number(it.custo_unitario),
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
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300"; // §8.2: entrada em azul

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href="/orcamento" className="text-xs text-zinc-500 hover:underline">
              Orçamentos
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Projetos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Histórico de custos de projeto vinculados a demandas. A criação de novos registros começa em Demandas/Propostas.
            </p>
          </div>
          <Link href="/orcamento/demandas" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
            Nova demanda
          </Link>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            ["1. Demanda", "0% faltante quando a modalidade e o cliente estao definidos"],
            ["2. Custos de projeto", "100% faltante ate haver rubricas, etapas ou atividades cadastradas"],
            ["3. Parametros e emissao", "aplicados somente depois do levantamento de custos"],
          ].map(([titulo, desc]) => (
            <div key={titulo} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-semibold">{titulo}</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{desc}</p>
            </div>
          ))}
        </section>

        {(templates ?? []).length > 0 && (
          <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold">Modelos</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Crie um novo orçamento de projeto a partir de um template (parâmetros e rubricas pré-preenchidos).
            </p>
            <div className="mt-3 grid gap-2">
              {(templates ?? []).map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
                >
                  <div className="min-w-48">
                    <p className="text-sm font-medium">{t.nome}</p>
                    {t.descricao && <p className="text-xs text-zinc-500">{t.descricao}</p>}
                  </div>
                  <div className="flex items-end gap-2">
                    <form action={criarProjetoDeTemplate} className="flex items-end gap-2">
                      <input type="hidden" name="template_id" value={t.id} />
                      <select name="projeto_id" defaultValue="" className={inp}>
                        <option value="">Sem vínculo</option>
                        {(projetos ?? []).map((p) => (
                          <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                      </select>
                      <button className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
                        Criar a partir deste
                      </button>
                    </form>
                    <form action={excluirTemplate}>
                      <input type="hidden" name="template_id" value={t.id} />
                      <button className="rounded-md border border-zinc-300 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        Excluir
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6">
          <ProjetoOrcamentosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
