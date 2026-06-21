import Link from "next/link";

import { OrcamentosTable, type OrcamentoRow } from "@/components/orcamento/OrcamentosTable";
import { formatCurrency as brl } from "@/lib/formatters";

type Props = {
  titulo: string;
  descricao: string;
  rows: OrcamentoRow[];
  acaoHref?: string;
  acaoLabel?: string;
};

export function OrcamentoSubarea({ titulo, descricao, rows, acaoHref, acaoLabel }: Props) {
  const total = rows.reduce((acc, row) => acc + Number(row.total ?? 0), 0);
  const clientes = new Set(rows.map((row) => row.cliente)).size;
  const responsaveis = new Set(rows.map((row) => row.responsavel).filter((value) => value && value !== "—")).size;

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">{descricao}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/orcamento" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Visão geral
            </Link>
            {acaoHref && acaoLabel && (
              <Link href={acaoHref} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
                {acaoLabel}
              </Link>
            )}
          </div>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Resumo titulo="Itens" valor={rows.length.toLocaleString("pt-BR")} />
          <Resumo titulo="Clientes" valor={clientes.toLocaleString("pt-BR")} />
          <Resumo titulo="Responsáveis" valor={responsaveis.toLocaleString("pt-BR")} />
          <Resumo titulo="Total" valor={brl(total)} />
        </section>

        <div className="mt-6">
          <OrcamentosTable rows={rows} />
        </div>
      </main>
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
