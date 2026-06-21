"use client";

import { useActionState } from "react";
import {
  salvarParametrosEconomicos,
  type ParametrosEconomicosState,
} from "@/lib/actions/orcamentos";
import { TOM_ENTRADA } from "@/lib/orcamento/tom-valor";

type ParametroCampo = {
  chave:
    | "dias_uteis_ano"
    | "margem_lucro"
    | "impostos"
    | "taxas"
    | "fundo_reserva"
    | "fundo_investimento";
  label: string;
  ajuda: string;
  unidade: string;
  step: string;
  min: string;
  max?: string;
};

const CAMPOS: ParametroCampo[] = [
  {
    chave: "dias_uteis_ano",
    label: "Dias úteis por ano",
    ajuda: "Base anual usada para ratear depreciação e manutenção dos equipamentos.",
    unidade: "dias",
    step: "1",
    min: "1",
  },
  {
    chave: "margem_lucro",
    label: "Margem de lucro",
    ajuda: "Percentual aplicado sobre o custo total da análise.",
    unidade: "%",
    step: "0.1",
    min: "0",
    max: "100",
  },
  {
    chave: "impostos",
    label: "Impostos",
    ajuda: "Percentual de tributos considerado no preço final.",
    unidade: "%",
    step: "0.1",
    min: "0",
    max: "100",
  },
  {
    chave: "taxas",
    label: "Taxas administrativas",
    ajuda: "Encargos administrativos adicionados ao orçamento.",
    unidade: "%",
    step: "0.1",
    min: "0",
    max: "100",
  },
  {
    chave: "fundo_reserva",
    label: "Fundo de reserva",
    ajuda: "Percentual destinado a cobertura de variações e contingências.",
    unidade: "%",
    step: "0.1",
    min: "0",
    max: "100",
  },
  {
    chave: "fundo_investimento",
    label: "Fundo de investimento",
    ajuda: "Percentual para reinvestimento em estrutura e capacidade.",
    unidade: "%",
    step: "0.1",
    min: "0",
    max: "100",
  },
];

export function ParametrosEconomicosForm({
  valores,
}: {
  valores: Record<ParametroCampo["chave"], number>;
}) {
  const [state, action, pending] = useActionState<
    ParametrosEconomicosState,
    FormData
  >(salvarParametrosEconomicos, { ok: false });

  // §8.2: o percentual/valor que o usuário define é entrada -> azul (TOM_ENTRADA).
  const inputBase =
    `mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm font-medium tabular-nums dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-brand-500 ${TOM_ENTRADA}`;

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS.map((campo) => {
          const erro = state.errors?.[campo.chave];
          return (
            <div
              key={campo.chave}
              className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <label
                htmlFor={campo.chave}
                className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100"
              >
                {campo.label}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={campo.chave}
                  name={campo.chave}
                  type="number"
                  suppressHydrationWarning
                  step={campo.step}
                  min={campo.min}
                  max={campo.max}
                  defaultValue={valores[campo.chave]}
                  className={`${inputBase} ${
                    erro
                      ? "border-red-400 focus:border-red-500"
                      : "border-zinc-300 focus:border-brand-500 dark:border-zinc-700"
                  }`}
                />
                <span className="min-w-10 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-2 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950">
                  {campo.unidade}
                </span>
              </div>
              {erro ? (
                <p className="mt-2 text-xs text-red-600">{erro}</p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  {campo.ajuda}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {state.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <div className="flex justify-end">
        <button
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-500 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar parâmetros"}
        </button>
      </div>
    </form>
  );
}
