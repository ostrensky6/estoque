"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { pedidoInternoStatus } from "@/lib/pedido/status";
import { ItemRecebimentoCell } from "./ItemRecebimentoCell";

type Insumo = { id: number; especificacao: string | null; unidade: string | null };

export type RecebimentoItemRow = {
  id: number;
  pedidoId: number;
  pedidoNumero: string;
  pedidoTitulo: string;
  especificacao: string;
  quantidade: number;
  unidade: string | null;
  insumoId: number | null;
  fornecedorSugerido: string | null;
  orcamentoPrevio: number | null;
  projeto: string;
  status: string;
  statusLabel: string;
  podeReceber: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const meta = pedidoInternoStatus(status);
  return <Badge className={meta.className}>{meta.label}</Badge>;
}

function colunas(insumos: Insumo[]): ColumnDef<RecebimentoItemRow, unknown>[] {
  return [
    {
      accessorKey: "pedidoNumero",
      header: "Nº",
      cell: ({ row }) => (
        <Link href={`/pedido/${row.original.pedidoId}`} className="font-mono text-xs text-zinc-500 hover:underline">
          {row.original.pedidoNumero}
        </Link>
      ),
    },
    {
      accessorKey: "especificacao",
      header: "Item",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.especificacao}</p>
          <p className="text-xs text-zinc-500">{row.original.pedidoTitulo}</p>
        </div>
      ),
    },
    { accessorKey: "projeto", header: "Projeto" },
    {
      id: "qtd",
      header: "Qtd",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.quantidade} {row.original.unidade ?? ""}
        </span>
      ),
    },
    {
      accessorKey: "fornecedorSugerido",
      header: "Fornecedor",
      cell: ({ row }) => row.original.fornecedorSugerido ?? "—",
    },
    {
      accessorKey: "statusLabel",
      header: "Estágio",
      meta: { align: "center" },
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      filterFn: "equalsString",
    },
    {
      id: "recebimento",
      header: "Recebimento",
      meta: { align: "right" },
      enableSorting: false,
      cell: ({ row }) => (
        <ItemRecebimentoCell
          item={{
            id: row.original.id,
            pedidoId: row.original.pedidoId,
            especificacao: row.original.especificacao,
            quantidade: row.original.quantidade,
            unidade: row.original.unidade,
            insumoId: row.original.insumoId,
            fornecedorSugerido: row.original.fornecedorSugerido,
            orcamentoPrevio: row.original.orcamentoPrevio,
          }}
          insumos={insumos}
          podeReceber={row.original.podeReceber}
        />
      ),
    },
  ];
}

export function RecebimentoItensTable({
  rows,
  insumos,
}: {
  rows: RecebimentoItemRow[];
  insumos: Insumo[];
}) {
  return (
    <DataTable
      data={rows}
      columns={colunas(insumos)}
      searchPlaceholder="Buscar item, pedido, projeto ou fornecedor..."
      emptyText="Nenhum item de pedido aguardando chegada."
      filters={[
        {
          columnId: "statusLabel",
          label: "Estágio",
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
        <span>
          <span className="font-mono text-xs text-zinc-400">{row.pedidoNumero}</span> · {row.especificacao}
        </span>
      )}
      getMobileDescription={(row) => `${row.projeto} · ${row.quantidade} ${row.unidade ?? ""}`}
      getMobileMeta={(row) => (
        <div className="flex flex-col items-end gap-1.5">
          <StatusBadge status={row.status} />
          <ItemRecebimentoCell
            item={{
              id: row.id,
              pedidoId: row.pedidoId,
              especificacao: row.especificacao,
              quantidade: row.quantidade,
              unidade: row.unidade,
              insumoId: row.insumoId,
              fornecedorSugerido: row.fornecedorSugerido,
              orcamentoPrevio: row.orcamentoPrevio,
            }}
            insumos={insumos}
            podeReceber={row.podeReceber}
          />
        </div>
      )}
    />
  );
}
