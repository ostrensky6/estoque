import { ShieldCheck } from "lucide-react";
import { obterMatriz } from "@/lib/actions/privilegios";
import { PrivilegiosMatriz } from "@/components/governanca/PrivilegiosMatriz";

export const dynamic = "force-dynamic";

export default async function PrivilegiosPage() {
  const matriz = await obterMatriz();

  if (!matriz) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center font-sans">
        <p className="text-zinc-500">
          Acesso restrito: privilégios são uma operação de administrador.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 font-sans text-slate-900 dark:text-slate-100 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Privilégios</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            Matriz de capacidades por papel. Alterações têm efeito imediato. O papel
            administrador tem acesso total e não é editável.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Governança
        </span>
      </div>
      <div className="mt-6">
        <PrivilegiosMatriz matriz={matriz} />
      </div>
    </main>
  );
}
