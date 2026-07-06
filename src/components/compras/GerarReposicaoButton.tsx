"use client";

import { useActionState, useState } from "react";
import { RefreshCw } from "lucide-react";

import { gerarRascunhosReposicao } from "@/lib/actions/compras";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const initialState = { ok: true, message: "" };

export function GerarReposicaoButton() {
  const [state, action, pending] = useActionState(gerarRascunhosReposicao, initialState);
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Dialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
        <DialogTrigger asChild>
          <Button type="button" size="sm" disabled={pending}>
            <RefreshCw className={pending ? "animate-spin" : undefined} />
            Gerar rascunhos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Gerar rascunhos de reposição?</DialogTitle>
            <DialogDescription>
              Esta ação irá gerar rascunhos de compra para insumos abaixo do ponto de reposição,
              usando a previsão de suprimentos. Registros poderão ser criados no banco.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O sistema criará rascunhos de compra para insumos com reposição sugerida, descontando o
            que já estiver em pedido aberto. Revise os rascunhos em Compras antes de prosseguir com
            a compra.
          </p>
          <form action={action} onSubmit={() => setOpen(false)}>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                <RefreshCw className={pending ? "animate-spin" : undefined} />
                Gerar rascunhos
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-danger-strong"}`}>
          {state.message}
        </span>
      )}
    </div>
  );
}
