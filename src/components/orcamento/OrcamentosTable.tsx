"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency as brl } from "@/lib/formatters";

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
  etapaAtual?: string;
  responsavel?: string;
  atualizadoEm?: string;
  proximaAcao?: string;
};

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
  { accessorKey: "projeto", header: "Projeto vinculado", filterFn: "equalsString" },
  { accessorKey: "etapaAtual", header: "Etapa", filterFn: "equalsString" },
  { accessorKey: "responsavel", header: "Responsável", filterFn: "equalsString" },
  {
    accessorKey: "analises",
    header: "Análises",
    sortingFn: numericSort,
    meta: { align: "right" },
  },
  {
    accessorKey: "custosProjeto",
    header: "Custos de projeto",
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
          ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
          : status === "cancelado"
            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            : "bg-secondary text-secondary-foreground";

  return <Badge className={variantClass}>{label}</Badge>;
}

export function OrcamentosTable({ rows }: { rows: OrcamentoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar orçamento, cliente ou projeto..."
      emptyText="Nenhum orçamento no histórico."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [
            { value: "Rascunho", label: "Rascunho" },
            { value: "Enviado", label: "Enviado" },
            { value: "Aprovado", label: "Aprovado" },
            { value: "Recusado", label: "Recusado" },
            { value: "Cancelado", label: "Cancelado" },
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
          columnId: "etapaAtual",
          label: "Etapa",
          options: [...new Set(rows.map((row) => row.etapaAtual).filter(Boolean) as string[])].map((value) => ({
            value,
            label: value,
          })),
        },
        {
          columnId: "responsavel",
          label: "Responsável",
          options: [...new Set(rows.map((row) => row.responsavel).filter((value) => value && value !== "—") as string[])].map((value) => ({
            value,
            label: value,
          })),
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
        `${row.cliente} · ${row.tipoLabel} · ${row.etapaAtual ?? "Orçamento"} · ${brl(row.total)}`
      }
      getMobileMeta={(row) => <StatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
