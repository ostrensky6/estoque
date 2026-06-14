"use client";

import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable, numericSort } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { LoteAcoes } from "@/components/estoque/LoteAcoes";
import { AjusteInventarioButton } from "@/components/estoque/ReceberLote";

export type SaldoRow = {
  insumoId: number;
  especificacao: string;
  unidade: string;
  emMaos: number;
  emQuarentena: number;
  reservado: number;
  disponivel: number;
  pontoReposicao: number;
  consumoMedioDiario: number;
  diasCobertura: number | null;
  pontoSugerido: number;
  status: "ok" | "repor" | "sem_estoque";
  statusLabel: string;
};

export type LoteRow = {
  id: number;
  especificacao: string;
  unidade: string;
  codigoLote: string;
  validade: string;
  quantidadeAtual: number;
  status: string;
  statusLabel: string;
  vencido: boolean;
};

const fmt = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function SaldoStatusBadge({ status, label }: { status: SaldoRow["status"]; label: string }) {
  const className =
    status === "repor"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : status === "sem_estoque"
        ? "bg-secondary text-secondary-foreground"
        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";

  return <Badge className={className}>{label}</Badge>;
}

function LoteStatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === "quarentena"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
      : status === "aceito"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        : status === "em_uso"
          ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
          : status === "bloqueado"
            ? "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
            : "bg-secondary text-secondary-foreground";

  return <Badge className={className}>{label}</Badge>;
}

const saldoColumns: ColumnDef<SaldoRow, unknown>[] = [
  {
    accessorKey: "especificacao",
    header: "Reagente",
    meta: { className: "max-w-xs truncate" },
  },
  { accessorKey: "unidade", header: "Un." },
  {
    accessorKey: "emMaos",
    header: "Em mãos",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => fmt(row.original.emMaos),
  },
  {
    accessorKey: "emQuarentena",
    header: "Quarentena",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.emQuarentena > 0 ? fmt(row.original.emQuarentena) : "—"),
  },
  {
    accessorKey: "reservado",
    header: "Reservado",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => fmt(row.original.reservado),
  },
  {
    accessorKey: "disponivel",
    header: "Disponível",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-medium">{fmt(row.original.disponivel)}</span>,
  },
  {
    accessorKey: "pontoReposicao",
    header: "Ponto atual",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.pontoReposicao > 0 ? fmt(row.original.pontoReposicao) : "—"),
  },
  {
    accessorKey: "consumoMedioDiario",
    header: "Cons./dia",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.consumoMedioDiario > 0 ? fmt(row.original.consumoMedioDiario) : "—"),
  },
  {
    accessorKey: "diasCobertura",
    header: "Cobertura",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.diasCobertura != null ? `${fmt(row.original.diasCobertura)} d` : "—"),
  },
  {
    accessorKey: "pontoSugerido",
    header: "Ponto suger.",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => (row.original.pontoSugerido > 0 ? fmt(row.original.pontoSugerido) : "—"),
  },
  {
    accessorKey: "statusLabel",
    header: "Status",
    meta: { align: "center" },
    filterFn: "equalsString",
    cell: ({ row }) => (
      <SaldoStatusBadge status={row.original.status} label={row.original.statusLabel} />
    ),
  },
  {
    id: "acoes",
    header: "Ações",
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { align: "right" },
    cell: ({ row }) => (
      <AjusteInventarioButton
        insumoId={row.original.insumoId}
        especificacao={row.original.especificacao}
        unidade={row.original.unidade === "—" ? null : row.original.unidade}
      />
    ),
  },
];

const lotesColumns = (
  podeAceitar: boolean,
  podeGerir: boolean,
): ColumnDef<LoteRow, unknown>[] => [
  { accessorKey: "especificacao", header: "Reagente", meta: { className: "max-w-xs truncate" } },
  {
    accessorKey: "codigoLote",
    header: "Lote",
    cell: ({ row }) => (
      <Link
        href={`/estoque/lotes/${row.original.id}`}
        className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
      >
        {row.original.codigoLote}
      </Link>
    ),
  },
  {
    accessorKey: "validade",
    header: "Validade",
    cell: ({ row }) => (
      <span className={row.original.vencido ? "font-medium text-destructive" : undefined}>
        {row.original.validade}
        {row.original.vencido ? " !" : ""}
      </span>
    ),
  },
  {
    accessorKey: "quantidadeAtual",
    header: "Saldo",
    sortingFn: numericSort,
    meta: { align: "right" },
    cell: ({ row }) => `${fmt(row.original.quantidadeAtual)} ${row.original.unidade}`,
  },
  {
    accessorKey: "statusLabel",
    header: "Estado",
    meta: { align: "center" },
    filterFn: "equalsString",
    cell: ({ row }) => <LoteStatusBadge status={row.original.status} label={row.original.statusLabel} />,
  },
  {
    id: "acoes",
    header: "Ações",
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { align: "right" },
    cell: ({ row }) => (
      <LoteAcoes
        loteId={row.original.id}
        status={row.original.status}
        podeAceitar={podeAceitar}
        podeGerir={podeGerir}
      />
    ),
  },
];

export function SaldoTable({ rows }: { rows: SaldoRow[] }) {
  return (
    <DataTable
      data={rows}
      columns={saldoColumns}
      searchPlaceholder="Buscar reagente..."
      emptyText="Nenhum saldo encontrado."
      filters={[
        {
          columnId: "statusLabel",
          label: "Status",
          options: [
            { value: "OK", label: "OK" },
            { value: "Repor", label: "Repor" },
            { value: "Sem estoque", label: "Sem estoque" },
          ],
        },
      ]}
      getMobileTitle={(row) => row.especificacao}
      getMobileDescription={(row) =>
        `${row.disponivel} ${row.unidade} disponível · cobertura ${row.diasCobertura != null ? `${fmt(row.diasCobertura)} d` : "—"} · ponto sugerido ${row.pontoSugerido || "—"}`
      }
      getMobileMeta={(row) => <SaldoStatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}

export function LotesTable({
  rows,
  podeAceitar,
  podeGerir,
}: {
  rows: LoteRow[];
  podeAceitar: boolean;
  podeGerir: boolean;
}) {
  return (
    <DataTable
      data={rows}
      columns={lotesColumns(podeAceitar, podeGerir)}
      searchPlaceholder="Buscar reagente ou lote..."
      emptyText="Nenhum lote em estoque. Use + Lote na tabela acima para receber."
      filters={[
        {
          columnId: "statusLabel",
          label: "Estado",
          options: [
            { value: "Quarentena", label: "Quarentena" },
            { value: "Aceito", label: "Aceito" },
            { value: "Em uso", label: "Em uso" },
            { value: "Bloqueado", label: "Bloqueado" },
          ],
        },
      ]}
      getMobileTitle={(row) => row.especificacao}
      getMobileDescription={(row) =>
        `Lote ${row.codigoLote} · validade ${row.validade} · ${fmt(row.quantidadeAtual)} ${row.unidade}`
      }
      getMobileMeta={(row) => <LoteStatusBadge status={row.status} label={row.statusLabel} />}
    />
  );
}
