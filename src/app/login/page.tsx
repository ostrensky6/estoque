"use client";

import { useActionState } from "react";
import { entrar } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/cadastros";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(entrar, {
    ok: false,
  });

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Lab Custos &amp; Estoque
        </h1>
        <p className="mt-1 text-sm text-zinc-500">Entre para continuar.</p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              E-mail
            </label>
            <input
              name="email"
              type="email"
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Senha
            </label>
            <input
              name="senha"
              type="password"
              autoComplete="current-password"
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
            className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
