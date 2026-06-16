"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  aprovarAnaliseAdministrativa,
  cancelarPedidoInterno,
  devolverParaCompras,
  devolverParaSolicitante,
  encaminharInstituicao,
  enviarParaValidacao,
  fecharComFornecedor,
  formalizarPedidoInterno,
  registrarLevantamentoOrcamentos,
  validarInformacoes,
} from "@/lib/actions/pedidos-internos";
import type { FormState } from "@/lib/actions/cadastros";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

function Botao({
  pedidoId,
  action,
  label,
  variant = "primary",
  observacao,
}: {
  pedidoId: number;
  action: Action;
  label: string;
  variant?: "primary" | "outline" | "danger";
  observacao?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, { ok: false });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const cls =
    variant === "danger"
      ? "rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
      : variant === "outline"
        ? "rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        : "rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50";

  return (
    <div className="flex flex-col gap-1">
      <form action={formAction}>
        <input type="hidden" name="pedido_interno_id" value={pedidoId} />
        {observacao && <input type="hidden" name="observacao" value={observacao} />}
        <button disabled={pending} className={cls}>
          {pending ? "..." : label}
        </button>
      </form>
      {state.message && (
        <p className={`max-w-64 text-xs ${state.ok ? "text-brand-700 dark:text-brand-400" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </div>
  );
}

export function PedidoInternoAcoes({
  pedidoId,
  status,
  podeGerir,
}: {
  pedidoId: number;
  status: string;
  podeGerir: boolean;
}) {
  if (status === "cancelado" || status === "compra_fechada" || status === "encaminhado_instituicao") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(status) && (
        <Botao pedidoId={pedidoId} action={enviarParaValidacao} label="Enviar para validação" />
      )}

      {status === "em_validacao" && podeGerir && (
        <>
          <Botao pedidoId={pedidoId} action={validarInformacoes} label="Validar informações" />
          <Botao pedidoId={pedidoId} action={devolverParaSolicitante} label="Devolver ao solicitante" variant="outline" />
        </>
      )}

      {status === "validado" && podeGerir && (
        <Botao pedidoId={pedidoId} action={formalizarPedidoInterno} label="Formalizar em compras" />
      )}

      {status === "analise_administrativa" && podeGerir && (
        <>
          <Botao pedidoId={pedidoId} action={aprovarAnaliseAdministrativa} label="Aprovar compra" />
          <Botao pedidoId={pedidoId} action={devolverParaCompras} label="Devolver para ajuste" variant="outline" />
        </>
      )}

      {status === "aprovado_compra" && podeGerir && (
        <Botao pedidoId={pedidoId} action={registrarLevantamentoOrcamentos} label="Registrar orçamentos" />
      )}

      {status === "orcamentos" && podeGerir && (
        <>
          <Botao pedidoId={pedidoId} action={fecharComFornecedor} label="Fechar com fornecedor" />
          <Botao pedidoId={pedidoId} action={encaminharInstituicao} label="Encaminhar à instituição" variant="outline" />
        </>
      )}

      {podeGerir && (
        <Botao pedidoId={pedidoId} action={cancelarPedidoInterno} label="Cancelar" variant="danger" />
      )}
    </div>
  );
}
