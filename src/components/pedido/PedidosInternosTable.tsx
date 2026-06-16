"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { pedidoInternoStatus } from "@/lib/pedido/status";

export type PedidoInternoRow = {
  id: number;
  titulo: string;
  projeto: string;
  solicitante: string;
  necessidade: string;
  itens: number;
  total: string;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<PedidoInternoRow, unknown>[] = [
  {
    accessorKey: "titulo",
    header: "Pedido",
    cell: ({ row }) => (
      <Link href={`/pedido/${row.original.id}`} className="font-medium text-primary hover:underline">
        {row.original.titulo}
      </Link>
    ),
  },
  { accessorKey: "projeto", header: "Projeto" },
  { accessorKey: "solicitante", header: "Solicitante" },
  { accessorKey: "necessidade", header: "Necessidade" },
  { accessorKey: "itens", header: "Itens", meta: { align: "right" } },
  { accessorKey: "total", header: "Prévio", meta: { align: "right" } },
  {
    accessorKey: "statusLabel",
    header: "Status",
    meta: { align: "center" },
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    filterFn: "equalsString",
  },
];

function StatusBadge({ status }: { status: string }) {
  const meta = pedidoInternoStatus(status);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

export function PedidosInternosTable({ rows }: { rows: PedidoInternoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar pedido, projeto, solicitante ou status..."
      emptyText="Nenhum pedido interno. Registre a demanda acima."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [...new Set(rows.map((row) => row.statusLabel))].map((value) => ({
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
        <Link href={`/pedido/${row.id}`} className="text-primary hover:underline">
          {row.titulo}
        </Link>
      )}
      getMobileDescription={(row) => `${row.projeto} · ${row.solicitante} · ${row.itens} item(ns)`}
      getMobileMeta={(row) => <StatusBadge status={row.status} />}
    />
  );
}
