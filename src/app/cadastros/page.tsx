import Link from "next/link";
import { CADASTROS } from "@/lib/cadastros/config";

export default function CadastrosIndex() {
  return (
    <div className="min-h-dvh bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cadastros — elementos de custo
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Registre os insumos, equipamentos, pessoal e overhead que alimentam o
          custeio das análises.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {Object.values(CADASTROS).map((c) => (
            <Link
              key={c.slug}
              href={`/cadastros/${c.slug}`}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow dark:border-zinc-800 dark:bg-zinc-900"
            >
              <h2 className="text-lg font-semibold">{c.titulo}</h2>
              <p className="mt-1 text-sm text-zinc-500">{c.subtitulo}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
