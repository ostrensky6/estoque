"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";

import { receberItemPedidoInterno } from "@/lib/actions/pedidos-internos";
import type { FormState } from "@/lib/actions/cadastros";

type Insumo = { id: number; especificacao: string | null; unidade: string | null };

export type ItemRecebivel = {
  id: number;
  pedidoId: number;
  especificacao: string;
  quantidade: number;
  unidade: string | null;
  insumoId: number | null;
  fornecedorSugerido: string | null;
  orcamentoPrevio: number | null;
};

export function ReceberItemPedidoInterno({
  item,
  insumos,
}: {
  item: ItemRecebivel;
  insumos: Insumo[];
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [state, setState] = useState<FormState>({ ok: false });
  const [pending, startTransition] = useTransition();
  // "" = escolher existente; "novo" = cadastrar pela especificação.
  const [modo, setModo] = useState<"" | "novo">(item.insumoId ? "" : "");

  function action(formData: FormData) {
    startTransition(async () => {
      const res = await receberItemPedidoInterno({ ok: false }, formData);
      setState(res);
      if (res.ok) {
        setAberto(false);
        router.refresh();
      }
    });
  }

  const inp =
    "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-leaf-500 focus:outline-none focus:ring-1 focus:ring-leaf-500 dark:border-zinc-700 dark:bg-zinc-950";

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-leaf-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-leaf-500"
      >
        <PackageCheck className="h-3.5 w-3.5" />
        Receber
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => !pending && setAberto(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Receber item</h3>
            <p className="mt-1 text-xs text-zinc-500">
              {item.especificacao}
              {item.unidade ? ` · ${item.unidade}` : ""}
            </p>
            <p className="mt-2 rounded-md bg-leaf-50 px-3 py-2 text-xs text-leaf-800 dark:bg-leaf-950/30 dark:text-leaf-300">
              Ao confirmar, a quantidade entra em estoque como um lote do insumo escolhido e o item sai
              do módulo de recebimento. O lote entra no insumo escolhido.
            </p>

            <form action={action} className="mt-4 grid grid-cols-2 gap-3">
              <input type="hidden" name="item_id" value={item.id} />
              <input type="hidden" name="pedido_interno_id" value={item.pedidoId} />

              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Insumo de estoque <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setModo("")}
                    className={`rounded-md px-2 py-1 ${modo === "" ? "bg-leaf-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                  >
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setModo("novo")}
                    className={`rounded-md px-2 py-1 ${modo === "novo" ? "bg-leaf-600 text-white" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}
                  >
                    Cadastrar novo
                  </button>
                </div>
                {modo === "" ? (
                  <select name="insumo_id" defaultValue={item.insumoId ?? ""} className={inp}>
                    <option value="">— selecione —</option>
                    {insumos.map((insumo) => (
                      <option key={insumo.id} value={insumo.id}>
                        {insumo.especificacao}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name="novo_insumo"
                    defaultValue={item.especificacao}
                    placeholder="Especificação do novo insumo"
                    className={inp}
                  />
                )}
              </div>

              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  name="quantidade"
                  type="number"
                  step="any"
                  min="0"
                  defaultValue={item.quantidade}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Unidade</label>
                <input name="unidade" defaultValue={item.unidade ?? ""} className={inp} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Validade</label>
                <input name="validade" type="date" className={inp} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Código do lote</label>
                <input name="codigo" type="text" className={inp} />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Custo unitário (R$)</label>
                <input
                  name="custo"
                  type="number"
                  step="0.0001"
                  min="0"
                  defaultValue={item.orcamentoPrevio ?? ""}
                  className={inp}
                />
              </div>
              <div className="col-span-1">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fornecedor</label>
                <input name="fornecedor" type="text" defaultValue={item.fornecedorSugerido ?? ""} className={inp} />
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
                  className="rounded-md bg-leaf-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-leaf-500 disabled:opacity-50"
                >
                  {pending ? "Recebendo…" : "Confirmar recebimento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
