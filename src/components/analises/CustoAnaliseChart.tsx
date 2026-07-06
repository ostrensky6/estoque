"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CurvaCustoAmostrasPonto } from "@/lib/costing/engine";
import { formatCompactCurrency, formatCurrency, formatNumber } from "@/lib/formatters";

type TooltipPayload = {
  value?: number;
  name?: string;
  dataKey?: string;
  payload?: CurvaCustoAmostrasPonto;
};

const primary = "#01489d";
const secondary = "#008e9c";

export function CustoAnaliseChart({
  data,
  capacidade,
}: {
  data: CurvaCustoAmostrasPonto[];
  capacidade: number;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const markers = useMemo(() => {
    const cap = Math.max(1, Math.floor(capacidade));
    const max = data.at(-1)?.amostras ?? 0;
    return Array.from({ length: Math.floor(max / cap) }, (_, index) => (index + 1) * cap).filter(
      (value) => value < max,
    );
  }, [capacidade, data]);

  const melhorPonto = useMemo(
    () =>
      data.reduce<CurvaCustoAmostrasPonto | null>(
        (melhor, ponto) =>
          !melhor || ponto.custoUnitarioMedio < melhor.custoUnitarioMedio ? ponto : melhor,
        null,
      ),
    [data],
  );

  if (data.length === 0) return null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Custo por número de amostras</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1">
              Capacidade {formatNumber(capacidade)} amostras/ciclo
            </span>
            {melhorPonto && (
              <span className="rounded-md border border-border/70 bg-muted/35 px-2 py-1">
                Menor média {formatCurrency(melhorPonto.custoUnitarioMedio)} em {formatNumber(melhorPonto.amostras)} amostras
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: primary }} />
            Ciclo
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: secondary }} />
            Média
          </span>
        </div>
      </div>

      <div className="mt-3 h-[360px] min-h-[360px] min-w-0 rounded-md border border-border/60 bg-background/40 p-3">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 24, left: 8, bottom: 22 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.28)" />
              <XAxis
                dataKey="amostras"
                fontSize={12}
                tickLine={{ stroke: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeWidth: 1.25 }}
                label={{ value: "Amostras", position: "insideBottom", offset: -12, fontSize: 12 }}
              />
              <YAxis
                fontSize={12}
                tickLine={{ stroke: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--foreground)", strokeWidth: 1.25 }}
                tickFormatter={(value) => formatCompactCurrency(Number(value))}
                width={82}
              />
              {markers.map((marker) => (
                <ReferenceLine
                  key={marker}
                  x={marker}
                  stroke="rgba(100, 116, 139, 0.45)"
                  strokeDasharray="4 4"
                  label={{ value: `${marker}`, position: "insideTop", fontSize: 10, fill: "var(--muted-foreground)" }}
                />
              ))}
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(15, 23, 42, 0.2)", strokeWidth: 1 }} />
              <Line
                type="stepAfter"
                dataKey="custoUnitarioCiclo"
                name="Ciclo"
                stroke={primary}
                strokeWidth={2.75}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="custoUnitarioMedio"
                name="Média"
                stroke={secondary}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-md bg-muted/50 text-xs text-muted-foreground">
            Carregando curva
          </div>
        )}
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0]?.payload;
  if (!ponto) return null;

  return (
    <div className="rounded-md border border-border bg-card p-3 text-xs shadow-lg">
      <p className="font-semibold">{formatNumber(Number(label))} amostra(s)</p>
      <p className="mt-1 text-muted-foreground">
        Ciclo {ponto.ciclo} · {formatNumber(ponto.amostrasNoCiclo)} de {formatNumber(ponto.capacidadeOperacional)}
      </p>
      <div className="mt-2 grid gap-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-5">
            <span>{entry.name}</span>
            <span className="font-semibold tabular-nums">{formatCurrency(entry.value)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-5 border-t border-border pt-1">
          <span>Total pedido</span>
          <span className="font-semibold tabular-nums">{formatCurrency(ponto.custoTotalPedido)}</span>
        </div>
      </div>
    </div>
  );
}
