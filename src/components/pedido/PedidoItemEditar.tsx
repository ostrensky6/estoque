"use client";

import { Pencil } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { editarItemPedidoInterno } from "@/lib/actions/pedidos-internos";

type Insumo = { id: number; especificacao: string | null };

export type PedidoItemEdit = {
  id: number;
  tipo: string;
  especificacao: string;
  modelo: string | null;
  volume: string | null;
  quantidade: number;
  unidade: string | null;
  orcamento_previo: number | null;
  fornecedor_sugerido: string | null;
  observacao: string | null;
  insumo_id: number | null;
};

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export function PedidoItemEditar({
  pedidoId,
  item,
  insumos,
}: {
  pedidoId: number;
  item: PedidoItemEdit;
  insumos: Insumo[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:underline dark:text-zinc-300">
          <Pencil className="h-3.5 w-3.5" />
          Editar
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
          <DialogDescription>Atualize a especificação, quantidade e demais dados.</DialogDescription>
        </DialogHeader>
        <form action={editarItemPedidoInterno} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="item_id" value={item.id} />
          <input type="hidden" name="pedido_interno_id" value={pedidoId} />
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Tipo</label>
            <select name="tipo" defaultValue={item.tipo} className={inputCls}>
              <option value="material">Material</option>
              <option value="servico">Serviço</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Insumo existente</label>
            <select name="insumo_id" defaultValue={item.insumo_id ?? ""} className={inputCls}>
              <option value="">—</option>
              {insumos.map((insumo) => (
                <option key={insumo.id} value={insumo.id}>{insumo.especificacao}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Especificação</label>
            <input name="especificacao" required defaultValue={item.especificacao} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Modelo</label>
            <input name="modelo" defaultValue={item.modelo ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Volume</label>
            <input name="volume" defaultValue={item.volume ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Qtd</label>
            <input name="quantidade" type="number" min="0.0001" step="any" required defaultValue={item.quantidade} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Unidade</label>
            <input name="unidade" defaultValue={item.unidade ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Orçamento prévio un.</label>
            <input name="orcamento_previo" type="number" min="0" step="0.01" defaultValue={item.orcamento_previo ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Fornecedor sugerido</label>
            <input name="fornecedor_sugerido" defaultValue={item.fornecedor_sugerido ?? ""} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-[10px] uppercase tracking-wide text-zinc-400">Observação</label>
            <input name="observacao" defaultValue={item.observacao ?? ""} className={inputCls} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Cancelar
              </button>
            </DialogClose>
            <DialogClose asChild>
              <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                Salvar item
              </button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
