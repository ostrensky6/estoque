"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";

export type PlanoRow = {
  id: number;
  nome: string;
  projeto: string;
  dataAlvo: string;
  itens: number;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<PlanoRow, unknown>[] = [
  {
    accessorKey: "nome",
    header: "Plano",
    cell: ({ row }) => (
      <Link href={`/planejamento/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.nome}
      </Link>
    ),
  },
  { accessorKey: "projeto", header: "Projeto" },
  { accessorKey: "dataAlvo", header: "Data alvo" },
  {
    accessorKey: "itens",
    header: "Análises",
    meta: { align: "right" },
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    meta: { align: "center" },
    cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.statusLabel} />,
    filterFn: "equalsString",
  },
];

function StatusBadge({ status, label }: { status: string; label: string }) {
  const variantClass =
    status === "iniciado"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : status === "concluido"
        ? "bg-leaf-100 text-leaf-800 dark:bg-leaf-950/50 dark:text-leaf-300"
      : status === "reservado"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
        : status === "liberado"
          ? "bg-secondary text-secondary-foreground"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";

  return <Badge className={variantClass}>{label}</Badge>;
}

export function PlanosTable({ rows }: { rows: PlanoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar plano, projeto ou status..."
      emptyText="Nenhum plano ainda. Crie o primeiro acima."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [
            { value: "Rascunho", label: "Rascunho" },
            { value: "Reservado", label: "Reservado" },
            { value: "Iniciado", label: "Iniciado" },
            { value: "Em execução", label: "Em execução" },
            { value: "Concluído", label: "Concluído" },
            { value: "Liberado", label: "Liberado" },
            { value: "Cancelado", label: "Cancelado" },
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
        <Link href={`/planejamento/${row.id}`} className="text-primary hover:underline">
          {row.nome}
        </Link>
      )}
      getMobileDescription={(row) => `${row.projeto} · ${row.dataAlvo} · ${row.itens} análise(s)`}
      getMobileMeta={(row) => <StatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
