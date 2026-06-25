"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";

import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { excluirDemandasSelecionadas } from "@/lib/actions/demandas";
import { formatCurrency as brl } from "@/lib/formatters";

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
  completudeLabel: string;
  completa: boolean;
  fluxoStatus: string;
  etapaAtual: string;
  proximaAcao: string;
  proximaHref: string;
  totalEmAberto: number;
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const className =
    status === "nova"
      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
      : status === "em_analise"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : status === "orcada" || status === "aprovada"
          ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
          : status === "cancelada"
            ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
            : "bg-secondary text-secondary-foreground";
  return <Badge className={className}>{label}</Badge>;
}

function FluxoBadge({ status }: { status: string }) {
  const className =
    status === "Proposta concluída"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : status === "Proposta em revisão" || status === "Parâmetros econômicos pendentes"
        ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
        : status.includes("pendente")
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          : "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300";
  return <Badge className={className}>{status}</Badge>;
}

export function DemandasTable({ rows }: { rows: DemandaRow[] }) {
  const [selecionadas, setSelecionadas] = useState<Set<number>>(() => new Set());
  const todasSelecionadas = rows.length > 0 && selecionadas.size === rows.length;
  const alternarTodas = useCallback(() => {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(rows.map((row) => row.id)));
  }, [rows, todasSelecionadas]);
  const columns = useMemo<ColumnDef<DemandaRow, unknown>[]>(() => [
    {
      id: "selecionar",
      header: () => (
        <div className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={todasSelecionadas}
            onChange={alternarTodas}
            aria-label="Selecionar todos os orçamentos não finalizados"
            className="h-4 w-4 rounded border-zinc-300"
          />
          <button
            form="demandas-excluir-form"
            name="escopo"
            value="selecionadas"
            disabled={selecionadas.size === 0}
            aria-label="Apagar orçamentos selecionados"
            title="Apagar selecionados"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-35 dark:text-red-300 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          form="demandas-excluir-form"
          name="demanda_id"
          value={row.original.id}
          checked={selecionadas.has(row.original.id)}
          onChange={(event) => {
            const id = row.original.id;
            setSelecionadas((atuais) => {
              const proximas = new Set(atuais);
              if (event.target.checked) proximas.add(id);
              else proximas.delete(id);
              return proximas;
            });
          }}
          aria-label={`Selecionar orçamento ${row.original.titulo}`}
          className="h-4 w-4 rounded border-zinc-300"
        />
      ),
      enableSorting: false,
      meta: { align: "center", className: "w-10" },
    },
    {
      accessorKey: "titulo",
      header: "Orçamento",
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
    {
      accessorKey: "fluxoStatus",
      header: "Fluxo",
      filterFn: "equalsString",
      cell: ({ row }) => <FluxoBadge status={row.original.fluxoStatus} />,
    },
    { accessorKey: "etapaAtual", header: "Etapa atual", filterFn: "equalsString" },
    {
      accessorKey: "completudeLabel",
      header: "Completude",
      filterFn: "equalsString",
      meta: { align: "center" },
      cell: ({ row }) => (
        <Badge
          className={
            row.original.completa
              ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          }
        >
          {row.original.completudeLabel}
        </Badge>
      ),
    },
    {
      accessorKey: "totalEmAberto",
      header: "Total",
      meta: { align: "right" },
      cell: ({ row }) => <span className="font-semibold tabular-nums">{brl(row.original.totalEmAberto)}</span>,
    },
    {
      accessorKey: "statusLabel",
      header: "Status",
      filterFn: "equalsString",
      meta: { align: "center" },
      cell: ({ row }) => <StatusBadge status={row.original.status} label={row.original.statusLabel} />,
    },
    {
      accessorKey: "proximaAcao",
      header: "Ação",
      cell: ({ row }) => (
        <Link href={row.original.proximaHref} className="font-medium text-primary hover:underline">
          {row.original.proximaAcao}
        </Link>
      ),
    },
  ], [alternarTodas, selecionadas, todasSelecionadas]);

  return (
    <div>
      <form id="demandas-excluir-form" action={excluirDemandasSelecionadas} />
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Buscar orçamento, cliente ou projeto..."
        emptyText="Nenhum orçamento não finalizado."
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
            columnId: "completudeLabel",
            label: "Completude",
            options: [...new Set(rows.map((row) => row.completudeLabel))].map((value) => ({ value, label: value })),
          },
          {
            columnId: "fluxoStatus",
            label: "Fluxo",
            options: [...new Set(rows.map((row) => row.fluxoStatus))].map((value) => ({ value, label: value })),
          },
          {
            columnId: "etapaAtual",
            label: "Etapa",
            options: [...new Set(rows.map((row) => row.etapaAtual))].map((value) => ({ value, label: value })),
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
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              form="demandas-excluir-form"
              name="demanda_id"
              value={row.id}
              checked={selecionadas.has(row.id)}
              onChange={(event) => {
                setSelecionadas((atuais) => {
                  const proximas = new Set(atuais);
                  if (event.target.checked) proximas.add(row.id);
                  else proximas.delete(row.id);
                  return proximas;
                });
              }}
              aria-label={`Selecionar orçamento ${row.titulo}`}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <Link href={`/orcamento/demandas/${row.id}`} className="text-primary hover:underline">
              {row.titulo}
            </Link>
          </label>
        )}
        getMobileDescription={(row) => `${row.cliente} · ${row.modalidadeLabel} · ${row.fluxoStatus} · ${brl(row.totalEmAberto)}`}
        getMobileMeta={(row) => (
          <div className="flex flex-wrap gap-2">
            <FluxoBadge status={row.fluxoStatus} />
            <Badge
              className={
                row.completa
                  ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              }
            >
              {row.completudeLabel}
            </Badge>
          </div>
        )}
      />
    </div>
  );
}
