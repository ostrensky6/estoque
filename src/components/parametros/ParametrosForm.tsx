"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarParametros } from "@/lib/actions/parametros";
import type { FormState } from "@/lib/actions/cadastros";

export type Param = {
  chave: string;
  valor: number;
  unidade: string | null;
  descricao: string | null;
};

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

// ordem de exibição preferida dentro de cada grupo (resto cai no fim, alfabético)
const ORDEM = [
  "margem_lucro",
  "impostos",
  "taxas",
  "fundo_reserva",
  "fundo_investimento",
  "dias_uteis_ano",
  "horas_mes_tecnico",
  "horas_bancada_mes",
  "janela_vencimento_dias",
];

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ordenar(a: Param, b: Param) {
  const ia = ORDEM.indexOf(a.chave);
  const ib = ORDEM.indexOf(b.chave);
  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;
  return a.chave.localeCompare(b.chave);
}

const inp =
  "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950";

export function ParametrosForm({ params }: { params: Param[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<FormState>({ ok: false });
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(params.map((p) => [p.chave, String(p.valor)])),
  );

  const fatores = useMemo(
    () => params.filter((p) => p.unidade === "%").sort(ordenar),
    [params],
  );
  const operacionais = useMemo(
    () => params.filter((p) => p.unidade !== "%").sort(ordenar),
    [params],
  );

  const somaFatores = fatores.reduce((acc, p) => {
    const v = Number(valores[p.chave]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  function set(chave: string, v: string) {
    setValores((prev) => ({ ...prev, [chave]: v }));
  }

  function action(formData: FormData) {
    startTransition(async () => {
      const res = await salvarParametros({ ok: false }, formData);
      setState(res);
      if (res.ok) router.refresh();
    });
  }

  // função (não componente) p/ não criar fronteira de remontagem a cada tecla
  const campo = (p: Param) => {
    const passo = p.unidade === "%" ? "0.01" : "1";
    return (
      <div key={p.chave}>
        <label
          htmlFor={`valor_${p.chave}`}
          className="block text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          {LABELS[p.chave] ?? p.chave}
          {p.unidade ? (
            <span className="ml-1 text-slate-400">({p.unidade})</span>
          ) : null}
        </label>
        <input
          id={`valor_${p.chave}`}
          name={`valor_${p.chave}`}
          type="number"
          inputMode="decimal"
          min="0"
          step={passo}
          value={valores[p.chave] ?? ""}
          onChange={(e) => set(p.chave, e.target.value)}
          className={inp}
        />
        {p.descricao && (
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            {p.descricao}
          </p>
        )}
        {state.errors?.[p.chave] && (
          <p className="mt-1 text-xs text-red-600">{state.errors[p.chave]}</p>
        )}
      </div>
    );
  };

  return (
    <form action={action} className="mt-6 space-y-6">
      <input type="hidden" name="chaves" value={params.map((p) => p.chave).join(",")} />

      {/* Fatores de preço */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Fatores de preço
          </h2>
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            markup total +{somaFatores.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Aplicados sobre o custo total para chegar ao preço de venda:{" "}
          <span className="font-medium">preço = custo × (1 + Σ fatores)</span>. Com
          todos em 0, o preço fica igual ao custo.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fatores.map((p) => campo(p))}
        </div>
        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-zinc-800/60 dark:text-slate-300">
          Exemplo: um custo de {brl(100)} vira{" "}
          <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {brl(100 * (1 + somaFatores / 100))}
          </span>{" "}
          de preço ao cliente.
        </div>
      </section>

      {/* Operacionais */}
      {operacionais.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Parâmetros operacionais
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Bases de rateio. <span className="font-medium">Dias úteis por ano</span>{" "}
            divide a depreciação/manutenção dos equipamentos por dia.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {operacionais.map((p) => campo(p))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar parâmetros"}
        </button>
        {state.message && (
          <span
            className={`text-sm ${
              state.ok
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
