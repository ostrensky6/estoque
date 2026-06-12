"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  reservarPlano,
  iniciarPlano,
  liberarPlano,
} from "@/lib/actions/planejamento";
import type { FormState } from "@/lib/actions/cadastros";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function Botao({
  planId,
  action,
  label,
  cls,
  confirmar,
}: {
  planId: number;
  action: Action;
  label: string;
  cls: string;
  confirmar?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {
    ok: false,
  });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-1">
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirmar && !confirm(confirmar)) e.preventDefault();
        }}
      >
        <input type="hidden" name="planejamento_id" value={planId} />
        <button disabled={pending} className={cls}>
          {pending ? "…" : label}
        </button>
      </form>
      {state.message && (
        <p
          className={`text-xs ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export function PlanoAcoes({ planId }: { planId: number }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <Botao
        planId={planId}
        action={reservarPlano}
        label="Reservar insumos"
        cls="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      />
      <Botao
        planId={planId}
        action={iniciarPlano}
        label="Iniciar (baixa definitiva)"
        cls="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        confirmar="Iniciar a análise dá baixa definitiva no estoque (FEFO). Confirmar?"
      />
      <Botao
        planId={planId}
        action={liberarPlano}
        label="Liberar reservas"
        cls="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      />
    </div>
  );
}
