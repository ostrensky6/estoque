"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarParametros } from "@/lib/actions/parametros";
import type { FormState } from "@/lib/actions/cadastros";
import { formatCurrency as brl, APP_LOCALE } from "@/lib/formatters";

export type Param = {
  chave: string;
  valor: number;
  unidade: string | null;
  descricao: string | null;
};

const FATORES = [
  "margem_lucro",
  "impostos",
  "taxas",
  "fundo_reserva",
  "fundo_investimento",
] as const;

const LABELS: Record<string, string> = {
  margem_lucro: "Margem de lucro",
  impostos: "Impostos",
  taxas: "Taxas administrativas",
  fundo_reserva: "Fundo de reserva",
  fundo_investimento: "Fundo de investimento",
  dias_uteis_ano: "Dias úteis por ano",
  horas_mes_tecnico: "Horas-base mensais por técnico",
  horas_bancada_mes: "Horas de bancada por mês",
  janela_vencimento_dias: "Janela de alerta de vencimento (dias)",
};

const ORDEM = [
  ...FATORES,
  "dias_uteis_ano",
  "horas_mes_tecnico",
  "horas_bancada_mes",
  "janela_vencimento_dias",
];

const num = (v: number, casas = 2) =>
  v.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });

const inp =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-950";
const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";
const sec = "text-sm font-semibold uppercase tracking-wide text-zinc-500";

function ordenar(a: Param, b: Param) {
  const ia = ORDEM.indexOf(a.chave);
  const ib = ORDEM.indexOf(b.chave);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.chave.localeCompare(b.chave);
}

export function ParametrosForm({ params }: { params: Param[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<FormState, FormData>(
    salvarParametros,
    { ok: false },
  );
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(params.map((p) => [p.chave, String(p.valor)])),
  );

  const fatores = useMemo(
    () => params.filter((p) => FATORES.includes(p.chave as (typeof FATORES)[number])).sort(ordenar),
    [params],
  );
  const operacionais = useMemo(
    () => params.filter((p) => !FATORES.includes(p.chave as (typeof FATORES)[number])).sort(ordenar),
    [params],
  );

  const somaFatores = fatores.reduce((acc, p) => {
    const v = Number(String(valores[p.chave] ?? "").replace(",", "."));
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
  const multiplicador = 1 + somaFatores / 100;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  function set(chave: string, value: string) {
    setValores((prev) => ({ ...prev, [chave]: value }));
  }

  function campo(p: Param) {
    const step = p.unidade === "%" ? "0.1" : "1";

    return (
      <div key={p.chave}>
        <label htmlFor={`valor_${p.chave}`} className={lbl}>
          {LABELS[p.chave] ?? p.chave}
          {p.unidade ? <span className="ml-1 text-zinc-400">({p.unidade})</span> : null}
        </label>
        <input
          id={`valor_${p.chave}`}
          name={`valor_${p.chave}`}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={valores[p.chave] ?? ""}
          onChange={(e) => set(p.chave, e.target.value)}
          className={inp}
        />
        {p.descricao && <p className="mt-1 text-[11px] text-zinc-400">{p.descricao}</p>}
        {state.errors?.[p.chave] && (
          <p className="mt-1 text-xs text-red-600">{state.errors[p.chave]}</p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="chaves" value={params.map((p) => p.chave).join(",")} />

      <section>
        <h2 className={sec}>Fatores de preço</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Aplicados sobre o custo total para chegar ao preço de venda:{" "}
          <span className="font-medium text-zinc-500">preço = custo x (1 + soma / 100)</span>.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fatores.map((p) => campo(p))}
        </div>

        <div
          className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm ${
            somaFatores === 0
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
              : "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/20 dark:text-brand-300"
          }`}
        >
          <span>
            Soma dos fatores: <b className="tabular-nums">{num(somaFatores)}%</b>
          </span>
          <span>
            Multiplicador de preço: <b className="tabular-nums">x{num(multiplicador, 3)}</b>
          </span>
          <span>
            Exemplo R$ 100: <b className="tabular-nums">{brl(100 * multiplicador)}</b>
          </span>
          {somaFatores === 0 && (
            <span className="text-xs">Com 0%, o preço é igual ao custo total.</span>
          )}
        </div>
      </section>

      {operacionais.length > 0 && (
        <section>
          <h2 className={sec}>Parâmetros operacionais</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Bases de rateio e constantes usadas por custeio, estoque e alertas.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {operacionais.map((p) => campo(p))}
          </div>
        </section>
      )}

      {state.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <div>
        <button
          disabled={pending}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar parâmetros"}
        </button>
      </div>
    </form>
  );
}
