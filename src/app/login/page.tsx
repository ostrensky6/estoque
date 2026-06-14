"use client";

import Image from "next/image";
import { useActionState } from "react";
import { entrar } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/cadastros";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(entrar, {
    ok: false,
  });

  return (
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6 font-sans dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg ring-1 ring-slate-900/5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logos/kontrol-app.png"
            alt=""
            width={979}
            height={979}
            className="h-9 w-9 shrink-0 rounded-lg object-contain shadow-sm"
          />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Kontrol App
          </h1>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Entre para continuar.</p>

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
