"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency as brl } from "@/lib/formatters";

export type ProjetoOrcamentoRow = {
  id: number;
  titulo: string;
  cliente: string;
  projeto: string;
  data: string;
  totalLab: number;
  totalCustos: number;
  total: number;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<ProjetoOrcamentoRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Orçamento",
    cell: ({ row }) => (
      <div>
        <Link href={`/orcamento/projetos/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.titulo}
        </Link>
        <span className="block text-xs text-muted-foreground">{row.original.data}</span>
      </div>
    ),
  },
  { accessorKey: "cliente", header: "Cliente" },
  { accessorKey: "projeto", header: "Projeto", filterFn: "equalsString" },
  {
    accessorKey: "totalLab",
    header: "Laboratório",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => brl(row.original.totalLab),
  },
  {
    accessorKey: "totalCustos",
    header: "Custos do projeto",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => brl(row.original.totalCustos),
  },
  {
    accessorKey: "total",
    header: "Total",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-semibold">{brl(row.original.total)}</span>,
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    filterFn: "equalsString",
    meta: { align: "center" },
    cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.statusLabel} />,
  },
];

function StatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === "rascunho" || status === "em_preparacao"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : status === "enviado" || status === "em_analise_cliente"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
        : status === "aprovado"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-secondary text-secondary-foreground";
  return <Badge className={className}>{label}</Badge>;
}

export function ProjetoOrcamentosTable({ rows }: { rows: ProjetoOrcamentoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar orçamento, cliente ou projeto..."
      emptyText="Nenhum orçamento de projeto ainda."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [...new Set(rows.map((row) => row.statusLabel))].map((value) => ({ value, label: value })),
        },
        {
          columnId: "projeto",
          label: "Projeto",
          options: [...new Set(rows.map((row) => row.projeto).filter((value) => value !== "—"))].map((value) => ({
            value,
            label: value,
          })),
        },
      ]}
      getMobileTitle={(row) => (
        <Link href={`/orcamento/projetos/${row.id}`} className="text-primary hover:underline">
          {row.titulo}
        </Link>
      )}
      getMobileDescription={(row) => `${row.cliente} · ${row.projeto} · ${brl(row.total)}`}
      getMobileMeta={(row) => <StatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
