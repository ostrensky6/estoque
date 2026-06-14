import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import { AuditoriaTable, type AuditoriaRow } from "@/components/auditoria/AuditoriaTable";
import { formatDateTime } from "@/lib/formatters";

export const dynamic = "force-dynamic";

const TABELAS = ["", "lotes_estoque", "insumos", "reservas_estoque", "pedidos_compra"];
const LABEL: Record<string, string> = {
  lotes_estoque: "Lotes",
  insumos: "Insumos",
  reservas_estoque: "Reservas",
  pedidos_compra: "Pedidos",
};
const ACAO: Record<string, { label: string; cls: string }> = {
  insert: { label: "Criou", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
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
  const linhas: AuditoriaRow[] = (registros ?? []).map((r) => {
    const a = ACAO[r.acao] ?? { label: r.acao, cls: "" };
    return {
      id: r.id as number,
      quando: formatDateTime(r.criado_em as string),
      usuario: r.usuario ?? "—",
      tabela: r.tabela,
      tabelaLabel: LABEL[r.tabela] ?? r.tabela,
      registro: `#${r.registro_id}`,
      acao: r.acao,
      acaoLabel: a.label,
      alteracao: resumoDiff(
        r.acao,
        r.valor_anterior as Record<string, unknown> | null,
        r.valor_novo as Record<string, unknown> | null,
      ),
    };
  });

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
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

        <div className="mt-4">
          <AuditoriaTable rows={linhas} />
        </div>
      </main>
    </div>
  );
}
