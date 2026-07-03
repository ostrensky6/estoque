"use client";

import { useActionState } from "react";

import { criarUsuario } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PAPEIS } from "@/lib/auth/permissions";
import type { FormState } from "@/lib/actions/cadastros";

const initialState: FormState = { ok: false, message: "" };

export function CriarUsuarioForm() {
  const [state, action, pending] = useActionState(criarUsuario, initialState);

  return (
    <form
      action={action}
      className="mt-6 rounded-lg border border-info-strong/30 bg-info-soft p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52 flex-1">
          <label className="block text-xs font-medium text-info-strong">Nome</label>
          <Input name="nome" className="mt-1 bg-card" />
        </div>
        <div className="min-w-56 flex-1">
          <label className="block text-xs font-medium text-info-strong">E-mail</label>
          <Input name="email" type="email" required className="mt-1 bg-card" />
        </div>
        <div>
          <label className="block text-xs font-medium text-info-strong">Categoria inicial</label>
          <Select name="papel" defaultValue="tecnico" className="mt-1 h-9 bg-card">
            {PAPEIS.map((papel) => (
              <option key={papel.value} value={papel.value}>
                {papel.label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar usuário"}
        </Button>
      </div>
      <p className="mt-2 text-xs leading-5 text-info-strong/80">
        O usuário é criado já com acesso, usando uma senha provisória. No primeiro acesso ele é
        obrigado a definir uma senha definitiva. As permissões iniciais seguem a categoria escolhida.
      </p>
      {state.message && (
        <p className={`mt-2 text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-danger-strong"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
