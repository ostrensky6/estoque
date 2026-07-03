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
    <div className="app-canvas flex min-h-dvh items-center justify-center px-6 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg ring-1 ring-foreground/5">
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
        <h1 className="mt-4 text-lg font-semibold text-foreground">Defina sua senha</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Você entrou com uma senha provisória. Crie uma senha definitiva para continuar.
        </p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Nova senha</label>
            <input
              name="senha"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground">Confirmar senha</label>
            <input
              name="confirmar"
              type="password"
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>

          {state.message && (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong">
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
          <button className="w-full text-xs text-muted-foreground hover:text-foreground">
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
