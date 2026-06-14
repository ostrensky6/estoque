import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_PROJETO: Record<string, { label: string; cls: string }> = {
  proposto: { label: "Proposto", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  ativo: { label: "Ativo", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  concluido: { label: "Concluído", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  cancelado: { label: "Cancelado", cls: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" },
};

const thCls =
  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400";
const tdCls = "px-3 py-2 text-sm text-slate-700 dark:text-zinc-200";

export default async function ProjetosPage() {
  const supabase = await createClient();
  const [{ data: projetos }, { data: clientes }] = await Promise.all([
    supabase
      .from("projetos")
      .select("id, nome, cliente_id, coordenador, status, data_inicio, data_fim")
      .order("criado_em", { ascending: false }),
    supabase.from("clientes").select("id, nome"),
  ]);

  const clienteNome = new Map((clientes ?? []).map((c) => [c.id, c.nome]));

  return (
    <div className="min-h-dvh bg-transparent font-sans text-slate-900 dark:bg-zinc-950 dark:text-slate-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projetos</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-zinc-400">
              Visão 360° por projeto: orçamentos, planejamentos, compras e demandas num só lugar.
            </p>
          </div>
          <Link
            href="/cadastros/projetos"
            className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
          >
            Cadastrar / editar projetos
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {(projetos ?? []).length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400 dark:text-zinc-500">
              Nenhum projeto cadastrado.{" "}
              <Link href="/cadastros/projetos" className="text-brand-700 hover:underline dark:text-brand-400">
                Cadastrar o primeiro
              </Link>
              .
            </p>
          ) : (
            <table className="min-w-full">
              <thead className="border-b border-slate-100 dark:border-zinc-800">
                <tr>
                  <th className={thCls}>Projeto</th>
                  <th className={thCls}>Cliente</th>
                  <th className={thCls}>Coordenador</th>
                  <th className={thCls}>Período</th>
                  <th className={thCls}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(projetos ?? []).map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/40"
                  >
                    <td className={tdCls}>
                      <Link href={`/projetos/${p.id}`} className="font-medium text-brand-700 hover:underline dark:text-brand-400">
                        {p.nome}
                      </Link>
                    </td>
                    <td className={tdCls}>{p.cliente_id != null ? clienteNome.get(p.cliente_id) ?? "—" : "—"}</td>
                    <td className={tdCls}>{p.coordenador ?? "—"}</td>
                    <td className={tdCls}>
                      {p.data_inicio || p.data_fim
                        ? `${p.data_inicio ?? "—"} → ${p.data_fim ?? "—"}`
                        : "—"}
                    </td>
                    <td className={tdCls}>
                      {(() => {
                        const s = STATUS_PROJETO[p.status] ?? { label: p.status, cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800" };
                        return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
