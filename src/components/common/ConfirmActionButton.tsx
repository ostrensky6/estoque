"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function BotaoConfirmar({ label, destrutivo }: { label: string; destrutivo: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`rounded-md px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${
        destrutivo ? "bg-destructive hover:bg-destructive/90" : "bg-brand-600 hover:bg-brand-500"
      }`}
    >
      {pending ? "Processando…" : label}
    </button>
  );
}

/**
 * Botão que abre um diálogo de confirmação antes de submeter uma Server Action.
 * A action é passada como prop (padrão suportado pelo Next: `<form action={...}>`)
 * e recebe os `fields` como inputs ocultos. Use para exclusões de entidades-raiz
 * e ações irreversíveis (emitir, revisar, cancelar) onde um clique acidental seria custoso.
 * O diálogo (Radix) prende o foco, fecha com Esc e devolve o foco ao botão.
 */
export function ConfirmActionButton({
  action,
  fields,
  trigger,
  titulo,
  mensagem,
  confirmLabel = "Excluir",
  destrutivo = true,
  disabled = false,
  triggerClassName = "text-xs text-muted-foreground/80 hover:text-danger-strong",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string | number>;
  trigger: ReactNode;
  titulo: string;
  mensagem: ReactNode;
  confirmLabel?: string;
  destrutivo?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
}) {
  const [aberto, setAberto] = useState(false);

  async function confirmar(formData: FormData) {
    await action(formData);
    setAberto(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} className={triggerClassName}>
          {trigger}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm text-left" showCloseButton={false}>
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
          <form action={confirmar}>
            {Object.entries(fields).map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={String(v)} />
            ))}
            <BotaoConfirmar label={confirmLabel} destrutivo={destrutivo} />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
