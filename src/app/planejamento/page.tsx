import Link from "next/link";
import { createAdminClientUntyped } from "@/lib/supabase/admin";
import { criarPlano } from "@/lib/actions/planejamento";

export const dynamic = "force-dynamic";

type Reserva = { status: string };

function statusPlano(reservas: Reserva[]) {
  if (reservas.some((r) => r.status === "consumido"))
    return { label: "Iniciado", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" };
  if (reservas.some((r) => r.status === "reservado"))
    return { label: "Reservado", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" };
  if (reservas.length > 0)
    return { label: "Liberado", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };
  return { label: "Rascunho", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" };
}

export default async function PlanejamentoPage() {
  const supabase = createAdminClientUntyped();
  const { data: planos } = await supabase
    .from("planejamento")
    .select("id, nome, data_alvo, criado_em, planejamento_itens(count), reservas_estoque(status)")
    .order("criado_em", { ascending: false });

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
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
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + Novo plano
          </button>
        </form>

        {/* lista */}
        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Data alvo</th>
                <th className="px-4 py-3 text-right">Análises</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(planos ?? []).map((p) => {
                const itens = (p.planejamento_itens as { count: number }[])?.[0]?.count ?? 0;
                const st = statusPlano((p.reservas_estoque as Reserva[]) ?? []);
                return (
                  <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/planejamento/${p.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                        {p.nome}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-zinc-500">{p.data_alvo ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{itens}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
              {(planos ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-zinc-400">
                    Nenhum plano ainda. Crie o primeiro acima.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
