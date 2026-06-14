"use client";

import { useState } from "react";

/**
 * Botão que abre um modal de confirmação antes de submeter uma Server Action.
 * A action é passada como prop (padrão suportado pelo Next: `<form action={...}>`)
 * e recebe os `fields` como inputs ocultos. Use para exclusões de entidades-raiz
 * (orçamento, plano, projeto…) onde um clique acidental seria custoso.
 */
export function ConfirmActionButton({
  action,
  fields,
  trigger,
  titulo,
  mensagem,
  confirmLabel = "Excluir",
  destrutivo = true,
  triggerClassName = "text-xs text-zinc-400 hover:text-red-600",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string | number>;
  trigger: string;
  titulo: string;
  mensagem: string;
  confirmLabel?: string;
  destrutivo?: boolean;
  triggerClassName?: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setAberto(true)} className={triggerClassName}>
        {trigger}
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAberto(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">{titulo}</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{mensagem}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <form action={action}>
                {Object.entries(fields).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={String(v)} />
                ))}
                <button
                  className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${
                    destrutivo ? "bg-red-600 hover:bg-red-500" : "bg-brand-600 hover:bg-brand-500"
                  }`}
                >
                  {confirmLabel}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
