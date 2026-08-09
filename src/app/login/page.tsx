"use client";

import Image from "next/image";
import { useActionState } from "react";
import { entrar, solicitarRedefinicaoSenha } from "@/lib/actions/auth";
import { SENHA_PROVISORIA } from "@/lib/auth/senha-provisoria";
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
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-lg ring-1 ring-foreground/5">
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
        <p className="mt-3 text-sm text-muted-foreground">
          Entre com o e-mail cadastrado e sua senha.
        </p>

        <div
          id="senha-provisoria"
          className="mt-5 rounded-xl bg-info-soft px-4 py-3 text-info-strong"
        >
          <p className="text-xs font-semibold">Primeiro acesso</p>
          <p className="mt-1 text-sm leading-5">
            Se o administrador cadastrou seu usuário, entre com a senha provisória{" "}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono font-semibold">
              {SENHA_PROVISORIA}
            </code>
            . Ela deixa de valer depois que você define sua senha pessoal.
          </p>
        </div>

        <form action={action} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              E-mail
            </label>
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">
              Senha
            </label>
            <input
              name="senha"
              type="password"
              autoComplete="current-password"
              aria-describedby="senha-provisoria"
              required
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>

          {state.message && (
            <p
              role="alert"
              className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
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

        <form action={resetAction} className="mt-4 rounded-md border border-border bg-muted/50 p-3">
          <label className="block text-xs font-medium text-muted-foreground">
            Recuperar acesso
          </label>
          <div className="mt-2 flex gap-2">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email"
              className="min-w-0 flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
            <button
              disabled={resetPending}
              className="rounded-md border border-input bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
            >
              {resetPending ? "Enviando" : "Enviar link"}
            </button>
          </div>
          {resetState.message && (
            <p className={`mt-2 text-xs ${resetState.ok ? "text-brand-700 dark:text-brand-300" : "text-danger-strong"}`}>
              {resetState.message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
