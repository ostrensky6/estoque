import Link from "next/link";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import {
  atualizarOrcamentosFinaisVencidos,
  cancelarVersaoFinal,
  duplicarVersaoFinal,
} from "@/lib/actions/orcamento-historico";
import { formatCurrency as brl, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DemandaHistorico = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  responsavel_interno: string | null;
};

type VersaoFinal = {
  id: number;
  demanda_id: number;
  versao: number;
  numero: string;
  status: string;
  validade_dias: number;
  valido_ate: string | null;
  total_final: number;
  total_laboratorio_custo: number;
  total_laboratorio_preco: number;
  total_projeto_custo: number;
  total_projeto_final: number;
  criado_por: string | null;
  criado_em: string;
  duplicada_de_id: number | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  demandas_propostas?: DemandaHistorico | null;
};

export default async function HistoricoOrcamentosPage() {
  await atualizarOrcamentosFinaisVencidos();

  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamento_final_versoes")
    .select(
      "id, demanda_id, versao, numero, status, validade_dias, valido_ate, total_final, total_laboratorio_custo, total_laboratorio_preco, total_projeto_custo, total_projeto_final, criado_por, criado_em, duplicada_de_id, cancelado_em, cancelado_motivo, demandas_propostas(id, titulo, cliente_nome, responsavel_interno)",
    )
    .order("criado_em", { ascending: false });

  const versoes = ((data ?? []) as VersaoFinal[]).map((versao) => ({
    ...versao,
    anterior: encontrarAnterior((data ?? []) as VersaoFinal[], versao),
  }));

  const emitidos = versoes.filter((item) => item.status === "emitido").length;
  const vencidos = versoes.filter((item) => item.status === "vencido").length;
  const cancelados = versoes.filter((item) => item.status === "cancelado").length;
  const totalHistorico = versoes.reduce((total, item) => total + Number(item.total_final ?? 0), 0);

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Orçamentos", href: "/orcamento" }, { label: "Histórico de Orçamentos" }]} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Histórico de Orçamentos</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Versões finais emitidas, vencimentos, cancelamentos, duplicações e comparação entre versões da mesma demanda.
            </p>
          </div>
          <Link href="/orcamento/demandas" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500">
            Nova demanda
          </Link>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-4">
          <Resumo titulo="Emitidos ativos" valor={emitidos} />
          <Resumo titulo="Vencidos" valor={vencidos} />
          <Resumo titulo="Cancelados" valor={cancelados} />
          <Resumo titulo="Total histórico" valor={totalHistorico} moeda />
        </section>

        <section className="mt-6 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-3">Versão</th>
                <th className="px-3 py-3">Demanda</th>
                <th className="px-3 py-3">Responsável</th>
                <th className="px-3 py-3">Emissão</th>
                <th className="px-3 py-3">Validade</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3 text-right">Comparação</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {versoes.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <Link href={`/orcamento/final/${item.id}`} className="font-medium text-primary hover:underline">
                      {item.numero}
                    </Link>
                    <p className="text-xs text-zinc-500">v{item.versao}{item.duplicada_de_id ? ` · duplicada de #${item.duplicada_de_id}` : ""}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/orcamento/demandas/${item.demanda_id}`} className="font-medium hover:underline">
                      {item.demandas_propostas?.titulo ?? `Demanda ${item.demanda_id}`}
                    </Link>
                    <p className="text-xs text-zinc-500">{item.demandas_propostas?.cliente_nome ?? "Cliente não informado"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{item.demandas_propostas?.responsavel_interno ?? item.criado_por ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{item.criado_por ? `usuário ${item.criado_por}` : "sem usuário registrado"}</p>
                  </td>
                  <td className="px-3 py-3">{formatDateTime(item.criado_em)}</td>
                  <td className="px-3 py-3">
                    <p>{item.valido_ate ?? "—"}</p>
                    <p className="text-xs text-zinc-500">{item.validade_dias} dias</p>
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{brl(Number(item.total_final ?? 0))}</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {item.anterior ? (
                      <Comparacao atual={Number(item.total_final ?? 0)} anterior={Number(item.anterior.total_final ?? 0)} />
                    ) : (
                      <span className="text-zinc-400">primeira versão</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Status status={item.status} />
                    {item.cancelado_motivo && <p className="mt-1 max-w-40 text-xs text-zinc-500">{item.cancelado_motivo}</p>}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form action={duplicarVersaoFinal}>
                        <input type="hidden" name="versao_id" value={item.id} />
                        <input type="hidden" name="validade_dias" value={item.validade_dias || 30} />
                        <button className="text-xs text-brand-700 hover:underline dark:text-brand-300">Duplicar</button>
                      </form>
                      {!["cancelado", "substituido"].includes(item.status) && (
                        <ConfirmActionButton
                          action={cancelarVersaoFinal}
                          fields={{ versao_id: item.id, motivo: "Cancelamento operacional pelo histórico." }}
                          trigger="Cancelar"
                          titulo="Cancelar versão final"
                          mensagem={`Cancelar a versão ${item.numero}? O snapshot continuará preservado no histórico.`}
                          confirmLabel="Cancelar versão"
                          triggerClassName="text-xs text-red-600 hover:underline"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {versoes.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-10 text-center text-zinc-400">
                    Nenhuma versão final emitida.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

function encontrarAnterior(versoes: VersaoFinal[], atual: VersaoFinal) {
  return versoes
    .filter((item) => item.demanda_id === atual.demanda_id && item.versao < atual.versao)
    .sort((a, b) => b.versao - a.versao)[0] ?? null;
}

function Resumo({ titulo, valor, moeda = false }: { titulo: string; valor: number; moeda?: boolean }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{moeda ? brl(valor) : valor.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function Comparacao({ atual, anterior }: { atual: number; anterior: number }) {
  const diferenca = atual - anterior;
  const percentual = anterior !== 0 ? (diferenca / anterior) * 100 : 0;
  const classe = diferenca > 0 ? "text-amber-700 dark:text-amber-300" : diferenca < 0 ? "text-brand-700 dark:text-brand-300" : "text-zinc-500";
  return (
    <div className={classe}>
      <p>{diferenca >= 0 ? "+" : ""}{brl(diferenca)}</p>
      <p className="text-xs">{percentual >= 0 ? "+" : ""}{percentual.toFixed(2).replace(".", ",")}%</p>
    </div>
  );
}

function Status({ status }: { status: string }) {
  const labels: Record<string, string> = {
    emitido: "Emitido",
    substituido: "Substituído",
    cancelado: "Cancelado",
    vencido: "Vencido",
  };
  const cls =
    status === "emitido"
      ? "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"
      : status === "vencido"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        : status === "cancelado"
          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{labels[status] ?? status}</span>;
}
