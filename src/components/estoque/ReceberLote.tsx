"use client";

import { useState, useTransition } from "react";
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
}: {
  insumoId: number;
  especificacao: string;
  unidade: string | null;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [state, setState] = useState<FormState>({ ok: false });
  const [pending, startTransition] = useTransition();

  function action(formData: FormData) {
    startTransition(async () => {
      const res = await entradaInventario({ ok: false }, formData);
      setState(res);
      if (res.ok) {
        setAberto(false);
        router.refresh();
      }
    });
  }

  const inp =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
      >
        + Entrada
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setAberto(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Entrada de inventário (ajuste)</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {especificacao}
              {unidade ? ` · ${unidade}` : ""}
            </p>
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Para compras, prefira <strong>receber pelo item do pedido</strong> (em Compras) — assim a
              entrada fecha o pedido. Use esta porta só para contagem, doação ou correção de inventário.
            </p>

            <form action={action} className="mt-4 grid grid-cols-2 gap-3">
              <input type="hidden" name="insumo_id" value={insumoId} />
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input name="quantidade" type="number" step="any" min="0" className={inp} />
                {state.errors?.quantidade && (
                  <p className="mt-1 text-xs text-red-600">{state.errors.quantidade}</p>
                )}
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Validade
                </label>
                <input name="validade" type="date" className={inp} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Custo unitário (R$)
                </label>
                <input name="custo" type="number" step="0.0001" min="0" className={inp} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Código do lote
                </label>
                <input name="codigo" type="text" className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Fornecedor
                </label>
                <input name="fornecedor" type="text" className={inp} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Motivo do ajuste
                </label>
                <input
                  name="motivo"
                  type="text"
                  placeholder="Ex.: contagem cíclica, doação, correção"
                  className={inp}
                />
              </div>

              {state.message && !state.ok && (
                <p className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                  {state.message}
                </p>
              )}

              <div className="col-span-2 mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancelar
                </button>
                <button
                  disabled={pending}
                  className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {pending ? "Registrando…" : "Registrar entrada"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
