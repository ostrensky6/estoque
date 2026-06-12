"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Campo, Coluna } from "@/lib/cadastros/config";
import {
  salvarRegistro,
  excluirRegistro,
  type FormState,
} from "@/lib/actions/cadastros";

type Registro = Record<string, unknown>;

const brl = (v: unknown) =>
  Number(v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function fmt(value: unknown, tipo?: Coluna["tipo"]) {
  if (value == null || value === "") return "—";
  switch (tipo) {
    case "currency":
      return brl(value);
    case "percent":
      return `${Number(value).toLocaleString("pt-BR")}%`;
    case "number":
      return Number(value).toLocaleString("pt-BR");
    case "checkbox":
      return value ? "Sim" : "Não";
    default:
      return String(value);
  }
}

export function CrudShell({
  slug,
  singular,
  rotulo,
  colunas,
  campos,
  rows,
}: {
  slug: string;
  singular: string;
  rotulo: string;
  colunas: Coluna[];
  campos: Campo[];
  rows: Registro[];
}) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);

  function novo() {
    setEditando(null);
    setAberto(true);
  }
  function editar(r: Registro) {
    setEditando(r);
    setAberto(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-400">{rows.length} registro(s)</p>
        <button
          onClick={novo}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-500"
        >
          + Novo {singular}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
            <tr>
              {colunas.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 ${c.alinhar === "right" ? "text-right" : "text-left"} ${c.calculada ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {c.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                {colunas.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-2.5 ${c.alinhar === "right" ? "text-right tabular-nums" : "text-left"} ${c.calculada ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}
                  >
                    {fmt(r[c.key], c.tipo)}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => editar(r)}
                    className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  >
                    Editar
                  </button>
                  <DeleteButton slug={slug} id={r.id as number} rotulo={String(r[rotulo] ?? "")} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colunas.length + 1} className="px-4 py-10 text-center text-zinc-400">
                  Nenhum registro. Clique em “Novo {singular}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberto && (
        <Drawer
          slug={slug}
          singular={singular}
          campos={campos}
          registro={editando}
          onClose={() => setAberto(false)}
        />
      )}
    </div>
  );
}

function DeleteButton({ slug, id, rotulo }: { slug: string; id: number; rotulo: string }) {
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [state, action, pending] = useActionState<FormState, FormData>(
    excluirRegistro,
    { ok: false },
  );
  useEffect(() => {
    // sucesso: a linha some no refresh e este modal desmonta junto.
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <>
      <button
        onClick={() => setConfirmar(true)}
        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
      >
        Excluir
      </button>

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !pending && setConfirmar(false)}
          />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-6 text-left shadow-xl dark:bg-zinc-900">
            <h3 className="text-base font-semibold">Excluir registro</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Tem certeza que deseja excluir <b>“{rotulo}”</b>? Esta ação não pode
              ser desfeita.
            </p>
            {state.message && !state.ok && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {state.message}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmar(false)}
                disabled={pending}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <form action={action}>
                <input type="hidden" name="_slug" value={slug} />
                <input type="hidden" name="_id" value={id} />
                <button
                  disabled={pending}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {pending ? "Excluindo…" : "Excluir"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Drawer({
  slug,
  singular,
  campos,
  registro,
  onClose,
}: {
  slug: string;
  singular: string;
  campos: Campo[];
  registro: Registro | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(
    salvarRegistro,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state.ok, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {registro ? `Editar ${singular}` : `Novo ${singular}`}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            ✕
          </button>
        </div>

        <form action={action} className="mt-6 grid grid-cols-2 gap-4">
          <input type="hidden" name="_slug" value={slug} />
          {registro?.id != null && (
            <input type="hidden" name="_id" value={String(registro.id)} />
          )}

          {campos.map((c) => (
            <CampoInput
              key={c.name}
              campo={c}
              valor={registro?.[c.name]}
              erro={state.errors?.[c.name]}
            />
          ))}

          {state.message && !state.ok && (
            <p className="col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {state.message}
            </p>
          )}

          <div className="col-span-2 mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
            <button
              disabled={pending}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampoInput({
  campo,
  valor,
  erro,
}: {
  campo: Campo;
  valor: unknown;
  erro?: string;
}) {
  const base =
    "mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm dark:bg-zinc-950 " +
    (erro
      ? "border-red-400 focus:border-red-500"
      : "border-zinc-300 focus:border-emerald-500 dark:border-zinc-700") +
    " focus:outline-none focus:ring-1 focus:ring-emerald-500";
  const span = campo.colSpan === 2 ? "col-span-2" : "col-span-1";
  const v = valor == null ? "" : String(valor);

  return (
    <div className={span}>
      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {campo.label}
        {campo.obrigatorio && <span className="text-red-500"> *</span>}
      </label>

      {campo.tipo === "select" ? (
        <select name={campo.name} defaultValue={v} className={base}>
          <option value="">—</option>
          {campo.opcoes?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === "checkbox" ? (
        <div className="mt-2">
          <input
            type="checkbox"
            name={campo.name}
            defaultChecked={Boolean(valor)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600"
          />
        </div>
      ) : (
        <input
          name={campo.name}
          defaultValue={v}
          placeholder={campo.placeholder}
          type={
            campo.tipo === "date"
              ? "date"
              : campo.tipo === "text"
                ? "text"
                : "number"
          }
          step={
            campo.step ??
            (campo.tipo === "currency"
              ? "0.01"
              : campo.tipo === "percent"
                ? "0.1"
                : undefined)
          }
          min={campo.min}
          max={campo.max}
          className={base}
        />
      )}

      {erro ? (
        <p className="mt-1 text-xs text-red-600">{erro}</p>
      ) : campo.ajuda ? (
        <p className="mt-1 text-xs text-zinc-400">{campo.ajuda}</p>
      ) : null}
    </div>
  );
}
