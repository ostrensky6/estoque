"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";

export type DemandaRow = {
  id: number;
  titulo: string;
  cliente: string;
  modalidade: string;
  modalidadeLabel: string;
  projeto: string;
  prazo: string;
  prioridade: string;
  dataSolicitacao: string;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<DemandaRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Demanda",
    cell: ({ row }) => (
      <div>
        <Link href={`/orcamento/demandas/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.titulo}
        </Link>
        <span className="block text-xs text-muted-foreground">
          Solicitada em {row.original.dataSolicitacao} · prioridade {row.original.prioridade}
        </span>
      </div>
    ),
  },
  { accessorKey: "cliente", header: "Cliente" },
  { accessorKey: "modalidadeLabel", header: "Modalidade", filterFn: "equalsString" },
  { accessorKey: "projeto", header: "Projeto", filterFn: "equalsString" },
  { accessorKey: "prazo", header: "Prazo" },
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
    status === "nova"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
      : status === "em_analise"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : status === "orcada" || status === "aprovada"
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : status === "cancelada"
            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            : "bg-secondary text-secondary-foreground";
  return <Badge className={className}>{label}</Badge>;
}

export function DemandasTable({ rows }: { rows: DemandaRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar demanda, cliente ou projeto..."
      emptyText="Nenhuma demanda registrada."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [...new Set(rows.map((row) => row.statusLabel))].map((value) => ({ value, label: value })),
        },
        {
          columnId: "modalidadeLabel",
          label: "Modalidade",
          options: [...new Set(rows.map((row) => row.modalidadeLabel))].map((value) => ({ value, label: value })),
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
        <Link href={`/orcamento/demandas/${row.id}`} className="text-primary hover:underline">
          {row.titulo}
        </Link>
      )}
      getMobileDescription={(row) => `${row.cliente} · ${row.modalidadeLabel} · ${row.projeto}`}
      getMobileMeta={(row) => <StatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
