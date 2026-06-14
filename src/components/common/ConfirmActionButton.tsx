"use client";

import { useState } from "react";

type Field = { name: string; value: string | number };

/**
 * Botão que pede confirmação num modal custom (sem `confirm()` nativo) antes de
 * submeter uma Server Action destrutiva. A ação é passada como prop e invocada
 * via `<form action>` — mantém progressive enhancement e o contexto de auth.
 */
export function ConfirmActionButton({
  action,
  fields = [],
  trigger,
  triggerClassName,
  title,
  body,
  confirmLabel = "Confirmar",
  danger = true,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields?: Field[];
  trigger: string;
  triggerClassName?: string;
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        {trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 text-left">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <form action={action}>
                {fields.map((f) => (
                  <input key={f.name} type="hidden" name={f.name} value={f.value} />
                ))}
                <button
                  className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${
                    danger
                      ? "bg-red-600 hover:bg-red-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
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
