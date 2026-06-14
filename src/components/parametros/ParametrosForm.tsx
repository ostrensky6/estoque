"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { salvarParametros } from "@/lib/actions/parametros";
import type { FormState } from "@/lib/actions/cadastros";

type Param = { chave: string; valor: number; unidade: string | null; descricao: string | null };

const FATORES = ["margem_lucro", "impostos", "taxas", "fundo_reserva", "fundo_investimento"] as const;

const LABEL: Record<string, string> = {
  margem_lucro: "Margem de lucro",
  impostos: "Impostos",
  taxas: "Taxas administrativas",
  fundo_reserva: "Fundo de reserva",
  fundo_investimento: "Fundo de investimento",
};

const num = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

const inp =
  "mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-950";
const lbl = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";
const sec = "text-sm font-semibold uppercase tracking-wide text-zinc-500";

export function ParametrosForm({ params }: { params: Param[] }) {
  const router = useRouter();
  const byKey = Object.fromEntries(params.map((p) => [p.chave, p]));
  const [state, action, pending] = useActionState<FormState, FormData>(salvarParametros, {
    ok: false,
  });

  // estado controlado só dos 5 fatores, para somar ao vivo
  const [fatores, setFatores] = useState<Record<string, string>>(
    Object.fromEntries(FATORES.map((k) => [k, String(byKey[k]?.valor ?? 0)])),
  );
  const soma = FATORES.reduce((a, k) => a + (parseFloat(fatores[k]) || 0), 0);
  const multiplicador = 1 + soma / 100;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="space-y-8">
      {/* Fatores de preço */}
      <section>
        <h2 className={sec}>Fatores de preço</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Aplicados sobre o custo total para chegar ao preço de venda:{" "}
          <span className="font-medium text-zinc-500">preço = custo × (1 + soma ÷ 100)</span>.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FATORES.map((k) => (
            <div key={k}>
              <label className={lbl}>{LABEL[k]} (%)</label>
              <input
                name={k}
                type="number"
                min="0"
                step="0.1"
                value={fatores[k]}
                onChange={(e) => setFatores((f) => ({ ...f, [k]: e.target.value }))}
                className={inp}
              />
              {byKey[k]?.descricao && (
                <p className="mt-1 text-[11px] text-zinc-400">{byKey[k]?.descricao}</p>
              )}
            </div>
          ))}
        </div>

        <div
          className={`mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border px-4 py-3 text-sm ${
            soma === 0
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
          }`}
        >
          <span>
            Soma dos fatores: <b className="tabular-nums">{num(soma)}%</b>
          </span>
          <span>
            Multiplicador de preço: <b className="tabular-nums">×{num(multiplicador, 3)}</b>
          </span>
          {soma === 0 && <span className="text-xs">Com 0%, o preço é igual ao custo total.</span>}
        </div>
      </section>

      {/* Parâmetro de cálculo */}
      <section>
        <h2 className={sec}>Parâmetro de cálculo</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={lbl}>Dias úteis por ano</label>
            <input
              name="dias_uteis_ano"
              type="number"
              min="1"
              step="1"
              defaultValue={byKey.dias_uteis_ano?.valor ?? 222}
              className={inp}
            />
            <p className="mt-1 text-[11px] text-zinc-400">
              Rateio da depreciação de equipamentos por dia.
            </p>
          </div>
        </div>
      </section>

      {/* Referência */}
      <section>
        <h2 className={sec}>Referência</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Valores de referência — o cálculo usa as horas individuais de cada técnico e item de
          overhead, não estes globais.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={lbl}>Horas-base/mês por técnico</label>
            <input
              name="horas_mes_tecnico"
              type="number"
              min="0"
              step="1"
              defaultValue={byKey.horas_mes_tecnico?.valor ?? 170}
              className={inp}
            />
          </div>
          <div>
            <label className={lbl}>Horas de bancada/mês</label>
            <input
              name="horas_bancada_mes"
              type="number"
              min="0"
              step="1"
              defaultValue={byKey.horas_bancada_mes?.valor ?? 450}
              className={inp}
            />
          </div>
        </div>
      </section>

      {state.message && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            state.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {state.message}
        </p>
      )}

      <div>
        <button
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Salvar parâmetros"}
        </button>
      </div>
    </form>
  );
}
