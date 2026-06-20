"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CATALOGO, PAPEIS, PAPEL_ADMIN } from "@/lib/auth/capacidades";
import { definirPermissao } from "@/lib/actions/privilegios";

export function PrivilegiosMatriz({ matriz }: { matriz: Record<string, boolean> }) {
  const [estado, setEstado] = useState(matriz);
  const [pending, startTransition] = useTransition();

  function alternar(papel: string, chave: string, atual: boolean) {
    const chaveMapa = `${papel}::${chave}`;
    setEstado((s) => ({ ...s, [chaveMapa]: !atual }));
    startTransition(async () => {
      const res = await definirPermissao(papel, chave, !atual);
      if (!res.ok) {
        setEstado((s) => ({ ...s, [chaveMapa]: atual }));
        toast.error(res.message ?? "Falha ao salvar.");
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-zinc-950/40">
          <tr>
            <th className="px-4 py-3 text-left">Capacidade</th>
            {PAPEIS.map((p) => (
              <th key={p} className="px-3 py-3 text-center capitalize">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
          {CATALOGO.map((mod) => (
            <FragmentModulo
              key={mod.modulo}
              modulo={mod.modulo}
              linhas={mod.capacidades}
              estado={estado}
              pending={pending}
              onToggle={alternar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FragmentModulo({
  modulo,
  linhas,
  estado,
  pending,
  onToggle,
}: {
  modulo: string;
  linhas: { chave: string; rotulo: string }[];
  estado: Record<string, boolean>;
  pending: boolean;
  onToggle: (papel: string, chave: string, atual: boolean) => void;
}) {
  return (
    <>
      <tr className="bg-slate-100/60 dark:bg-zinc-900/60">
        <td
          colSpan={PAPEIS.length + 1}
          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300"
        >
          {modulo}
        </td>
      </tr>
      {linhas.map((cap) => (
        <tr key={cap.chave}>
          <td className="px-4 py-2 font-medium">
            {cap.rotulo}
            <span className="ml-2 text-xs text-slate-400">{cap.chave}</span>
          </td>
          {PAPEIS.map((papel) => {
            const ehAdmin = papel === PAPEL_ADMIN;
            const marcado = ehAdmin ? true : estado[`${papel}::${cap.chave}`] === true;
            return (
              <td key={papel} className="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={ehAdmin || pending}
                  onChange={() => onToggle(papel, cap.chave, marcado)}
                  className="h-4 w-4 accent-brand-600"
                  aria-label={`${papel} ${cap.chave}`}
                />
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
