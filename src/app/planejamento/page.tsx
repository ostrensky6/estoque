import { createClient } from "@/lib/supabase/server";
import { criarPlano } from "@/lib/actions/planejamento";
import { PlanosTable, type PlanoRow } from "@/components/planejamento/PlanosTable";

export const dynamic = "force-dynamic";

type Reserva = { status: string };
type PlanejamentoListRow = {
  id: number;
  nome: string | null;
  data_alvo: string | null;
  projeto_id: number | null;
  status_operacional?: string | null;
  planejamento_itens: { count: number }[] | null;
  reservas_estoque: Reserva[] | null;
};
type PlanejamentoQuery = {
  select: (columns: string) => {
    order: (column: string, options?: { ascending?: boolean }) => PromiseLike<{ data: PlanejamentoListRow[] | null; error: unknown }>;
  };
};

function statusPlano(reservas: Reserva[], statusOperacional?: string | null) {
  if (statusOperacional === "concluido") return { status: "concluido", label: "Concluído" };
  if (statusOperacional === "em_execucao") return { status: "iniciado", label: "Em execução" };
  if (statusOperacional === "cancelado") return { status: "liberado", label: "Cancelado" };
  if (statusOperacional === "reservado") return { status: "reservado", label: "Reservado" };
  if (reservas.some((r) => r.status === "consumido"))
    return { status: "iniciado", label: "Iniciado" };
  if (reservas.some((r) => r.status === "reservado"))
    return { status: "reservado", label: "Reservado" };
  if (reservas.length > 0)
    return { status: "liberado", label: "Liberado" };
  return { status: "rascunho", label: "Rascunho" };
}

export default async function PlanejamentoPage() {
  const supabase = await createClient();
  const [{ data: planos }, { data: projetos }] = await Promise.all([
    (supabase.from("planejamento") as unknown as PlanejamentoQuery)
      .select("id, nome, data_alvo, criado_em, projeto_id, status_operacional, planejamento_itens(count), reservas_estoque(status)")
      .order("criado_em", { ascending: false }),
    supabase.from("projetos").select("id, nome").order("nome"),
  ]);
  const projetoNome = new Map((projetos ?? []).map((p) => [p.id, p.nome]));
  const linhas: PlanoRow[] = (planos ?? []).map((p) => {
    const itens = (p.planejamento_itens as { count: number }[])?.[0]?.count ?? 0;
    const st = statusPlano(
      (p.reservas_estoque as Reserva[]) ?? [],
      (p as unknown as { status_operacional?: string | null }).status_operacional,
    );
    return {
      id: p.id as number,
      nome: p.nome ?? "Plano sem nome",
      projeto: p.projeto_id != null ? projetoNome.get(p.projeto_id) ?? "—" : "—",
      dataAlvo: p.data_alvo ?? "—",
      itens,
      status: st.status,
      statusLabel: st.label,
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Planejamento</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Planeje análises, reserve os insumos e dê baixa ao iniciar. A demanda é
          calculada do consumo por amostra.
        </p>

        {/* novo plano */}
        <form action={criarPlano} className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nome do plano</label>
            <input name="nome" placeholder="Ex.: Lote junho — sequenciamento" className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Data alvo</label>
            <input name="data_alvo" type="date" className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto</label>
            <select name="projeto_id" defaultValue="" className="mt-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              <option value="">—</option>
              {(projetos ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
            + Novo plano
          </button>
        </form>

        <div className="mt-6">
          <PlanosTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
