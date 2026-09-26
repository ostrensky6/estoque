"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  aprovarPedido,
  marcarEnviado,
  cancelarPedido,
  encerrarPedidoComPendencia,
} from "@/lib/actions/compras";
import type { FormState } from "@/lib/actions/cadastros";
import { ConfirmSubmitButton } from "@/components/common/ConfirmSubmitButton";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Confirmacao = { titulo: string; mensagem: string; confirmLabel: string };

function Botao({
  pedidoId,
  action,
  label,
  cls,
  confirmacao,
}: {
  pedidoId: number;
  action: Action;
  label: string;
  cls: string;
  confirmacao?: Confirmacao;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { ok: false });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="pedido_id" value={pedidoId} />
        {confirmacao ? (
          <ConfirmSubmitButton className={cls} destrutivo {...confirmacao}>
            {label}
          </ConfirmSubmitButton>
        ) : (
          <button disabled={pending} className={cls}>
            {pending ? "…" : label}
          </button>
        )}
      </form>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-danger-strong"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function EncerrarComPendencia({ pedidoId }: { pedidoId: number }) {
  const router = useRouter();
  const [state, formAction] = useActionState<FormState, FormData>(encerrarPedidoComPendencia, {
    ok: false,
  });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <div className="flex flex-col gap-1">
      <form action={formAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <div>
          <label htmlFor={`motivo-encerrar-${pedidoId}`} className="block text-xs text-muted-foreground">
            Por que o restante não virá?
          </label>
          <input
            id={`motivo-encerrar-${pedidoId}`}
            name="motivo"
            required
            minLength={3}
            placeholder="Ex.: fornecedor sem estoque"
            className="h-9 w-64 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
        <ConfirmSubmitButton
          className="rounded-md border border-input px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          titulo={`Encerrar a compra #${pedidoId} com pendência?`}
          mensagem="O que já chegou continua no estoque. O restante deixa de ser esperado e volta a contar como necessidade de reposição. A pendência fica registrada em cada item."
          confirmLabel="Encerrar com pendência"
        >
          Encerrar com pendência
        </ConfirmSubmitButton>
      </form>
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-danger-strong"}`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

export function PedidoAcoes({
  pedidoId,
  status,
  podeAprovar,
  podeCancelar,
  temRecebimento = false,
}: {
  pedidoId: number;
  status: string;
  /** permissão "Aprovar compras": aprovar, enviar e encerrar com pendência */
  podeAprovar: boolean;
  /** permissão "Cancelar compras e pedidos" */
  podeCancelar: boolean;
  /** Já chegou algo: cancelar é recusado; o caminho é encerrar com pendência. */
  temRecebimento?: boolean;
}) {
  if (status === "recebido" || status === "cancelado") return null;
  if (!podeAprovar && !podeCancelar)
    return (
      <p className="text-xs text-muted-foreground/80">
        Aprovar ou cancelar esta compra exige a permissão “Aprovar compras” ou “Cancelar compras e pedidos”.
      </p>
    );

  return (
    <div className="flex flex-wrap items-start gap-3">
      {status === "solicitado" && podeAprovar && (
        <Botao pedidoId={pedidoId} action={aprovarPedido} label="Aprovar"
          cls="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50" />
      )}
      {status === "aprovado" && podeAprovar && (
        <Botao pedidoId={pedidoId} action={marcarEnviado} label="Marcar enviado"
          cls="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50" />
      )}
      {temRecebimento ? (
        podeAprovar && <EncerrarComPendencia pedidoId={pedidoId} />
      ) : podeCancelar && (
        <Botao pedidoId={pedidoId} action={cancelarPedido} label="Cancelar pedido"
          cls="rounded-md border border-input px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          confirmacao={{
            titulo: `Cancelar o pedido #${pedidoId}?`,
            mensagem: "O pedido sai do ciclo de compras e não pode ser reaberto. O histórico é preservado.",
            confirmLabel: "Cancelar pedido",
          }} />
      )}
    </div>
  );
}
