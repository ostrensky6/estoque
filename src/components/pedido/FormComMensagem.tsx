"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/actions/cadastros";

type AcaoComEstado = (prev: FormState, formData: FormData) => Promise<FormState>;

/**
 * Formulário que mostra a mensagem de erro devolvida pela server action
 * (`{ ok: false, message }`) em vez de levar o usuário a uma tela de erro.
 * Pode ser usado dentro de páginas de servidor passando a action como prop.
 */
export function FormComMensagem({
  action,
  className,
  children,
  onSuccess,
}: {
  action: AcaoComEstado;
  className?: string;
  children: React.ReactNode;
  onSuccess?: () => void;
}) {
  const [state, formAction] = useActionState(async (prev: FormState, formData: FormData) => {
    const resultado = await action(prev, formData);
    if (resultado.ok) onSuccess?.();
    return resultado;
  }, { ok: false } as FormState);

  return (
    <form action={formAction} className={className}>
      {children}
      {!state.ok && state.message && (
        <p role="alert" className="basis-full text-xs font-medium text-danger-strong">
          {state.message}
          {state.errors && Object.keys(state.errors).length > 0 && (
            <span className="block font-normal">{Object.values(state.errors).join(" ")}</span>
          )}
        </p>
      )}
    </form>
  );
}
