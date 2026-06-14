"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";

export type OrcamentoRow = {
  key: string;
  href: string;
  titulo: string;
  cliente: string;
  projeto: string;
  data: string;
  tipo: string;
  tipoLabel: string;
  analises: number;
  custosProjeto: number;
  total: number;
  status: string;
  statusLabel: string;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const columns: ColumnDef<OrcamentoRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Orçamento",
    cell: ({ row }) => (
      <div>
        <Link href={row.original.href} className="font-medium text-primary hover:underline">
          {row.original.titulo}
        </Link>
        <span className="block text-xs text-muted-foreground">
          {row.original.cliente} · {row.original.data}
        </span>
      </div>
    ),
  },
  { accessorKey: "tipoLabel", header: "Tipo", filterFn: "equalsString" },
  { accessorKey: "projeto", header: "Projeto", filterFn: "equalsString" },
  {
    accessorKey: "analises",
    header: "Análises",
    sortingFn: numericSort,
    meta: { align: "right" },
  },
  {
    accessorKey: "custosProjeto",
    header: "Projeto",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => brl(row.original.custosProjeto),
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
    meta: { align: "center" },
    filterFn: "equalsString",
    cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.statusLabel} />,
  },
];

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variantClass =
    status === "rascunho"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : status === "enviado"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
        : status === "aprovado"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : "bg-secondary text-secondary-foreground";

  return <Badge className={variantClass}>{label}</Badge>;
}

export function OrcamentosTable({ rows }: { rows: OrcamentoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar orçamento, cliente ou projeto..."
      emptyText="Nenhum orçamento ainda. Crie o primeiro acima."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [
            { value: "Rascunho", label: "Rascunho" },
            { value: "Enviado", label: "Enviado" },
            { value: "Aprovado", label: "Aprovado" },
            { value: "Recusado", label: "Recusado" },
          ],
        },
        {
          columnId: "tipoLabel",
          label: "Tipo",
          options: [
            { value: "Só análises", label: "Só análises" },
            { value: "Só projeto", label: "Só projeto" },
            { value: "Análises + projeto", label: "Análises + projeto" },
          ],
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
        <Link href={row.href} className="text-primary hover:underline">
          {row.titulo}
        </Link>
      )}
      getMobileDescription={(row) =>
        `${row.cliente} · ${row.tipoLabel} · ${row.projeto} · ${brl(row.total)}`
      }
      getMobileMeta={(row) => <StatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
