"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { entradaInventario } from "@/lib/actions/estoque";
import type { FormState } from "@/lib/actions/cadastros";

/**
 * 2.4 — Entrada de inventário / ajuste (porta avulsa, separada do recebimento
 * de compra). O recebimento normal acontece no item do pedido de compra.
 */
export function AjusteInventarioButton({
  insumoId,
  especificacao,
  unidade,
  abertoInicial = false,
  triggerLabel = "+ Entrada",
  triggerClassName,
}: {
  insumoId: number;
  especificacao?: string;
  unidade?: string | null;
  abertoInicial?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(abertoInicial);
  const [state, setState] = useState<FormState>({ ok: false });
  const [pending, startTransition] = useTransition();

  function fechar() {
    setAberto(false);
    setState({ ok: false });
    if (abertoInicial) router.replace("/estoque");
  }

  function action(formData: FormData) {
    startTransition(async () => {
      const res = await entradaInventario({ ok: false }, formData);
      setState(res);
      if (res.ok && !abertoInicial) router.refresh();
    });
  }

  const inp =
    "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          triggerClassName ??
          "rounded px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30"
        }
      >
        {triggerLabel}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && fechar()} />
          <div className="relative w-full max-w-md rounded-xl bg-card p-5 shadow-xl">
            <h3 className="text-base font-semibold">Entrada de inventário (ajuste)</h3>
            {(especificacao || unidade) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {especificacao}
                {unidade ? ` · ${unidade}` : ""}
              </p>
            )}
            <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-strong">
              Para compras, prefira <strong>receber pelo item do pedido</strong> (em Compras) — assim a
              entrada fecha o pedido. Use esta porta só para contagem, doação ou correção de inventário.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Esta entrada cria um lote em quarentena. Após o aceite, ele compõe as unidades fechadas. As
              unidades abertas surgem após a abertura do lote no primeiro consumo.
            </p>

            {state.ok ? (
              <div className="mt-4 space-y-4">
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-md bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
                >
                  <p>{state.message ?? "Entrada registrada em quarentena."}</p>
                  <p className="mt-1 text-xs">
                    A ação Aceitar aparece na tabela somente para usuários autorizados.
                  </p>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={fechar}
                    className="min-h-11 rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
                  >
                    Fechar
                  </button>
                  <Link
                    href="/estoque"
                    className="inline-flex min-h-11 items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
                  >
                    Revisar no Estoque
                  </Link>
                </div>
              </div>
            ) : (
              <form action={action} className="mt-4 grid grid-cols-2 gap-3">
                <input type="hidden" name="insumo_id" value={insumoId} />
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Quantidade <span className="text-danger-strong">*</span>
                  </label>
                  <input name="quantidade" type="number" step="any" min="0" className={inp} />
                  {state.errors?.quantidade && (
                    <p className="mt-1 text-xs text-danger-strong">{state.errors.quantidade}</p>
                  )}
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Validade
                  </label>
                  <input name="validade" type="date" className={inp} />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Custo unitário (R$)
                  </label>
                  <input name="custo" type="number" step="0.0001" min="0" className={inp} />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Código do lote
                  </label>
                  <input name="codigo" type="text" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Fornecedor
                  </label>
                  <input name="fornecedor" type="text" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Motivo do ajuste
                  </label>
                  <input
                    name="motivo"
                    type="text"
                    placeholder="Ex.: contagem cíclica, doação, correção"
                    className={inp}
                  />
                </div>

                {state.message && (
                  <p
                    role="alert"
                    className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger-strong"
                  >
                    {state.message}
                  </p>
                )}

                <div className="col-span-2 mt-1 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={fechar}
                    className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    disabled={pending}
                    className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
                  >
                    {pending ? "Registrando…" : "Registrar entrada"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
