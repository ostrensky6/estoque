"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";

import { gerarRascunhosReposicao } from "@/lib/actions/compras";
import { Button } from "@/components/ui/button";

const initialState = { ok: true, message: "" };

export function GerarReposicaoButton() {
  const [state, action, pending] = useActionState(gerarRascunhosReposicao, initialState);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Button type="submit" size="sm" disabled={pending}>
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        Gerar rascunhos
      </Button>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600"}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
