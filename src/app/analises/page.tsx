import { createClient } from "@/lib/supabase/server";
import { gargalo, horasBancadaPorAmostra, type Etapa } from "@/lib/costing/engine";
import { AnalisesTable, type AnaliseRow } from "@/components/analises/AnalisesTable";
import { criarAnalise } from "@/lib/actions/receita";

export const dynamic = "force-dynamic";

export default async function AnalisesPage() {
  const supabase = await createClient();
  const [
    { data: analises },
    { data: etapas },
    { data: insumoAnalise },
    { data: equipAnalise },
  ] = await Promise.all([
    supabase.from("analises").select("codigo, nome, descricao, ativo").order("codigo"),
    supabase.from("etapas").select("*"),
    supabase.from("insumo_analise").select("codigo_analise"),
    supabase.from("equipamento_analise").select("codigo_analise"),
  ]);

  const contar = (rows: { codigo_analise: string }[] | null, cod: string) =>
    (rows ?? []).filter((r) => r.codigo_analise === cod).length;

  const linhas: AnaliseRow[] = (analises ?? []).map((a) => {
    const etapasA = ((etapas ?? []) as Etapa[]).filter(
      (e) => (e as unknown as { codigo_analise: string }).codigo_analise === a.codigo,
    );
    const g = gargalo(etapasA);
    return {
      codigo: a.codigo,
      nome: a.nome ?? "",
      nEtapas: etapasA.length,
      amostrasDia: g.amostrasDia,
      execucoesDia: g.execucoesDia,
      tempoBancada: horasBancadaPorAmostra(etapasA),
      nInsumos: contar(insumoAnalise, a.codigo),
      nEquip: contar(equipAnalise, a.codigo),
      status: a.ativo ? "ativa" : "inativa",
      statusLabel: a.ativo ? "Ativa" : "Inativa",
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Análises</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Catálogo técnico das análises do laboratório. Clique para ver e editar a
          receita: etapas, capacidade, equipamentos e materiais utilizados.
        </p>

        <form
          action={criarAnalise}
          className="mt-6 flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Código</label>
            <input name="codigo" required placeholder="Ex.: Illumina_16S_AC" className="mt-1 w-56 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Nome</label>
            <input name="nome" placeholder="Ex.: Metagenômica 16S" className="mt-1 w-64 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            Nova análise
          </button>
        </form>

        <div className="mt-6">
          <AnalisesTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
