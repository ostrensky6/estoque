"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { formatCurrency } from "@/lib/formatters";

export type CusteioRow = {
  codigo: string;
  lote: number;
  reagentes: number;
  equipamento: number;
  pessoal: number;
  custoAnalitico: number;
  overhead: number;
  custoTotal: number;
  preco: number;
};

const money = (key: keyof CusteioRow, header: string, strong = false): ColumnDef<CusteioRow, unknown> => ({
  accessorKey: key,
  header,
  sortingFn: numericSort,
  meta: { align: "right" },
  cell: ({ row }) => (
    <span className={strong ? "font-semibold text-primary" : undefined}>
      {formatCurrency(Number(row.original[key]))}
    </span>
  ),
});

const columns: ColumnDef<CusteioRow, unknown>[] = [
  { accessorKey: "codigo", header: "Análise", meta: { className: "font-medium" } },
  { accessorKey: "lote", header: "Lote", sortingFn: numericSort, meta: { align: "right" } },
  money("reagentes", "Reagentes"),
  money("equipamento", "Equip."),
  money("pessoal", "Pessoal"),
  money("custoAnalitico", "Custo analítico", true),
  money("overhead", "Overhead"),
  money("custoTotal", "Custo total"),
  money("preco", "Preço", true),
];

export function CusteioTable({ rows }: { rows: CusteioRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar análise..."
      emptyText="Nenhum custo calculado."
      getMobileTitle={(row) => row.codigo}
      getMobileDescription={(row) => `Lote ${row.lote} · custo ${formatCurrency(row.custoTotal)} · preço ${formatCurrency(row.preco)}`}
    />
  );
}
