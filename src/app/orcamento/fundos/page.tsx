import Link from "next/link";

import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { salvarAcompanhamentoFundos } from "@/lib/actions/orcamento-fundos";
import { temPapel } from "@/lib/auth/roles";
import { formatCurrency as brl, formatDate, formatPercent } from "@/lib/formatters";
import {
  calcularFundos,
  extrairFundosPrevistos,
  type FundosCalculados,
  type FundosLancamentos,
  type FundosPrevistos,
} from "@/lib/orcamento/fundos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type VersaoFinalRow = {
  id: number;
  demanda_id: number;
  versao: number;
  numero: string;
  status: string;
  total_final: number | null;
  valido_ate: string | null;
  criado_em: string;
  snapshot: unknown;
};

type DemandaRow = {
  id: number;
  titulo: string | null;
  cliente_nome: string | null;
  responsavel_interno: string | null;
};

type ParametrosAplicadosRow = {
  orcamento_final_versao_id: number | null;
  parametros_snapshot: unknown;
  criado_em: string;
};

type AcompanhamentoRow = {
  id: number;
  orcamento_final_versao_id: number;
  valor_recebido: number | null;
  impostos_pagos: number | null;
  incubacao_paga: number | null;
  reserva_gasta: number | null;
  investimento_gasto: number | null;
  reserva_saldo_ajustado: number | null;
  investimento_saldo_ajustado: number | null;
  saldo_ajustado_motivo: string | null;
  observacao: string | null;
  atualizado_em: string | null;
};

type FundoLinha = {
  versao: VersaoFinalRow;
  demanda: DemandaRow | null;
  acompanhamento: AcompanhamentoRow | null;
  previstos: FundosPrevistos;
  lancamentos: FundosLancamentos;
  calculo: FundosCalculados;
};

const inputCls = "h-8 w-full min-w-0 rounded-md border border-zinc-300 bg-white px-2 text-right text-xs font-semibold tabular-nums text-brand-700 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-brand-300 dark:focus:ring-brand-900";

export default async function FundosPage() {
  const supabase = await createClient();
  const podeEditar = await temPapel("gestor");
  const db = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => { order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
        neq: (column: string, value: unknown) => { order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
        in: (column: string, values: unknown[]) => { order: (column: string, options?: { ascending?: boolean }) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
      };
    };
  };

  const { data: versoesData, error } = await db
    .from("orcamento_final_versoes")
    .select("id, demanda_id, versao, numero, status, total_final, valido_ate, criado_em, snapshot")
    .eq("status", "aprovado")
    .order("criado_em", { ascending: false });
  if (error) throw new Error(error.message);

  const versoes = (versoesData ?? []) as VersaoFinalRow[];
  const versaoIds = versoes.map((versao) => versao.id);
  const demandaIds = [...new Set(versoes.map((versao) => versao.demanda_id).filter(Boolean))];

  const [{ data: demandasData }, { data: parametrosData }, { data: acompanhamentosData }] = versaoIds.length
    ? await Promise.all([
        db
          .from("demandas_propostas")
          .select("id, titulo, cliente_nome, responsavel_interno")
          .in("id", demandaIds)
          .order("id"),
        db
          .from("orcamento_parametros_aplicados")
          .select("orcamento_final_versao_id, parametros_snapshot, criado_em")
          .in("orcamento_final_versao_id", versaoIds)
          .order("criado_em", { ascending: false }),
        db
          .from("orcamento_fundos_acompanhamento")
          .select("id, orcamento_final_versao_id, valor_recebido, impostos_pagos, incubacao_paga, reserva_gasta, investimento_gasto, reserva_saldo_ajustado, investimento_saldo_ajustado, saldo_ajustado_motivo, observacao, atualizado_em")
          .in("orcamento_final_versao_id", versaoIds)
          .order("atualizado_em", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const demandas = new Map(((demandasData ?? []) as DemandaRow[]).map((demanda) => [demanda.id, demanda]));
  const parametrosPorVersao = new Map<number, ParametrosAplicadosRow>();
  for (const parametro of (parametrosData ?? []) as ParametrosAplicadosRow[]) {
    const id = Number(parametro.orcamento_final_versao_id);
    if (id && !parametrosPorVersao.has(id)) parametrosPorVersao.set(id, parametro);
  }
  const acompanhamentoPorVersao = new Map(((acompanhamentosData ?? []) as AcompanhamentoRow[]).map((item) => [item.orcamento_final_versao_id, item]));

  const linhas: FundoLinha[] = versoes.map((versao) => {
    const acompanhamento = acompanhamentoPorVersao.get(versao.id) ?? null;
    const parametros = parametrosPorVersao.get(versao.id);
    const previstos = extrairFundosPrevistos(parametros?.parametros_snapshot, versao.snapshot);
    const lancamentos = {
      valorRecebido: Number(acompanhamento?.valor_recebido ?? 0),
      impostosPagos: Number(acompanhamento?.impostos_pagos ?? 0),
      incubacaoPaga: Number(acompanhamento?.incubacao_paga ?? 0),
      reservaGasta: Number(acompanhamento?.reserva_gasta ?? 0),
      investimentoGasto: Number(acompanhamento?.investimento_gasto ?? 0),
      reservaSaldoAjustado: acompanhamento?.reserva_saldo_ajustado ?? null,
      investimentoSaldoAjustado: acompanhamento?.investimento_saldo_ajustado ?? null,
    };
    return {
      versao,
      demanda: demandas.get(versao.demanda_id) ?? null,
      acompanhamento,
      previstos,
      lancamentos,
      calculo: calcularFundos({
        totalFinal: Number(versao.total_final ?? 0),
        previstos,
        lancamentos,
      }),
    };
  });

  const totais = linhas.reduce(
    (acc, linha) => {
      acc.totalFinal += Number(linha.versao.total_final ?? 0);
      acc.recebido += linha.lancamentos.valorRecebido;
      acc.impostos += linha.calculo.liberado.impostos;
      acc.incubacao += linha.calculo.liberado.incubacao;
      acc.reserva += linha.calculo.liberado.reserva;
      acc.investimentos += linha.calculo.liberado.investimentos;
      acc.impostosPagos += linha.calculo.executado.impostos;
      acc.incubacaoPaga += linha.calculo.executado.incubacao;
      acc.reservaGasta += linha.calculo.executado.reserva;
      acc.investimentoGasto += linha.calculo.executado.investimentos;
      acc.reservaSaldo += linha.calculo.saldo.reserva;
      acc.investimentoSaldo += linha.calculo.saldo.investimentos;
      return acc;
    },
    {
      totalFinal: 0,
      recebido: 0,
      impostos: 0,
      incubacao: 0,
      reserva: 0,
      investimentos: 0,
      impostosPagos: 0,
      incubacaoPaga: 0,
      reservaGasta: 0,
      investimentoGasto: 0,
      reservaSaldo: 0,
      investimentoSaldo: 0,
    },
  );

  return (
    <div className="min-h-dvh bg-transparent font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-6 py-10">
        <Breadcrumbs items={[{ label: "Orçamentos", href: "/orcamento" }, { label: "Fundos e taxas" }]} />

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Fundos e taxas</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-500">
              Acompanhamento financeiro de orçamentos aprovados: recebimentos, impostos, incubação, baixas e saldos de fundos.
            </p>
          </div>
          <Link href="/orcamento/historico" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Histórico de orçamentos
          </Link>
        </div>

        <section className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Resumo titulo="Versões monitoradas" valor={linhas.length.toLocaleString("pt-BR")} detalhe="classificadas como aprovadas" />
          <Resumo titulo="Total aprovado" valor={brl(totais.totalFinal)} detalhe="base das versões finais aprovadas" />
          <Resumo titulo="Valor recebido" valor={brl(totais.recebido)} detalhe={formatPercent(totais.totalFinal > 0 ? (totais.recebido / totais.totalFinal) * 100 : 0)} />
          <Resumo titulo="Fundos liberados" valor={brl(totais.reserva + totais.investimentos)} detalhe="reserva + investimento" />
        </section>

        <section className="mt-6 grid gap-4 xl:grid-cols-2">
          <PainelConsolidado
            titulo="Impostos e incubação"
            linhas={[
              ["Impostos a pagar", totais.impostos, totais.impostosPagos],
              ["Incubação a pagar", totais.incubacao, totais.incubacaoPaga],
            ]}
          />
          <PainelConsolidado
            titulo="Fundos"
            linhas={[
              ["Fundo de reserva", totais.reserva, totais.reservaGasta, totais.reservaSaldo],
              ["Fundo de investimento", totais.investimentos, totais.investimentoGasto, totais.investimentoSaldo],
            ]}
          />
        </section>

        <section className="mt-6 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Acompanhamento por orçamento final</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Informe os recebimentos e a execução financeira para liberar os saldos na mesma proporção do pagamento recebido.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/50">
                <tr>
                  <th className="px-3 py-2">Orçamento</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Recebido</th>
                  <th className="px-3 py-2 text-right">Impostos pagos</th>
                  <th className="px-3 py-2 text-right">Incubação paga</th>
                  <th className="px-3 py-2 text-right">Baixa reserva</th>
                  <th className="px-3 py-2 text-right">Baixa invest.</th>
                  <th className="px-3 py-2 text-right">Saldo reserva</th>
                  <th className="px-3 py-2 text-right">Saldo invest.</th>
                  <th className="px-3 py-2">Saldos</th>
                  <th className="px-3 py-2">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {linhas.map((linha) => (
                  <tr key={linha.versao.id} className="align-top">
                    <td className="px-3 py-3">
                      <Link href={`/orcamento/final/${linha.versao.id}`} className="font-semibold text-primary hover:underline">
                        {linha.versao.numero}
                      </Link>
                      <p className="mt-0.5 text-xs text-zinc-500">{linha.demanda?.titulo ?? `Demanda #${linha.versao.demanda_id}`}</p>
                      <p className="text-xs text-zinc-500">
                        {linha.demanda?.cliente_nome ?? "Cliente sem nome"} · {rotuloStatus(linha.versao.status)} · validade {formatDate(linha.versao.valido_ate)}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{brl(Number(linha.versao.total_final ?? 0))}</td>
                    <td colSpan={7} className="px-3 py-3">
                      <form action={salvarAcompanhamentoFundos} className="grid grid-cols-7 gap-2">
                        <input type="hidden" name="orcamento_final_versao_id" value={linha.versao.id} />
                        <CampoMoeda name="valor_recebido" defaultValue={linha.lancamentos.valorRecebido} disabled={!podeEditar} />
                        <CampoMoeda name="impostos_pagos" defaultValue={linha.lancamentos.impostosPagos} disabled={!podeEditar} />
                        <CampoMoeda name="incubacao_paga" defaultValue={linha.lancamentos.incubacaoPaga} disabled={!podeEditar} />
                        <CampoMoeda name="reserva_gasta" defaultValue={linha.lancamentos.reservaGasta} disabled={!podeEditar} />
                        <CampoMoeda name="investimento_gasto" defaultValue={linha.lancamentos.investimentoGasto} disabled={!podeEditar} />
                        <CampoMoeda
                          name="reserva_saldo_ajustado"
                          defaultValue={linha.lancamentos.reservaSaldoAjustado}
                          disabled={!podeEditar}
                          placeholder={Math.max(0, linha.calculo.liberado.reserva - linha.calculo.executado.reserva).toFixed(2)}
                        />
                        <CampoMoeda
                          name="investimento_saldo_ajustado"
                          defaultValue={linha.lancamentos.investimentoSaldoAjustado}
                          disabled={!podeEditar}
                          placeholder={Math.max(0, linha.calculo.liberado.investimentos - linha.calculo.executado.investimentos).toFixed(2)}
                        />
                        <input
                          name="observacao"
                          defaultValue={linha.acompanhamento?.observacao ?? ""}
                          disabled={!podeEditar}
                          placeholder="Observação"
                          className="col-span-3 h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <input
                          name="saldo_ajustado_motivo"
                          defaultValue={linha.acompanhamento?.saldo_ajustado_motivo ?? ""}
                          disabled={!podeEditar}
                          placeholder="Motivo do saldo manual"
                          className="col-span-3 h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <button
                          disabled={!podeEditar}
                          className="h-8 rounded-md bg-brand-600 px-3 text-xs font-medium text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Salvar
                        </button>
                      </form>
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-1 text-xs">
                        <LinhaSaldo label="Recebido" valor={formatPercent(linha.calculo.percentualRecebido * 100)} />
                        <LinhaSaldo label="Impostos" valor={brl(linha.calculo.saldo.impostos)} />
                        <LinhaSaldo label="Incubação" valor={brl(linha.calculo.saldo.incubacao)} />
                        <LinhaSaldo label="Reserva" valor={brl(linha.calculo.saldo.reserva)} destaque />
                        <LinhaSaldo label="Invest." valor={brl(linha.calculo.saldo.investimentos)} destaque />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-500">
                      {linha.acompanhamento?.atualizado_em ? `Atualizado ${formatDate(linha.acompanhamento.atualizado_em)}` : "Sem lançamento"}
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-sm text-zinc-400">
                      Nenhum orçamento aprovado para acompanhar. Classifique uma versão final como Aprovado no Histórico de orçamentos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {!podeEditar && (
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40">
              Seu papel atual permite consultar fundos, mas lançamentos financeiros exigem perfil Gestor ou Administrador.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CampoMoeda({
  name,
  defaultValue,
  disabled,
  placeholder,
}: {
  name: string;
  defaultValue?: number | null;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <input
      name={name}
      type="number"
      min="0"
      step="0.01"
      defaultValue={defaultValue || ""}
      disabled={disabled}
      placeholder={placeholder}
      className={inputCls}
    />
  );
}

function Resumo({ titulo, valor, detalhe }: { titulo: string; valor: string; detalhe: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor}</p>
      <p className="mt-1 text-xs text-zinc-500">{detalhe}</p>
    </div>
  );
}

function PainelConsolidado({ titulo, linhas }: { titulo: string; linhas: Array<[string, number, number, number?]> }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <div className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
        {linhas.map(([label, liberado, executado, saldo]) => (
          <div key={label} className="grid grid-cols-4 gap-3 py-2 text-sm">
            <span className="font-medium">{label}</span>
            <span className="text-right tabular-nums text-zinc-500">{brl(liberado)} liberado</span>
            <span className="text-right tabular-nums text-zinc-500">{brl(executado)} executado</span>
            <span className="text-right font-semibold tabular-nums">{brl(saldo ?? liberado - executado)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function LinhaSaldo({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${destaque ? "font-semibold text-brand-700 dark:text-brand-300" : "text-zinc-600 dark:text-zinc-300"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
  );
}

function rotuloStatus(status: string) {
  const labels: Record<string, string> = {
    emitido: "Emitido",
    enviado: "Enviado",
    alterado_reenviado: "Alterado e reenviado",
    vencido: "Vencido",
    substituido: "Substituído",
    aprovado: "Aprovado",
    recusado: "Recusado",
  };
  return labels[status] ?? status;
}
