import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { ParametrosEconomicosForm } from "@/components/orcamento/ParametrosEconomicosForm";
import {
  formatCurrency as brl,
  formatNumber,
  formatDateTime,
  APP_LOCALE,
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

const pct = (v: number) =>
  `${v.toLocaleString(APP_LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;

const PARAM_KEYS = [
  "dias_uteis_ano",
  "margem_lucro",
  "impostos",
  "taxas",
  "fundo_reserva",
  "fundo_investimento",
] as const;

type ParamKey = (typeof PARAM_KEYS)[number];

const DEFAULTS: Record<ParamKey, number> = {
  dias_uteis_ano: 222,
  margem_lucro: 0,
  impostos: 0,
  taxas: 0,
  fundo_reserva: 0,
  fundo_investimento: 0,
};

export default async function ParametrosEconomicosPage() {
  const supabase = await createClient();
  const [{ data: parametros }, { breakdowns, params }] = await Promise.all([
    supabase.from("parametros").select("chave, valor, atualizado_em"),
    calcularTodas(),
  ]);

  const valores = { ...DEFAULTS };
  const atualizadoEm = new Map<string, string>();
  for (const p of parametros ?? []) {
    if (PARAM_KEYS.includes(p.chave as ParamKey)) {
      valores[p.chave as ParamKey] = Number(p.valor);
      if (p.atualizado_em) atualizadoEm.set(p.chave, p.atualizado_em);
    }
  }

  const fatorTotal =
    params.margem_lucro +
    params.impostos +
    params.taxas +
    params.fundo_reserva +
    params.fundo_investimento;
  const custoMedio =
    breakdowns.length > 0
      ? breakdowns.reduce((acc, b) => acc + b.custoTotal, 0) / breakdowns.length
      : 0;
  const precoMedio =
    breakdowns.length > 0
      ? breakdowns.reduce((acc, b) => acc + b.preco, 0) / breakdowns.length
      : 0;
  const ultimaAtualizacao = [...atualizadoEm.values()].sort().at(-1);

  const analisesPreview = [...breakdowns]
    .sort((a, b) => b.preco - a.preco)
    .slice(0, 5);

  const card =
    "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/orcamento"
              className="text-xs text-zinc-500 hover:underline"
            >
              Orçamentos
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Parâmetros econômicos
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              Premissas que entram no preço de novos orçamentos: dias úteis para
              rateio de equipamentos e fatores percentuais aplicados sobre o
              custo total de cada análise.
            </p>
          </div>
          <Link
            href="/custeio"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Ver custeio
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Fator econômico total
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
              {pct(fatorTotal)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Dias úteis/ano
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatNumber(params.dias_uteis_ano)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Custo médio
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {brl(custoMedio)}
            </p>
          </div>
          <div className={card}>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Preço médio
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {brl(precoMedio)}
            </p>
          </div>
        </section>

        {ultimaAtualizacao && (
          <p className="mt-3 text-xs text-zinc-400">
            Última atualização:{" "}
            {formatDateTime(ultimaAtualizacao)}
          </p>
        )}

        <section className="mt-8">
          <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              Premissas de orçamento
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Alterações valem para novos cálculos e para orçamentos
              recalculados. Orçamentos já emitidos mantêm o snapshot salvo até
              você usar “Recalcular preços”.
            </p>
          </div>
          <ParametrosEconomicosForm valores={valores} />
        </section>

        <section className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Prévia de impacto</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Cinco análises com maior preço atual usando estes parâmetros.
            </p>
          </div>
          <table className="w-full text-right text-sm">
            <thead className="text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 text-left">Análise</th>
                <th className="px-4 py-3">Custo total</th>
                <th className="px-4 py-3">Fatores</th>
                <th className="px-4 py-3">Preço</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {analisesPreview.map((b) => (
                <tr key={b.codigo}>
                  <td className="px-4 py-2.5 text-left font-medium">
                    {b.codigo}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                    {brl(b.custoTotal)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">
                    {pct(b.fatores * 100)}
                  </td>
                  <td className="px-4 py-2.5 font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {brl(b.preco)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
