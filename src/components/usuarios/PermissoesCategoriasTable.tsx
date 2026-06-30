"use client";

import { useActionState, useState } from "react";

import { salvarPermissoesCategoria } from "@/lib/actions/usuarios";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSOES, PAPEIS, type PapelUsuario, type PermissaoUsuario } from "@/lib/auth/permissions";
import type { FormState } from "@/lib/actions/cadastros";

const initial: FormState = { ok: false, message: "" };

type PermissoesPorCategoria = Record<PapelUsuario, Record<PermissaoUsuario, boolean>>;

export function PermissoesCategoriasTable({ permissoesPorCategoria }: { permissoesPorCategoria: PermissoesPorCategoria }) {
  const [categoriaEditando, setCategoriaEditando] = useState<PapelUsuario | null>(null);
  const categoria = PAPEIS.find((papel) => papel.value === categoriaEditando);
  const [state, action, pending] = useActionState(salvarPermissoesCategoria, initial);

  return (
    <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Tabela de permissões por categoria</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Edite os padrões por categoria aqui. Usuários específicos continuam podendo ter ajustes em Editar.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/50">
            <tr>
              <th className="px-3 py-3 text-left">Permissão</th>
              {PAPEIS.map((papel) => (
                <th key={papel.value} className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span>{papel.label}</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setCategoriaEditando(papel.value)}>
                      Editar
                    </Button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {PERMISSOES.map((permissao) => (
              <tr key={permissao.key}>
                <td className="px-3 py-3">
                  <p className="font-medium text-zinc-800 dark:text-zinc-100">{permissao.modulo} · {permissao.label}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{permissao.descricao}</p>
                </td>
                {PAPEIS.map((papel) => {
                  const permitido = permissoesPorCategoria[papel.value][permissao.key];
                  return (
                    <td key={`${permissao.key}-${papel.value}`} className="px-3 py-3 text-center">
                      <span className={permitido ? "font-semibold text-brand-700 dark:text-brand-300" : "text-zinc-300 dark:text-zinc-700"}>
                        {permitido ? "Sim" : "Não"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(categoria)} onOpenChange={(open) => setCategoriaEditando(open ? categoriaEditando : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar permissões: {categoria?.label}</DialogTitle>
            <DialogDescription>
              Essas permissões serão usadas como padrão para novos usuários desta categoria.
            </DialogDescription>
          </DialogHeader>
          {categoria && (
            <form action={action} className="space-y-4">
              <input type="hidden" name="papel" value={categoria.value} />
              <div className="grid gap-2 md:grid-cols-2">
                {PERMISSOES.map((permissao) => (
                  <label key={permissao.key} className="flex items-start gap-2 rounded-md border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                    <Checkbox
                      name="permissoes"
                      value={permissao.key}
                      defaultChecked={permissoesPorCategoria[categoria.value][permissao.key]}
                      disabled={categoria.value === "admin"}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block font-semibold text-zinc-800 dark:text-zinc-100">{permissao.modulo} · {permissao.label}</span>
                      <span className="block leading-4 text-zinc-500">{permissao.descricao}</span>
                    </span>
                  </label>
                ))}
              </div>
              {state.message && (
                <p className={`text-xs ${state.ok ? "text-brand-700 dark:text-brand-300" : "text-red-600"}`}>{state.message}</p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Salvando..." : "Salvar permissões"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

export type { PermissoesPorCategoria };
