"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  reservarPlano,
  iniciarPlano,
  liberarPlano,
  concluirPlano,
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
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {
    ok: false,
  });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="planejamento_id" value={planId} />
        {confirmar ? (
          <button
            type="button"
            disabled={pending}
            className={cls}
            onClick={() => setOpen(true)}
          >
            {pending ? "…" : label}
          </button>
        ) : (
          <button disabled={pending} className={cls}>
            {pending ? "…" : label}
          </button>
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Confirmar ação
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{confirmar}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
      {state.message && (
        <p
          className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-red-600"}`}
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
        cls="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        confirmar="Iniciar a análise dá baixa definitiva no estoque (FEFO). Confirmar?"
      />
      <Botao
        planId={planId}
        action={liberarPlano}
        label="Liberar reservas"
        cls="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      />
      <Botao
        planId={planId}
        action={concluirPlano}
        label="Concluir análise"
        cls="rounded-md border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
        confirmar="Marcar este planejamento como concluído? A baixa de estoque deve ter sido feita ao iniciar."
      />
    </div>
  );
}
