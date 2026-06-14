"use client";

import { useActionState } from "react";

import { prepararConviteUsuario } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const initialState = { ok: false, message: "" };

export function ConviteUsuarioForm() {
  const [state, action, pending] = useActionState(prepararConviteUsuario, initialState);

  return (
    <form action={action} className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <label className="block text-xs font-medium text-blue-900 dark:text-blue-200">Nome</label>
          <Input name="nome" className="mt-1 bg-white dark:bg-zinc-950" />
        </div>
        <div className="min-w-56 flex-1">
          <label className="block text-xs font-medium text-blue-900 dark:text-blue-200">E-mail</label>
          <Input name="email" type="email" required className="mt-1 bg-white dark:bg-zinc-950" />
        </div>
        <div>
          <label className="block text-xs font-medium text-blue-900 dark:text-blue-200">Papel inicial</label>
          <Select name="papel" defaultValue="tecnico" className="mt-1 h-9 bg-white dark:bg-zinc-950">
            <option value="tecnico">Técnico</option>
            <option value="coordenador">Coordenador</option>
            <option value="gestor">Gestor</option>
            <option value="admin">Admin</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Preparando" : "Preparar convite"}
        </Button>
      </div>
      <p className="mt-2 text-xs leading-5 text-blue-900/80 dark:text-blue-200/80">
        O envio real do convite por e-mail depende da configuração transacional. Por enquanto o app registra a pendência in-app para o administrador.
      </p>
      {state.message && (
        <p className={`mt-2 text-xs ${state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
