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

type Opcao = {
  id: number;
  nome: string | null;
  coordenador?: string | null;
  coordenador_nome?: string | null;
  coordenador_email?: string | null;
};

const inputCls =
  "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export function PedidoInternoCabecalhoAcoes({
  pedidoId,
  numero,
  titulo,
  projetoId,
  dataNecessidade,
  urgencia,
  tipoDemanda,
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
  tipoDemanda: string | null;
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
          <button className="inline-flex items-center gap-1 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
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
              <label className="block text-xs font-medium text-muted-foreground">Demanda</label>
              <input name="titulo" required defaultValue={titulo} className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Projeto</label>
                <select name="projeto_id" defaultValue={projetoId ?? ""} className={inputCls}>
                  <option value="">—</option>
                  {projetos.map((projeto) => (
                    <option key={projeto.id} value={projeto.id}>
                      {projeto.nome}
                      {projeto.coordenador_nome || projeto.coordenador ? ` · ${projeto.coordenador_nome ?? projeto.coordenador}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Necessidade</label>
                <input name="data_necessidade" type="date" defaultValue={dataNecessidade ?? ""} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Urgência</label>
                <select name="urgencia" defaultValue={urgencia ?? "normal"} className={inputCls}>
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Crítica</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Tipo</label>
                <select name="tipo_demanda" defaultValue={tipoDemanda ?? "laboratorio"} className={inputCls}>
                  <option value="laboratorio">Laboratório</option>
                  <option value="campo">Campo</option>
                  <option value="laboratorio_campo">Lab./campo</option>
                  <option value="administrativo">Administrativo</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Fonte provável</label>
              <input name="fonte_recurso" defaultValue={fonteRecurso ?? ""} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">Justificativa</label>
              <textarea name="justificativa" rows={3} defaultValue={justificativa ?? ""} className={inputCls} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button type="button" className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
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
            <button className="inline-flex items-center gap-1 rounded-md border border-danger-strong/30 px-3 py-1.5 text-xs font-medium text-danger-strong hover:bg-danger-soft">
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
                <button type="button" className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                  Cancelar
                </button>
              </DialogClose>
              <form action={excluirPedidoInterno}>
                <input type="hidden" name="pedido_interno_id" value={pedidoId} />
                <button type="submit" className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90">
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
