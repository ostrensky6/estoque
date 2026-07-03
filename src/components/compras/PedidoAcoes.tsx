"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { aprovarPedido, marcarEnviado, cancelarPedido } from "@/lib/actions/compras";
import type { FormState } from "@/lib/actions/cadastros";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function Botao({ pedidoId, action, label, cls }: { pedidoId: number; action: Action; label: string; cls: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { ok: false });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="pedido_id" value={pedidoId} />
        <button disabled={pending} className={cls}>
          {pending ? "…" : label}
        </button>
      </form>
      {state.message && (
        <p className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-danger-strong"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}

export function PedidoAcoes({
  pedidoId,
  status,
  podeGerir,
}: {
  pedidoId: number;
  status: string;
  podeGerir: boolean;
}) {
  if (status === "recebido" || status === "cancelado") return null;
  if (!podeGerir)
    return (
      <p className="text-xs text-muted-foreground/80">
        Aprovação/recebimento exigem papel coordenador ou superior.
      </p>
    );

  return (
    <div className="flex flex-wrap items-start gap-3">
      {status === "solicitado" && (
        <Botao pedidoId={pedidoId} action={aprovarPedido} label="Aprovar"
          cls="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50" />
      )}
      {status === "aprovado" && (
        <Botao pedidoId={pedidoId} action={marcarEnviado} label="Marcar enviado"
          cls="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50" />
      )}
      <Botao pedidoId={pedidoId} action={cancelarPedido} label="Cancelar pedido"
        cls="rounded-md border border-input px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50" />
    </div>
  );
}
