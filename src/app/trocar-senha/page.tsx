"use client";

import Image from "next/image";
import { useActionState } from "react";
import { definirSenhaDefinitiva, sair } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/cadastros";

export default function TrocarSenhaPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(definirSenhaDefinitiva, {
    ok: false,
  });

  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex justify-center">
          <Image
            src="/logos/kontrol-app.png"
            alt="Kontrol App"
            width={1448}
            height={1086}
            className="h-auto w-52 object-contain"
            priority
            unoptimized
          />
        </div>
        <h1 className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Defina sua senha</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Você entrou com uma senha provisória. Crie uma senha definitiva para continuar.
        </p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Nova senha</label>
            <input
              name="senha"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Confirmar senha</label>
            <input
              name="confirmar"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          {state.message && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {state.message}
            </p>
          )}

          <button
            disabled={pending}
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Salvar e continuar"}
          </button>
        </form>

        <form action={sair} className="mt-4">
          <button className="w-full text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
