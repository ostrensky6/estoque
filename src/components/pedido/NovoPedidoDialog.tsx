"use client";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { criarPedidoInterno } from "@/lib/actions/pedidos-internos";

type ProjetoOption = {
  id: number;
  nome: string;
  coordenador?: string | null;
  coordenador_nome?: string | null;
  coordenador_email?: string | null;
};

const inputCls = "mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm";

export function NovoPedidoDialog({ projetos }: { projetos: ProjetoOption[] }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Novo pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            Registre a demanda inicial do laboratório ou campo. Os itens entram depois, no rascunho.
          </DialogDescription>
        </DialogHeader>
        <form action={criarPedidoInterno} className="grid gap-5">
          <section className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-12">
            <div className="md:col-span-12">
              <h3 className="text-sm font-semibold">Identificação da demanda</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O suficiente para o coordenador entender origem, urgência e contexto.
              </p>
            </div>
            <div className="md:col-span-6">
              <label htmlFor="novo-pedido-titulo" className="block text-xs font-medium text-muted-foreground">Demanda inicial</label>
              <input
                id="novo-pedido-titulo"
                name="titulo"
                required
                placeholder="Ex.: Reagentes para sequenciamento de junho"
                className={inputCls}
              />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="novo-pedido-projeto" className="block text-xs font-medium text-muted-foreground">Projeto</label>
              <select id="novo-pedido-projeto" name="projeto_id" defaultValue="" className={inputCls}>
                <option value="">—</option>
                {projetos.map((projeto) => (
                  <option key={projeto.id} value={projeto.id}>
                    {projeto.nome}
                    {projeto.coordenador_nome || projeto.coordenador
                      ? ` · ${projeto.coordenador_nome ?? projeto.coordenador}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4">
              <label htmlFor="novo-pedido-tipo" className="block text-xs font-medium text-muted-foreground">Tipo</label>
              <select id="novo-pedido-tipo" name="tipo_demanda" defaultValue="laboratorio" className={inputCls}>
                <option value="laboratorio">Laboratório</option>
                <option value="campo">Campo</option>
                <option value="laboratorio_campo">Lab./campo</option>
                <option value="administrativo">Administrativo</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <label htmlFor="novo-pedido-data" className="block text-xs font-medium text-muted-foreground">Necessidade</label>
              <input id="novo-pedido-data" name="data_necessidade" type="date" className={inputCls} />
            </div>
            <div className="md:col-span-4">
              <label htmlFor="novo-pedido-urgencia" className="block text-xs font-medium text-muted-foreground">Urgência</label>
              <select id="novo-pedido-urgencia" name="urgencia" defaultValue="normal" className={inputCls}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
          </section>

          <section className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold">Justificativa e recurso</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Esses dados destravam o envio para validação e reduzem retrabalho administrativo.
              </p>
            </div>
            <div>
              <label htmlFor="novo-pedido-fonte" className="block text-xs font-medium text-muted-foreground">Fonte provável</label>
              <input id="novo-pedido-fonte" name="fonte_recurso" placeholder="Projeto, convênio, recurso interno..." className={inputCls} />
            </div>
            <div>
              <label htmlFor="novo-pedido-justificativa" className="block text-xs font-medium text-muted-foreground">Justificativa</label>
              <input
                id="novo-pedido-justificativa"
                name="justificativa"
                placeholder="Experimentos, análises ou problema que originou a compra"
                className={inputCls}
              />
            </div>
          </section>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">Criar rascunho</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
