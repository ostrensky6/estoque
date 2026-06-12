import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const { data: analises, error } = await supabase
    .from("analises")
    .select("codigo, nome, ativo")
    .order("codigo");

  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Lab Custos &amp; Estoque
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Conectado ao Supabase local — {analises?.length ?? 0} análises
          carregadas da planilha.
        </p>

        {error && (
          <p className="mt-6 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Erro ao consultar o banco: {error.message}
          </p>
        )}

        <ul className="mt-8 divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {analises?.map((a) => (
            <li
              key={a.codigo}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <span className="font-medium">{a.codigo}</span>
              <span className="text-zinc-400">
                {a.ativo ? "ativa" : "inativa"}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
