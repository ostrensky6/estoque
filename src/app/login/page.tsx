"use client";

import Image from "next/image";
import { useActionState } from "react";
import { entrar, solicitarRedefinicaoSenha } from "@/lib/actions/auth";
import type { FormState } from "@/lib/actions/cadastros";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(entrar, {
    ok: false,
  });
  const [resetState, resetAction, resetPending] = useActionState<FormState, FormData>(
    solicitarRedefinicaoSenha,
    { ok: false },
  );

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
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Entre para continuar. No primeiro acesso, use o link de redefinição para criar sua senha.
        </p>

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
            className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {pending ? "Entrando…" : "Entrar"}
          </button>
        </form>

        <form action={resetAction} className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Recuperar acesso
          </label>
          <div className="mt-2 flex gap-2">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
            <button
              disabled={resetPending}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {resetPending ? "Enviando" : "Enviar link"}
            </button>
          </div>
          {resetState.message && (
            <p className={`mt-2 text-xs ${resetState.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600"}`}>
              {resetState.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
