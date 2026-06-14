"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatNumber as num } from "@/lib/formatters";

export type AnaliseRow = {
  codigo: string;
  nome: string;
  nEtapas: number;
  amostrasDia: number;
  tempoBancada: number;
  nEquip: number;
  nInsumos: number;
  status: string;
  statusLabel: string;
};

const columns: ColumnDef<AnaliseRow, unknown>[] = [
  {
    accessorKey: "codigo",
    header: "Análise",
    cell: ({ row }) => (
      <div>
        <Link href={`/analises/${encodeURIComponent(row.original.codigo)}`} className="font-medium text-primary hover:underline">
          {row.original.codigo}
        </Link>
        {row.original.nome && (
          <span className="block text-xs text-muted-foreground">{row.original.nome}</span>
        )}
      </div>
    ),
  },
  { accessorKey: "nEtapas", header: "Etapas", sortingFn: numericSort, meta: { align: "right" } },
  {
    accessorKey: "amostrasDia",
    header: "Amostras/dia",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.amostrasDia > 0 ? num(row.original.amostrasDia) : "—"),
  },
  {
    accessorKey: "tempoBancada",
    header: "Bancada",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.tempoBancada > 0 ? num(row.original.tempoBancada) : "—"),
  },
  { accessorKey: "nEquip", header: "Equip.", sortingFn: numericSort, meta: { align: "right" } },
  { accessorKey: "nInsumos", header: "Materiais", sortingFn: numericSort, meta: { align: "right" } },
  {
    accessorKey: "statusLabel",
    header: "Status",
    filterFn: "equalsString",
    meta: { align: "center" },
    cell: ({ row }) => (
      <Badge className={row.original.status === "ativa" ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" : "bg-secondary text-secondary-foreground"}>
        {row.original.statusLabel}
      </Badge>
    ),
  },
];

export function AnalisesTable({ rows }: { rows: AnaliseRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={columns}
      searchPlaceholder="Buscar análise..."
      emptyText="Nenhuma análise cadastrada."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [
            { value: "Ativa", label: "Ativa" },
            { value: "Inativa", label: "Inativa" },
          ],
        },
      ]}
      getMobileTitle={(row) => (
        <Link href={`/analises/${encodeURIComponent(row.codigo)}`} className="text-primary hover:underline">
          {row.codigo}
        </Link>
      )}
      getMobileDescription={(row) => `${row.nome || "sem nome"} · ${row.nEtapas} etapa(s) · ${row.nInsumos} material(is)`}
      getMobileMeta={(row) => <Badge variant={row.status === "ativa" ? "default" : "secondary"}>{row.statusLabel}</Badge>}
    />
  );
}
