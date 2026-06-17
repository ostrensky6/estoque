"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { pedidoInternoStatus } from "@/lib/pedido/status";
import { PedidoItensQuickView, type PedidoItemView } from "./PedidoItensQuickView";

export type PedidoInternoRow = {
  id: number;
  numero: string;
  titulo: string;
  projeto: string;
  solicitante: string;
  necessidade: string;
  urgencia: string;
  itens: number;
  itensDetalhe: PedidoItemView[];
  total: string;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<PedidoInternoRow, unknown>[] = [
  {
    accessorKey: "numero",
    header: "Nº",
    cell: ({ row }) => (
      <Link href={`/pedido/${row.original.id}`} className="font-mono text-xs text-zinc-500 hover:underline">
        {row.original.numero}
      </Link>
    ),
  },
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
  { accessorKey: "urgencia", header: "Urgência" },
  {
    accessorKey: "itens",
    header: "Itens",
    meta: { align: "center" },
    cell: ({ row }) => (
      <PedidoItensQuickView
        numero={row.original.numero}
        titulo={row.original.titulo}
        itens={row.original.itensDetalhe}
      />
    ),
  },
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
          <span className="font-mono text-xs text-zinc-400">{row.numero}</span> · {row.titulo}
        </Link>
      )}
      getMobileDescription={(row) => `${row.projeto} · ${row.solicitante} · ${row.urgencia}`}
      getMobileMeta={(row) => (
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          <PedidoItensQuickView numero={row.numero} titulo={row.titulo} itens={row.itensDetalhe} />
        </div>
      )}
    />
  );
}
