"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatInteger } from "@/lib/formatters";

type GastoRow = {
  mes: string;
  projeto: string;
  gasto: number;
};

type FunnelRow = {
  status: string;
  total: number;
};

// Paleta institucional: azul GIA, teal e verde ATGC, âmbar para perdidos.
const COLORS = ["#01489d", "#008e9c", "#008a00", "#d97706"];

export function ExecutiveCharts({
  gastos,
  funil,
}: {
  gastos: GastoRow[];
  funil: FunnelRow[];
}) {
  const gastosPorMes = Object.values(
    gastos.reduce<Record<string, { mes: string; gasto: number }>>((acc, item) => {
      const mes = item.mes.slice(0, 7);
      acc[mes] ??= { mes, gasto: 0 };
      acc[mes].gasto += item.gasto;
      return acc;
    }, {}),
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Gasto por mês</h3>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gastosPorMes}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCompactCurrency(Number(value))} width={78} />
              <Tooltip formatter={(value) => formatCompactCurrency(Number(value))} cursor={{ fill: "rgba(148, 163, 184, 0.12)" }} />
              <Bar dataKey="gasto" radius={[4, 4, 0, 0]} fill="#01489d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Funil de orçamentos</h3>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={funil} dataKey="total" nameKey="status" innerRadius={56} outerRadius={88} paddingAngle={2}>
                {funil.map((entry, index) => (
                  <Cell key={entry.status} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatInteger(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="grid gap-2 text-xs">
          {funil.map((f, i) => (
            <div key={f.status} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-600 dark:text-zinc-400">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {f.status}
              </span>
              <span className="font-semibold tabular-nums">{f.total}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
