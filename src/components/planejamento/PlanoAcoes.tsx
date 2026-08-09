"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {
    ok: false,
  });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  function confirmarEnvio() {
    const form = formRef.current;
    setOpen(false);
    form?.requestSubmit();
  }

  return (
    <div className="flex flex-col gap-1">
      <form ref={formRef} action={formAction}>
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
            <button
              type="button"
              aria-label="Fechar confirmação"
              className="absolute inset-0 bg-black/40"
              onClick={() => setOpen(false)}
            />
            <div className="relative w-full max-w-sm rounded-xl bg-card p-5 shadow-xl">
              <h3 className="text-base font-semibold text-foreground">
                Confirmar ação
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">{confirmar}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={confirmarEnvio}
                  className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500"
                >
                  {pending ? "…" : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
      {state.message && (
        <p
          className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-danger-strong"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export function PlanoAcoes({
  planId,
  status,
  temFalta,
  contextoCompleto,
  temBloqueioEquipamentos = false,
}: {
  planId: number;
  status: string;
  temFalta: boolean;
  contextoCompleto: boolean;
  temBloqueioEquipamentos?: boolean;
}) {
  const podeReservar = contextoCompleto && (status === "Rascunho" || status === "Reservado");
  const podeIniciar = status === "Reservado" && !temFalta && !temBloqueioEquipamentos;
  const podeLiberar = status === "Reservado";
  const podeConcluir = status === "Em execução" || status === "Iniciado";

  return (
    <div className="space-y-3">
      {!contextoCompleto && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">
          Complete projeto e período previsto para transformar a previsão em reserva de estoque.
        </p>
      )}
      {status === "Reservado" && temFalta && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">
          Há falta operacional. Gere pedido, libere/receba lotes ou replaneje antes de iniciar a baixa.
        </p>
      )}
      {status === "Reservado" && !temFalta && temBloqueioEquipamentos && (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-strong">
          Há equipamento obrigatório sem reserva operacional válida. Reserve uma unidade disponível antes de iniciar.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-3">
        {podeReservar && (
          <Botao
            planId={planId}
            action={reservarPlano}
            label="Reservar insumos"
            cls="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          />
        )}
        {podeIniciar && (
          <Botao
            planId={planId}
            action={iniciarPlano}
            label="Iniciar (baixa definitiva)"
            cls="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
            confirmar="Iniciar a análise dá baixa definitiva nos lotes reservados. Confirmar?"
          />
        )}
        {podeLiberar && (
          <Botao
            planId={planId}
            action={liberarPlano}
            label="Liberar reservas"
            cls="rounded-md border border-input px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          />
        )}
        {podeConcluir && (
          <Botao
            planId={planId}
            action={concluirPlano}
            label="Concluir análise"
            cls="rounded-md border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-950/30"
            confirmar="Marcar este planejamento como concluído? A baixa de estoque deve ter sido feita ao iniciar."
          />
        )}
      </div>
    </div>
  );
}
