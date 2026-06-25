"use client";

import { useMemo, useState } from "react";
import { salvarParametrosEconomicosDaDemanda } from "@/lib/actions/demandas";
import { formatCurrency as brl } from "@/lib/formatters";
import { TOM_ENTRADA } from "@/lib/orcamento/tom-valor";

type Rates = {
  impostos_legacy: number;
  incubacao: number;
  reserva: number;
  investimentos: number;
  lucro: number;
};

type RubricaResumo = {
  codigo: string;
  nome: string;
  itens: number;
  custo: number;
};

const CAMPOS: Array<{ key: keyof Rates; label: string; base: "final" | "custo"; max: number }> = [
  { key: "impostos_legacy", label: "Impostos", base: "final", max: 99 },
  { key: "incubacao", label: "Incubação", base: "final", max: 99 },
  { key: "reserva", label: "Reserva", base: "custo", max: 300 },
  { key: "investimentos", label: "Investimentos", base: "custo", max: 300 },
  { key: "lucro", label: "Lucro", base: "custo", max: 300 },
];

const CENARIOS: Array<{ label: string; valores: Rates }> = [
  { label: "Zerar", valores: { impostos_legacy: 0, incubacao: 0, reserva: 0, investimentos: 0, lucro: 0 } },
  { label: "Institucional", valores: { impostos_legacy: 16.33, incubacao: 2, reserva: 5, investimentos: 5, lucro: 30 } },
  { label: "Margem alta", valores: { impostos_legacy: 16.33, incubacao: 2, reserva: 10, investimentos: 10, lucro: 100 } },
];

export function ParametrosDemandaGrossUp({
  demandaId,
  subtotalTecnico,
  valores,
  rubricas,
}: {
  demandaId: number;
  subtotalTecnico: number;
  valores: Rates;
  rubricas: RubricaResumo[];
}) {
  const [rates, setRates] = useState<Rates>(valores);
  const calculo = useMemo(() => calcular(subtotalTecnico, rates), [subtotalTecnico, rates]);
  const maiorRubrica = useMemo(() => {
    const ordenadas = [...rubricas].sort((a, b) => b.custo - a.custo);
    return ordenadas.find((rubrica) => rubrica.custo > 0) ?? null;
  }, [rubricas]);
  const inputCls =
    `h-8 w-20 rounded-md border border-zinc-300 bg-white px-2 text-right text-sm font-semibold tabular-nums text-brand-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300 dark:focus:ring-brand-900 ${TOM_ENTRADA}`;
  const acrescimos = Math.max(0, calculo.totalFinal - subtotalTecnico);
  const markup = subtotalTecnico > 0 ? (calculo.markupSobreCusto / subtotalTecnico) * 100 : 0;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi titulo="Custo direto" valor={brl(subtotalTecnico)} />
        <Kpi titulo="Acréscimos" valor={brl(acrescimos)} />
        <Kpi titulo="Total final" valor={brl(calculo.totalFinal)} destaque />
        <Kpi titulo="Markup" valor={`${markup.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`} />
        <Kpi titulo="Gross-up" valor={`${calculo.fator.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}x`} />
        <Kpi titulo="Maior rubrica" valor={maiorRubrica ? `${maiorRubrica.codigo} · ${maiorRubrica.nome}` : "—"} />
      </div>

      {/* Esquerda: taxas/impostos/lucro (entrada). Direita: tabela final consolidada. */}
      <div className="grid gap-3 xl:grid-cols-2">
        <form action={salvarParametrosEconomicosDaDemanda} className="self-start rounded-md border border-zinc-200 dark:border-zinc-800">
            <input type="hidden" name="demanda_id" value={demandaId} />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div>
                <h3 className="text-sm font-semibold">Taxas, impostos e lucro</h3>
                <p className="text-xs text-zinc-500">Padrão institucional quando não há valores salvos.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CENARIOS.map((cenario) => (
                  <button
                    key={cenario.label}
                    type="button"
                    onClick={() => setRates(cenario.valores)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-900"
                  >
                    {cenario.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {CAMPOS.map((campo) => (
                <div key={campo.key} className="grid items-center gap-2 px-3 py-1.5 text-sm md:grid-cols-[7.25rem_minmax(7rem,1fr)_auto_6.25rem]">
                  <label htmlFor={campo.key} className="font-medium text-zinc-800 dark:text-zinc-100">
                    {campo.label}
                    <span className="block text-[10px] font-normal leading-3 text-zinc-400">
                      {campo.base === "final" ? "sobre final" : "sobre custo"}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max={campo.max}
                    step="0.5"
                    value={Math.min(campo.max, Math.max(0, rates[campo.key]))}
                    onChange={(event) => {
                      const valor = Number(event.target.value);
                      setRates((atuais) => ({ ...atuais, [campo.key]: Number.isFinite(valor) ? valor : 0 }));
                    }}
                    className="w-full accent-brand-600"
                    aria-label={`Simular ${campo.label}`}
                  />
                  <div className="flex items-center gap-1.5">
                  <input
                    id={campo.key}
                    name={campo.key}
                    type="number"
                    min="0"
                    step="0.01"
                    value={rates[campo.key]}
                    onChange={(event) => {
                      const valor = Number(event.target.value);
                      setRates((atuais) => ({ ...atuais, [campo.key]: Number.isFinite(valor) ? valor : 0 }));
                    }}
                    className={inputCls}
                  />
                  <span className="text-xs font-medium text-zinc-500">%</span>
                </div>
                  <span className="text-right text-sm font-semibold tabular-nums">{brl(calculo.valores[campo.key])}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <p className="max-w-xl text-xs text-zinc-500">
                Reserva, investimento e lucro entram antes; impostos e incubação entram por último sobre o final.
              </p>
              <button
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!calculo.valido}
              >
                Avançar
              </button>
            </div>
        </form>

        <div className="self-start rounded-md border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div>
              <h3 className="text-sm font-semibold">Resultado consolidado</h3>
              <p className="text-xs text-zinc-500">Tabela final de preços · R$ e % do total</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Valores em R$</span>
          </div>
          <div className="divide-y divide-zinc-100 px-3 py-2 text-xs dark:divide-zinc-800">
            {[
              ["Custos diretos", subtotalTecnico, "bg-brand-600"],
              ["Impostos e incubação", calculo.valores.impostos_legacy + calculo.valores.incubacao, "bg-amber-500"],
              ["Fundo de reserva", calculo.valores.reserva, "bg-aqua-600"],
              ["Fundo de investimento", calculo.valores.investimentos, "bg-violet-500"],
              ["Lucro", calculo.valores.lucro, "bg-leaf-500"],
            ].map(([label, valor, cor]) => (
              <LinhaResultado key={String(label)} label={String(label)} valor={Number(valor)} total={calculo.totalFinal} cor={String(cor)} />
            ))}
            <LinhaResultado label="Total final" valor={calculo.totalFinal} total={calculo.totalFinal} cor="bg-slate-500" destaque />
            {!calculo.valido && (
              <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                Reduza impostos e incubação para calcular o gross-up.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function calcular(subtotal: number, rates: Rates) {
  const impostos = Math.max(0, Number(rates.impostos_legacy || 0));
  const incubacao = Math.max(0, Number(rates.incubacao || 0));
  const reserva = Math.max(0, Number(rates.reserva || 0));
  const investimentos = Math.max(0, Number(rates.investimentos || 0));
  const lucro = Math.max(0, Number(rates.lucro || 0));
  const taxaFinal = impostos + incubacao;
  const taxaCusto = reserva + investimentos + lucro;
  const valido = taxaFinal < 100;
  const markupSobreCusto = arredondar(subtotal * (taxaCusto / 100));
  const baseComMarkup = arredondar(subtotal + markupSobreCusto);
  const fator = valido ? 1 / (1 - taxaFinal / 100) : 1;
  const totalFinal = arredondar(baseComMarkup * fator);
  const valores = {
    impostos_legacy: arredondar(totalFinal * (impostos / 100)),
    incubacao: arredondar(totalFinal * (incubacao / 100)),
    reserva: arredondar(subtotal * (reserva / 100)),
    investimentos: arredondar(subtotal * (investimentos / 100)),
    lucro: arredondar(subtotal * (lucro / 100)),
  };
  const grossUpSobreFinal = arredondar(valores.impostos_legacy + valores.incubacao);
  return { valido, fator, totalFinal, valores, markupSobreCusto, grossUpSobreFinal };
}

function arredondar(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function percentual(valor: number, total: number) {
  if (!total) return "0,00%";
  return `${((valor / total) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function Kpi({ titulo, valor, destaque = false }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-md border p-2.5 ${destaque ? "border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/30" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{titulo}</p>
      <p className={`mt-1 truncate text-base font-semibold tabular-nums ${destaque ? "text-brand-700 dark:text-brand-300" : "text-zinc-900 dark:text-zinc-100"}`}>{valor}</p>
    </div>
  );
}

function LinhaResultado({
  label,
  valor,
  total,
  cor,
  destaque = false,
}: {
  label: string;
  valor: number;
  total: number;
  cor: string;
  destaque?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <div className={`grid items-center gap-3 py-2 ${destaque ? "font-semibold text-brand-700 dark:text-brand-300" : ""} md:grid-cols-[9rem_7rem_minmax(8rem,1fr)_4rem]`}>
      <span>{label}</span>
      <span className="text-right tabular-nums">{brl(valor)}</span>
      <span className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <span className={`block h-2 rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-right tabular-nums text-zinc-500">{percentual(valor, total)}</span>
    </div>
  );
}
