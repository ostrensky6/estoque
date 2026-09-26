"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Botão de envio que pede confirmação antes de submeter o formulário em que está.
 * Diferente de `ConfirmActionButton`, preserva os campos visíveis do formulário
 * (validade, responsável, status…) e a validação nativa do navegador.
 * Use em ações irreversíveis: emitir, bloquear edição, cancelar.
 */
export function ConfirmSubmitButton({
  children,
  titulo,
  mensagem,
  confirmLabel,
  destrutivo = false,
  disabled = false,
  className,
}: {
  children: ReactNode;
  titulo: string;
  mensagem: ReactNode;
  confirmLabel: string;
  destrutivo?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  const [aberto, setAberto] = useState(false);
  const { pending } = useFormStatus();

  return (
    <>
      <button
        ref={botao}
        type="submit"
        disabled={disabled || pending}
        className={className}
        onClick={(evento) => {
          evento.preventDefault();
          const form = botao.current?.form;
          if (form && !form.reportValidity()) return;
          setAberto(true);
        }}
      >
        {pending ? "Processando…" : children}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent
          className="max-w-sm text-left"
          showCloseButton={false}
          onCloseAutoFocus={(evento) => {
            // Sem DialogTrigger o Radix não sabe de onde o diálogo veio: devolve o foco ao botão.
            evento.preventDefault();
            botao.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription asChild>
              <div>{mensagem}</div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setAberto(false);
                botao.current?.form?.requestSubmit(botao.current);
              }}
              className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${
                destrutivo ? "bg-destructive hover:bg-destructive/90" : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {confirmLabel}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
