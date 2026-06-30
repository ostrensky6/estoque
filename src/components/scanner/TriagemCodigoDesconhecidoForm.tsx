"use client";

import { useActionState } from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { criarTriagemCodigoDesconhecido } from "@/lib/actions/cadastros-triagem";
import { Button } from "@/components/ui/button";

const initialState = { ok: false, message: "" };

export function TriagemCodigoDesconhecidoForm({ codigo }: { codigo: string }) {
  const [state, formAction, pending] = useActionState(
    criarTriagemCodigoDesconhecido,
    initialState,
  );

  return (
    <form action={formAction} className="mt-6 grid gap-3">
      <input type="hidden" name="codigo" value={codigo} />
      <Button type="submit" disabled={pending || codigo.trim().length === 0}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ClipboardList className="h-4 w-4" />
        )}
        Registrar triagem
      </Button>
      {!state.ok && state.message && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          {state.message}
        </p>
      )}
    </form>
  );
}
