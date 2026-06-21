import { createClient } from "@/lib/supabase/server";
import { criarDemanda } from "@/lib/actions/demandas";
import { DemandasTable, type DemandaRow } from "@/components/orcamento/DemandasTable";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";

export const dynamic = "force-dynamic";

const MODALIDADES: Record<string, string> = {
  analises: "Apenas análises",
  projeto: "Apenas projeto",
  analises_projeto: "Análises dentro de projeto",
  projeto_analises_custos: "Projeto com análises e custos próprios",
};

const STATUS: Record<string, { label: string; cls: string }> = {
  nova: { label: "Nova", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300" },
  em_analise: { label: "Em análise", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  orcada: { label: "Orçada", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  aprovada: { label: "Aprovada", cls: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300" },
  recusada: { label: "Recusada", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
  cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
};

export default async function DemandasPage() {
  const supabase = await createClient();
  const [{ data: demandas }, { data: clientes }, { data: projetos }] = await Promise.all([
    supabase
      .from("demandas_propostas")
      .select("id, titulo, cliente_id, cliente_nome, modalidade, status, prioridade, data_solicitacao, prazo_esperado, projeto_id, descricao, escopo_preliminar, matriz_amostra, quantidade_amostras_estimada, prazo_tecnico_dias, criado_em")
      .order("criado_em", { ascending: false }),
    supabase.from("clientes").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: DemandaRow[] = (demandas ?? []).map((d) => {
    const st = STATUS[d.status] ?? { label: d.status, cls: "" };
    const completude = avaliarCompletudeDemanda(d);
    return {
      id: d.id as number,
      titulo: d.titulo ?? "Demanda sem título",
      cliente: d.cliente_nome ?? "—",
      modalidade: d.modalidade,
      modalidadeLabel: MODALIDADES[d.modalidade] ?? d.modalidade,
      projeto: d.projeto_id ? projetoNome.get(d.projeto_id) ?? "—" : "—",
      prazo: d.prazo_esperado ?? "—",
      prioridade: d.prioridade ?? "—",
      dataSolicitacao: d.data_solicitacao ?? "—",
      status: d.status,
      statusLabel: st.label,
      completudeLabel: completude.completa ? "Pronta" : `${completude.faltante}% faltante`,
      completa: completude.completa,
    };
  });
  const inp =
    "rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-brand-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300"; // §8.2: entrada em azul

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-400">
            Entrada comercial
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Demandas/Propostas</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-500">
            Registre a demanda antes do orçamento formal. A partir daqui o fluxo segue para orçamento
            de análises, orçamento de projeto ou composição híbrida.
          </p>
        </div>

        <form
          action={criarDemanda}
          className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-4 md:items-end dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Título da demanda</label>
            <input name="titulo" placeholder="Ex.: Sequenciamento de amostras ambientais" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Cliente</label>
            <select name="cliente_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">Cliente livre</option>
              {(clientes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Modalidade</label>
            <select name="modalidade" defaultValue="analises" className={`${inp} mt-1 w-full`}>
              {Object.entries(MODALIDADES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Cliente livre</label>
            <input name="cliente_nome" placeholder="Nome do cliente/instituição se não estiver cadastrado" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Matriz/amostra</label>
            <input name="matriz_amostra" placeholder="Ex.: água, solo, tecido" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Qtd. amostras</label>
            <input name="quantidade_amostras_estimada" type="number" min="1" step="1" className={`${inp} mt-1 w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto</label>
            <select name="projeto_id" defaultValue="" className={`${inp} mt-1 w-full`}>
              <option value="">Sem projeto</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
            Nova demanda
          </button>
        </form>

        <div className="mt-6">
          <DemandasTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
