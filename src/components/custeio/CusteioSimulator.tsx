"use client";

import { useMemo, useState } from "react";

import { calcularAnalise, type Parametros } from "@/lib/costing/engine";
import type { SimuladorAnalise } from "@/lib/costing/loader";
import { formatCurrency } from "@/lib/formatters";

export function CusteioSimulator({
  analises,
  params,
  valorHoraPessoal,
  custoHoraOverhead,
}: {
  analises: SimuladorAnalise[];
  params: Parametros;
  valorHoraPessoal: number;
  custoHoraOverhead: number;
}) {
  const [codigo, setCodigo] = useState(analises[0]?.codigo ?? "");
  const analise = analises.find((a) => a.codigo === codigo) ?? analises[0];
  const [lote, setLote] = useState(analise?.lotePadrao ?? 1);
  const [fator, setFator] = useState(0);
  const [escolhasGrupo, setEscolhasGrupo] = useState<Record<string, string>>({});

  const resultado = useMemo(() => {
    if (!analise) return null;
    return calcularAnalise({
      codigo: analise.codigo,
      etapas: analise.etapas,
      equip: analise.equip,
      insumos: analise.insumos,
      valorHoraPessoal,
      custoHoraOverhead,
      params: {
        ...params,
        margem_lucro: params.margem_lucro + fator,
      },
      cenario: { loteAmostras: lote, escolhasGrupo },
    });
  }, [analise, escolhasGrupo, custoHoraOverhead, fator, lote, params, valorHoraPessoal]);

  if (!analise || !resultado) return null;

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Simulador de cenário</h2>
          <p className="mt-1 text-sm text-slate-500">
            Ajuste lote, opção de grupo e margem incremental para ver o preço recalcular ao vivo.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-500">Preço simulado</div>
          <div className="text-2xl font-semibold text-brand-700 dark:text-brand-300">{formatCurrency(resultado.preco)}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">Análise</span>
          <select
            value={analise.codigo}
            onChange={(event) => {
              const next = analises.find((a) => a.codigo === event.target.value);
              setCodigo(event.target.value);
              setLote(next?.lotePadrao ?? 1);
              setEscolhasGrupo({});
            }}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            {analises.map((a) => (
              <option key={a.codigo} value={a.codigo}>
                {a.codigo}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="flex justify-between text-xs font-medium text-slate-600 dark:text-zinc-300">
            <span>Tamanho do lote</span>
            <span>{lote} amostras</span>
          </span>
          <input
            type="range"
            min={1}
            max={Math.max(192, analise.lotePadrao * 4)}
            step={1}
            value={lote}
            onChange={(event) => setLote(Number(event.target.value))}
            className="mt-3 w-full accent-brand-600"
          />
        </label>

        <label className="block">
          <span className="flex justify-between text-xs font-medium text-slate-600 dark:text-zinc-300">
            <span>Margem adicional</span>
            <span>{fator.toFixed(0)} p.p.</span>
          </span>
          <input
            type="range"
            min={-30}
            max={60}
            step={1}
            value={fator}
            onChange={(event) => setFator(Number(event.target.value))}
            className="mt-3 w-full accent-blue-600"
          />
        </label>
      </div>

      {analise.grupos.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {analise.grupos.map((grupo) => (
            <label key={grupo.nome} className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">{grupo.nome}</span>
              <select
                value={escolhasGrupo[grupo.nome] ?? ""}
                onChange={(event) =>
                  setEscolhasGrupo((atual) => ({ ...atual, [grupo.nome]: event.target.value }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">opção mais barata</option>
                {grupo.opcoes.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {opcao}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Reagentes", resultado.reagentes],
          ["Equipamento", resultado.equipamento],
          ["Pessoal", resultado.pessoal],
          ["Overhead", resultado.overhead],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
            <div className="text-xs text-slate-500">{label}</div>
            <div className="mt-1 font-semibold tabular-nums">{formatCurrency(Number(value))}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
