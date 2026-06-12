import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

const TABELAS = ["", "lotes_estoque", "insumos", "reservas_estoque", "pedidos_compra"];
const LABEL: Record<string, string> = {
  lotes_estoque: "Lotes",
  insumos: "Insumos",
  reservas_estoque: "Reservas",
  pedidos_compra: "Pedidos",
};
const ACAO: Record<string, { label: string; cls: string }> = {
  insert: { label: "Criou", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" },
  update: { label: "Alterou", cls: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300" },
  delete: { label: "Removeu", cls: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300" },
};

const IGNORAR = new Set(["criado_em", "atualizado_em"]);

function resumoDiff(acao: string, ant: Record<string, unknown> | null, novo: Record<string, unknown> | null): string {
  if (acao === "insert") return "registro criado";
  if (acao === "delete") return "registro removido";
  if (!ant || !novo) return "—";
  const mudancas: string[] = [];
  for (const k of Object.keys(novo)) {
    if (IGNORAR.has(k)) continue;
    if (JSON.stringify(ant[k]) !== JSON.stringify(novo[k])) {
      mudancas.push(`${k}: ${fmtVal(ant[k])} → ${fmtVal(novo[k])}`);
    }
  }
  return mudancas.slice(0, 4).join(" · ") || "sem mudanças relevantes";
}
function fmtVal(v: unknown) {
  if (v == null) return "∅";
  const s = String(v);
  return s.length > 28 ? s.slice(0, 28) + "…" : s;
}

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string }>;
}) {
  if (!(await temPapel("gestor"))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-zinc-500">
          Acesso restrito — a trilha de auditoria é visível para papel gestor ou admin.
        </p>
      </main>
    );
  }

  const { tabela } = await searchParams;
  const supabase = await createClient();
  let q = supabase
    .from("auditoria")
    .select("id, tabela, registro_id, acao, usuario, valor_anterior, valor_novo, criado_em")
    .order("id", { ascending: false })
    .limit(200);
  if (tabela) q = q.eq("tabela", tabela);
  const { data: registros } = await q;

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Auditoria</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Trilha de alterações (quem · quando · o quê). Imutável — gravada
          automaticamente pelo banco.
        </p>

        <nav className="mt-5 flex flex-wrap gap-2 text-xs">
          {TABELAS.map((t) => (
            <Link
              key={t || "todas"}
              href={t ? `/auditoria?tabela=${t}` : "/auditoria"}
              className={`rounded-full px-3 py-1 ${
                (tabela ?? "") === t
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {t ? LABEL[t] : "Todas"}
            </Link>
          ))}
        </nav>

        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
              <tr>
                <th className="px-4 py-3 text-left">Quando</th>
                <th className="px-4 py-3 text-left">Usuário</th>
                <th className="px-4 py-3 text-left">Tabela</th>
                <th className="px-4 py-3 text-center">Ação</th>
                <th className="px-4 py-3 text-left">Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(registros ?? []).map((r) => {
                const a = ACAO[r.acao] ?? { label: r.acao, cls: "bg-zinc-100" };
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-zinc-500">
                      {new Date(r.criado_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300">{r.usuario ?? "—"}</td>
                    <td className="px-4 py-2.5 text-zinc-500">
                      {LABEL[r.tabela] ?? r.tabela} <span className="text-zinc-400">#{r.registro_id}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.cls}`}>{a.label}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600 dark:text-zinc-300">
                      {resumoDiff(
                        r.acao,
                        r.valor_anterior as Record<string, unknown> | null,
                        r.valor_novo as Record<string, unknown> | null,
                      )}
                    </td>
                  </tr>
                );
              })}
              {(registros ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-zinc-400">
                    Nenhum evento de auditoria ainda.
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
