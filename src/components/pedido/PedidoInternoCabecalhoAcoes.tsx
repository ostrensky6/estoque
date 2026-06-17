"use client";

import { Pencil, Trash2 } from "lucide-react";

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
import { atualizarPedidoInterno, excluirPedidoInterno } from "@/lib/actions/pedidos-internos";

type Opcao = { id: number; nome: string | null };

const inputCls =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";

export function PedidoInternoCabecalhoAcoes({
  pedidoId,
  numero,
  titulo,
  projetoId,
  dataNecessidade,
  urgencia,
  fonteRecurso,
  justificativa,
  projetos,
  podeExcluir,
}: {
  pedidoId: number;
  numero: string;
  titulo: string;
  projetoId: number | null;
  dataNecessidade: string | null;
  urgencia: string | null;
  fonteRecurso: string | null;
  justificativa: string | null;
  projetos: Opcao[];
  podeExcluir: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Editar */}
      <Dialog>
        <DialogTrigger asChild>
          <button className="inline-flex items-center gap-1 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar pedido {numero}</DialogTitle>
            <DialogDescription>Atualize os dados gerais da demanda.</DialogDescription>
          </DialogHeader>
          <form action={atualizarPedidoInterno} className="grid gap-3">
            <input type="hidden" name="pedido_interno_id" value={pedidoId} />
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Demanda</label>
              <input name="titulo" required defaultValue={titulo} className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Projeto</label>
                <select name="projeto_id" defaultValue={projetoId ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>{projeto.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Necessidade</label>
                <input name="data_necessidade" type="date" defaultValue={dataNecessidade ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Urgência</label>
                <select name="urgencia" defaultValue={urgencia ?? "normal"} className={inputCls}>
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Fonte provável</label>
              <input name="fonte_recurso" defaultValue={fonteRecurso ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">Justificativa</label>
              <textarea name="justificativa" rows={3} defaultValue={justificativa ?? ""} className={inputCls} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancelar
                </button>
              </DialogClose>
              <DialogClose asChild>
                <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500">
                  Salvar alterações
                </button>
              </DialogClose>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Excluir */}
      {podeExcluir && (
        <Dialog>
          <DialogTrigger asChild>
            <button className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30">
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir pedido {numero}?</DialogTitle>
              <DialogDescription>
                Esta ação remove o pedido <b>{titulo}</b> e todos os seus itens, anexos e comunicações. Não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <button type="button" className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Cancelar
                </button>
              </DialogClose>
              <form action={excluirPedidoInterno}>
                <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                <button type="submit" className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500">
                  Excluir definitivamente
                </button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
