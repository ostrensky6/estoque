"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { excluirPedidoInterno } from "@/lib/actions/pedidos-internos";
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

function StatusBadge({ status }: { status: string }) {
  const meta = pedidoInternoStatus(status);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function ExcluirPedido({ row }: { row: PedidoInternoRow }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          aria-label={`Excluir ${row.numero}`}
          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir pedido {row.numero}?</DialogTitle>
          <DialogDescription>
            Esta ação remove o pedido <b>{row.titulo}</b> e todos os seus itens, anexos e comunicações. Não pode
            ser desfeita.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </DialogClose>
          <form action={excluirPedidoInterno}>
            <input type="hidden" name="pedido_interno_id" value={row.id} />
            <button
              type="submit"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              Excluir definitivamente
            </button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildColumns(podeExcluir: boolean): ColumnDef<PedidoInternoRow, unknown>[] {
  const cols: ColumnDef<PedidoInternoRow, unknown>[] = [
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
  if (podeExcluir) {
    cols.push({
      id: "acoes",
      header: "Ações",
      meta: { align: "right" },
      enableSorting: false,
      cell: ({ row }) => <ExcluirPedido row={row.original} />,
    });
  }
  return cols;
}

export function PedidosInternosTable({
  rows,
  emptyText = "Nenhum pedido interno. Registre a demanda acima.",
  podeExcluir = false,
}: {
  rows: PedidoInternoRow[];
  emptyText?: string;
  podeExcluir?: boolean;
}) {
  return (
    <DataTable
      data={rows}
      columns={buildColumns(podeExcluir)}
      searchPlaceholder="Buscar pedido, projeto, solicitante ou status..."
      emptyText={emptyText}
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
          {podeExcluir && <ExcluirPedido row={row} />}
        </div>
      )}
    />
  );
}
