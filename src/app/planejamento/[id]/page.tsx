import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClientUntyped } from "@/lib/supabase/server";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import { gargalo, type Etapa } from "@/lib/costing/engine";
import {
  adicionarItem,
  removerItem,
  excluirPlano,
  atualizarPlanejamentoExecutivo,
  reservarEquipamentoDoPlano,
} from "@/lib/actions/planejamento";
import { comprarFaltasDoPlano } from "@/lib/actions/compras";
import { PlanoAcoes } from "@/components/planejamento/PlanoAcoes";
import {
  PlanejamentoConferenciaLotes,
  type PlanoConferenciaInsumo,
  type PlanoConferenciaRegistro,
} from "@/components/planejamento/PlanejamentoConferenciaLotes";
import { ConfirmActionButton } from "@/components/common/ConfirmActionButton";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { Combobox } from "@/components/ui/combobox";
import { formatCurrency, formatNumber as fmt } from "@/lib/formatters";
import {
  loteSugeridoFefo,
  type LoteConferencia,
} from "@/lib/planejamento/conferencia-lotes";

export const dynamic = "force-dynamic";

function erroSchemaCache(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("Could not find the")),
  );
}

async function consultarReservasPlano(supabase: Awaited<ReturnType<typeof createClientUntyped>>, planId: number) {
  const full = await supabase
    .from("reservas_estoque")
    .select("id, status, insumo_id, lote_id, quantidade, quantidade_consumida, lotes_estoque(codigo_lote, validade, validade_apos_abertura)")
    .eq("planejamento_id", planId);

  if (!erroSchemaCache(full.error)) return full;

  return supabase
    .from("reservas_estoque")
    .select("id, status, insumo_id, quantidade")
    .eq("planejamento_id", planId);
}

export default async function PlanoDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const planId = Number(id);
  const supabase = await createClient();
  const supabaseUntyped = await createClientUntyped();

  const { data: plano } = await supabase
    .from("planejamento")
    .select("*")
    .eq("id", planId)
    .single();
  if (!plano) notFound();

  const planoOperacional = plano as typeof plano & {
    data_inicio_prevista?: string | null;
    data_fim_prevista?: string | null;
    prioridade?: string | null;
    origem_planejamento?: string | null;
    planejado_por?: string | null;
    reservado_por?: string | null;
    validado_por?: string | null;
    validado_em?: string | null;
  };

  const [{ data: itens }, { data: analises }, { data: reservas }, { data: projetos }, { data: margemRealRows }] = await Promise.all([
    supabase.from("planejamento_itens").select("id, codigo_analise, n_amostras, n_controles, repeticoes, perda_percentual").eq("planejamento_id", planId).order("id"),
    supabase.from("analises").select("codigo, nome").order("codigo"),
    consultarReservasPlano(supabaseUntyped, planId),
    supabase.from("projetos").select("id, nome").order("nome"),
    supabase.from("v_margem_real_planejamento").select("*").eq("planejamento_id", planId).limit(1),
  ]);
  const margemReal = margemRealRows?.[0] ?? null;

  const codigosPlano = [...new Set((itens ?? []).map((item) => item.codigo_analise).filter(Boolean))];
  const { data: vinculosEquipamento } = codigosPlano.length > 0
    ? await supabaseUntyped
        .from("equipamento_analise")
        .select("codigo_analise, equipamento_id")
        .in("codigo_analise", codigosPlano)
    : { data: [] };
  const equipamentoIds = [...new Set((vinculosEquipamento ?? []).map((vinculo) => Number(vinculo.equipamento_id)).filter(Number.isFinite))];
  const { data: etapasPlano } = codigosPlano.length > 0
    ? await supabase.from("etapas").select("*").in("codigo_analise", codigosPlano)
    : { data: [] };
  const [{ data: unidadesEquipamento }, { data: reservasEquipamento }] = equipamentoIds.length > 0
    ? await Promise.all([
        supabaseUntyped
          .from("equipamento_unidades")
          .select("id, equipamento_id, codigo_patrimonio, status_operacional, ativo, equipamentos(nome)")
          .in("equipamento_id", equipamentoIds)
          .order("id"),
        supabaseUntyped
          .from("equipamento_reservas")
          .select("id, equipamento_unidade_id, planejamento_id, data_inicio, data_fim, status")
          .in("status", ["reservado", "em_uso"]),
      ])
    : [{ data: [] }, { data: [] }];

  const demanda = await computarDemandaPlano(supabase, planId);
  const demandaIds = demanda.map((d) => d.insumo_id);
  const [{ data: lotesConferencia }, { data: conferenciasPlanejamento }] = demandaIds.length > 0
    ? await Promise.all([
        supabase
          .from("lotes_estoque")
          .select("id, insumo_id, codigo_lote, validade, validade_apos_abertura, quantidade_atual, status")
          .in("insumo_id", demandaIds)
          .gt("quantidade_atual", 0),
        supabaseUntyped
          .from("planejamento_lote_conferencias")
          .select("id, insumo_id, lote_id, quantidade_conferida, status, justificativa, conferido_em")
          .eq("planejamento_id", planId)
          .order("conferido_em", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const rs = (reservas ?? []) as Array<{
    id: number;
    status: string;
    insumo_id: number;
    lote_id: number | null;
    quantidade: number;
    quantidade_consumida?: number | null;
    lotes_estoque?: { codigo_lote: string | null; validade: string | null; validade_apos_abertura: string | null } | null;
  }>;
  const reservasPorInsumo = new Map<number, typeof rs>();
  for (const reserva of rs) {
    const insumoId = Number(reserva.insumo_id);
    reservasPorInsumo.set(insumoId, [...(reservasPorInsumo.get(insumoId) ?? []), reserva]);
  }
  const status = rs.some((r) => r.status === "consumido")
    ? "Iniciado"
    : rs.some((r) => r.status === "reservado")
      ? "Reservado"
      : rs.length > 0
        ? "Liberado"
        : "Rascunho";
  const statusOperacional = (plano as unknown as { status_operacional?: string | null }).status_operacional;
  const statusLabel =
    statusOperacional === "concluido"
      ? "Concluído"
      : statusOperacional === "em_execucao"
        ? "Em execução"
        : statusOperacional === "cancelado"
          ? "Cancelado"
          : statusOperacional === "reservado"
            ? "Reservado"
            : status;
  const temFalta = demanda.some((d) => d.falta > 0);
  const demandaTotal = demanda.reduce((sum, item) => sum + item.demanda, 0);
  const fisicoDisponivelTotal = demanda.reduce((sum, item) => sum + item.disponivel, 0);
  const faltaTotal = demanda.reduce((sum, item) => sum + item.falta, 0);
  const valorUsoEstimadoTotal = demanda.reduce((sum, item) => sum + item.custoEstimado, 0);
  const valorCompraEstimadoTotal = demanda.reduce((sum, item) => sum + item.valorCompraEstimado, 0);
  const reservadoTotal = rs
    .filter((r) => r.status === "reservado")
    .reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
  const contextoCompleto = Boolean(
    plano.projeto_id
      && planoOperacional.data_inicio_prevista
      && planoOperacional.data_fim_prevista,
  );
  const baixaPendente = statusLabel === "Reservado";
  const inicioReservaPadrao = planoOperacional.data_inicio_prevista ? `${planoOperacional.data_inicio_prevista}T08:00` : "";
  const fimReservaPadrao = planoOperacional.data_fim_prevista ? `${planoOperacional.data_fim_prevista}T18:00` : "";
  const analisesPorEquipamento = new Map<number, string[]>();
  for (const vinculo of vinculosEquipamento ?? []) {
    const equipamentoId = Number(vinculo.equipamento_id);
    analisesPorEquipamento.set(equipamentoId, [...(analisesPorEquipamento.get(equipamentoId) ?? []), String(vinculo.codigo_analise)]);
  }
  const reservasPorUnidade = new Map<number, Array<{ id: number; planejamento_id: number | null; data_inicio: string; data_fim: string; status: string }>>();
  for (const reserva of reservasEquipamento ?? []) {
    const unidadeId = Number(reserva.equipamento_unidade_id);
    reservasPorUnidade.set(unidadeId, [...(reservasPorUnidade.get(unidadeId) ?? []), {
      id: Number(reserva.id),
      planejamento_id: reserva.planejamento_id == null ? null : Number(reserva.planejamento_id),
      data_inicio: String(reserva.data_inicio),
      data_fim: String(reserva.data_fim),
      status: String(reserva.status),
    }]);
  }
  const equipamentosCobertos = new Set<number>();
  for (const reserva of reservasEquipamento ?? []) {
    if (Number(reserva.planejamento_id) !== planId || !["reservado", "em_uso"].includes(String(reserva.status))) continue;
    const unidade = (unidadesEquipamento ?? []).find((item) => Number(item.id) === Number(reserva.equipamento_unidade_id));
    if (unidade?.ativo && !["em_manutencao", "calibracao_vencida", "inativo", "descartado"].includes(String(unidade.status_operacional))) {
      equipamentosCobertos.add(Number(unidade.equipamento_id));
    }
  }
  const temBloqueioEquipamentos = equipamentoIds.some((equipamentoId) => !equipamentosCobertos.has(equipamentoId));
  const capacidadePorAnalise = (itens ?? []).map((item) => {
    const g = gargalo(((etapasPlano ?? []).filter((etapa) => etapa.codigo_analise === item.codigo_analise)) as Etapa[]);
    const amostrasPlanejadas = (Number(item.n_amostras ?? 0) + Number(item.n_controles ?? 0))
      * Math.max(1, Number(item.repeticoes ?? 1))
      * (1 + Math.max(0, Number(item.perda_percentual ?? 0)) / 100);
    const capacidadeDia = Number(g.amostrasDia ?? 0);
    return {
      codigo: item.codigo_analise,
      amostrasPlanejadas,
      capacidadeDia,
      diasProjetados: capacidadeDia > 0 ? Math.ceil(amostrasPlanejadas / capacidadeDia) : null,
    };
  });
  const lotesPorInsumo = new Map<number, (LoteConferencia & { codigoLote: string | null })[]>();
  for (const lote of lotesConferencia ?? []) {
    const insumoId = Number(lote.insumo_id);
    if (!Number.isInteger(insumoId) || insumoId <= 0) continue;
    const linha = {
      id: Number(lote.id),
      insumoId,
      codigoLote: lote.codigo_lote ? String(lote.codigo_lote) : null,
      quantidadeAtual: Number(lote.quantidade_atual ?? 0),
      status: String(lote.status ?? ""),
      validade: lote.validade ? String(lote.validade) : null,
      validadeAposAbertura: lote.validade_apos_abertura ? String(lote.validade_apos_abertura) : null,
    };
    lotesPorInsumo.set(insumoId, [...(lotesPorInsumo.get(insumoId) ?? []), linha]);
  }
  const insumosConferencia: PlanoConferenciaInsumo[] = demanda.map((d) => {
    const loteReservado = (reservasPorInsumo.get(d.insumo_id) ?? []).find((reserva) =>
      reserva.status === "reservado" && reserva.lote_id != null,
    );
    const loteSugerido = loteSugeridoFefo(lotesPorInsumo.get(d.insumo_id) ?? []);
    const loteSugeridoCompleto = loteSugerido
      ? lotesPorInsumo.get(d.insumo_id)?.find((lote) => lote.id === loteSugerido.id) ?? null
      : null;
    const loteReferenciaId = loteReservado?.lote_id ?? loteSugerido?.id ?? null;

    return {
      insumoId: d.insumo_id,
      especificacao: d.especificacao,
      unidade: d.unidade,
      quantidadePrevista: d.demanda,
      loteSugeridoId: loteReferenciaId,
      loteSugeridoLabel: loteReservado?.lote_id
        ? `reservado #${loteReservado.lote_id}`
        : loteSugerido
        ? `FEFO #${loteSugerido.id}${loteSugeridoCompleto?.codigoLote ? ` · ${loteSugeridoCompleto.codigoLote}` : ""}`
        : null,
    };
  });
  const conferencias: PlanoConferenciaRegistro[] = (conferenciasPlanejamento ?? []).map((row) => ({
    id: Number(row.id),
    insumoId: Number(row.insumo_id),
    loteId: Number(row.lote_id),
    quantidadeConferida: Number(row.quantidade_conferida ?? 0),
    status: String(row.status ?? ""),
    justificativa: row.justificativa ? String(row.justificativa) : null,
  }));

  const inp = "rounded-md border border-input bg-card px-3 py-2 text-sm font-medium text-brand-700 dark:text-brand-300"; // §8.2: entrada em azul

  return (
    <div className="min-h-dvh bg-transparent font-sans text-foreground">
      <main className="app-page-container">
        <Breadcrumbs items={[{ label: "Planejamento", href: "/planejamento" }, { label: plano.nome ?? `Plano #${planId}` }]} />
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{plano.nome}</h1>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {statusLabel}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Planejamento executivo independente do orçamento: projeto, período,
          estoque físico, reservas de lote, faltas e compras.
        </p>
        <nav className="sticky top-0 z-10 mt-4 overflow-x-auto border-y border-border bg-background/95 py-2 backdrop-blur" aria-label="Etapas do planejamento">
          <div className="flex min-w-max gap-2">
            {[
              ["#contexto", "Resumo", statusLabel],
              ["#margem", "Margem", margemReal ? "calculada" : "sem orçamento"],
              ["#capacidade", "Capacidade", `${capacidadePorAnalise.length} análise(s)`],
              ["#analises", "Análises", `${itens?.length ?? 0} item(ns)`],
              ["#materiais", "Materiais", temFalta ? `${faltaTotal} em falta` : "disponível"],
              ["#acoes", "Próxima ação", statusLabel],
            ].map(([href, label, meta]) => (
              <a key={href} href={href} className="app-nav-level-3 rounded-md border border-primary/20 px-3 py-2 text-left text-xs text-brand-800 shadow-xs transition hover:border-primary/40 hover:text-brand-900 dark:text-brand-300">
                <span className="block font-semibold">{label}</span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">{meta}</span>
              </a>
            ))}
          </div>
        </nav>
        {!contextoCompleto && (
          <p className="mt-3 rounded-lg border border-warning-strong/30 bg-warning-soft px-4 py-2 text-sm text-warning-strong">
            Informe projeto e período previsto antes de reservar insumos. O orçamento pode ser origem, mas a execução nasce aqui.
          </p>
        )}
        {baixaPendente && (
          <p className="mt-3 rounded-lg border border-warning-strong/30 bg-warning-soft px-4 py-2 text-sm text-warning-strong">
            Insumos reservados, mas a baixa definitiva ainda não foi feita. Use Iniciar quando a análise entrar em execução.
          </p>
        )}
        {plano.data_alvo && (
          <p className="mt-1 text-sm text-muted-foreground">Data alvo: {plano.data_alvo}</p>
        )}

        {margemReal && (
          <section id="margem" className="mt-4 scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Margem prevista × realizada</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  A realização usa somente as baixas por lote deste plano; mão de obra, equipamentos e overhead ainda não possuem apontamento por execução.
                </p>
              </div>
              <Link href={`/orcamento/${margemReal.orcamento_id}`} className="text-xs font-medium text-primary hover:underline">
                Abrir orçamento de origem
              </Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <IndicadorMargem titulo="Receita orçada" valor={Number(margemReal.receita_orcada ?? 0)} />
              <IndicadorMargem titulo="Custo técnico orçado" valor={Number(margemReal.custo_orcado ?? 0)} />
              <IndicadorMargem titulo="Insumos baixados (real)" valor={Number(margemReal.custo_real_insumos ?? 0)} />
              <IndicadorMargem
                titulo="Margem real parcial"
                valor={Number(margemReal.margem_real_parcial ?? 0)}
                detalhe={margemReal.margem_real_parcial_percentual == null ? "sem receita orçada" : `${Number(margemReal.margem_real_parcial_percentual).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da receita`}
                destaque
              />
            </div>
          </section>
        )}

        <section id="capacidade" className="mt-4 scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Capacidade e equipamentos do plano</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                As unidades abaixo vêm da receita das análises. A reserva é bloqueada se houver manutenção, calibração vencida ou sobreposição de agenda.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {codigosPlano.length} análise(s) · {unidadesEquipamento?.length ?? 0} unidade(s) candidata(s)
            </span>
          </div>
          {!contextoCompleto && (
            <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-strong">
              Defina projeto e período previsto para habilitar a reserva de equipamentos.
            </p>
          )}
          <div className="mt-3 space-y-3">
            {capacidadePorAnalise.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="px-3 py-2 text-left">Análise</th><th className="px-3 py-2 text-right">Amostras planejadas</th><th className="px-3 py-2 text-right">Capacidade/dia</th><th className="px-3 py-2 text-right">Prazo projetado</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {capacidadePorAnalise.map((capacidade, index) => (
                      <tr key={`${capacidade.codigo}-${index}`}>
                        <td className="px-3 py-2 font-medium">{capacidade.codigo}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(capacidade.amostrasPlanejadas)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums ${capacidade.capacidadeDia <= 0 ? "text-danger-strong" : ""}`}>{capacidade.capacidadeDia > 0 ? fmt(capacidade.capacidadeDia) : "não cadastrada"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{capacidade.diasProjetados == null ? "—" : `${capacidade.diasProjetados} dia(s)`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(unidadesEquipamento ?? []).map((unidade) => {
              const reservasAtivas = reservasPorUnidade.get(Number(unidade.id)) ?? [];
              const reservaDestePlano = reservasAtivas.find((reserva) => reserva.planejamento_id === planId);
              const bloqueada = !unidade.ativo || ["em_manutencao", "calibracao_vencida", "inativo", "descartado"].includes(String(unidade.status_operacional));
              const ocupadaPorOutro = reservasAtivas.some((reserva) => reserva.planejamento_id !== planId);
              const equipamento = Array.isArray(unidade.equipamentos) ? unidade.equipamentos[0] : unidade.equipamentos;
              return (
                <div key={unidade.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{equipamento?.nome ?? `Equipamento #${unidade.equipamento_id}`}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {unidade.codigo_patrimonio ?? `Unidade #${unidade.id}`} · análises: {(analisesPorEquipamento.get(Number(unidade.equipamento_id)) ?? []).join(", ") || "—"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${bloqueada ? "bg-danger-soft text-danger-strong" : ocupadaPorOutro ? "bg-warning-soft text-warning-strong" : "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300"}`}>
                      {bloqueada ? String(unidade.status_operacional).replaceAll("_", " ") : ocupadaPorOutro ? "agenda ocupada" : reservaDestePlano ? "reservado neste plano" : "disponível"}
                    </span>
                  </div>
                  {reservaDestePlano ? (
                    <p className="mt-3 text-xs text-muted-foreground">Reserva deste plano: {new Date(reservaDestePlano.data_inicio).toLocaleString("pt-BR")} → {new Date(reservaDestePlano.data_fim).toLocaleString("pt-BR")}</p>
                  ) : (
                    <form action={reservarEquipamentoDoPlano} className="mt-3 grid gap-2 md:grid-cols-4">
                      <input type="hidden" name="planejamento_id" value={planId} />
                      <input type="hidden" name="equipamento_unidade_id" value={unidade.id} />
                      <input name="data_inicio" type="datetime-local" defaultValue={inicioReservaPadrao} disabled={!contextoCompleto || bloqueada} className={`${inp} w-full`} />
                      <input name="data_fim" type="datetime-local" defaultValue={fimReservaPadrao} disabled={!contextoCompleto || bloqueada} className={`${inp} w-full`} />
                      <input name="observacao" placeholder="Observação (opcional)" disabled={!contextoCompleto || bloqueada} className={`${inp} w-full`} />
                      <button disabled={!contextoCompleto || bloqueada} className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">
                        Reservar unidade
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            {equipamentoIds.length === 0 && (
              <p className="rounded-md bg-muted/50 px-3 py-3 text-sm text-muted-foreground">Nenhum equipamento está vinculado às análises deste plano. Vincule equipamentos na ficha técnica da análise para avaliar a capacidade operacional.</p>
            )}
          </div>
        </section>

        <section id="contexto" className="mt-6 scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contexto operacional
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Estes dados comandam reserva, compra e baixa. Orçamento fica apenas como origem auditável.
              </p>
            </div>
            <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>Planejado por: <b className="text-foreground">{planoOperacional.planejado_por ?? "—"}</b></span>
              <span>Reservado por: <b className="text-foreground">{planoOperacional.reservado_por ?? "—"}</b></span>
            </div>
          </div>

          <form action={atualizarPlanejamentoExecutivo} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <input type="hidden" name="planejamento_id" value={planId} />
            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Nome</label>
              <input name="nome" defaultValue={plano.nome ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Projeto</label>
              <select name="projeto_id" defaultValue={plano.projeto_id ?? ""} className={`${inp} mt-1 w-full`}>
                <option value="">—</option>
                {(projetos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Prioridade</label>
              <select name="prioridade" defaultValue={planoOperacional.prioridade ?? "normal"} className={`${inp} mt-1 w-full`}>
                <option value="baixa">Baixa</option>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Início previsto</label>
              <input name="data_inicio_prevista" type="date" defaultValue={planoOperacional.data_inicio_prevista ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Fim previsto</label>
              <input name="data_fim_prevista" type="date" defaultValue={planoOperacional.data_fim_prevista ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Data alvo</label>
              <input name="data_alvo" type="date" defaultValue={plano.data_alvo ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Responsável</label>
              <input name="responsavel" defaultValue={plano.responsavel ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Observação operacional</label>
              <input name="observacao" defaultValue={plano.observacao ?? ""} className={`${inp} mt-1 w-full`} />
            </div>
            <div className="flex items-end justify-start">
              <button className="app-action-compact bg-primary text-primary-foreground hover:bg-primary/90">
                Salvar
              </button>
            </div>
          </form>
        </section>

        {/* itens do plano */}
        <section id="analises" className="mt-8 scroll-mt-24">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Análises do plano
          </h2>
          <div className="mt-3 space-y-2">
            {(itens ?? []).map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-2 text-sm">
                <span>
                  <span className="font-medium">{it.codigo_analise}</span>
                  <span className="text-muted-foreground">
                    {" · "}{fmt(it.n_amostras)} amostras
                    {(it.n_controles ?? 0) > 0 ? ` + ${fmt(it.n_controles)} controles` : ""}
                    {(it.repeticoes ?? 1) !== 1 ? ` × ${fmt(it.repeticoes)} rep.` : ""}
                    {(it.perda_percentual ?? 0) > 0 ? ` · ${fmt(it.perda_percentual)}% perda` : ""}
                  </span>
                </span>
                <form action={removerItem}>
                  <input type="hidden" name="item_id" value={it.id} />
                  <input type="hidden" name="planejamento_id" value={planId} />
                  <button className="text-xs text-danger-strong hover:underline">Remover</button>
                </form>
              </div>
            ))}
            {(itens ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground/80">Nenhuma análise. Adicione abaixo.</p>
            )}
          </div>

          <form action={adicionarItem} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="planejamento_id" value={planId} />
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Análise</label>
              <div className="w-64">
                <Combobox
                  name="codigo_analise"
                  placeholder="Selecione…"
                  searchPlaceholder="Buscar análise…"
                  emptyText="Nenhuma análise."
                  options={(analises ?? []).map((a) => ({
                    value: a.codigo,
                    label: a.codigo,
                    hint: a.nome ?? undefined,
                  }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Amostras</label>
              <input name="n_amostras" type="number" min="1" step="1" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Controles</label>
              <input name="n_controles" type="number" min="0" step="1" defaultValue="0" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">Repetições</label>
              <input name="repeticoes" type="number" min="1" step="1" defaultValue="1" className={`${inp} w-24`} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground/80">% perda</label>
              <input name="perda_percentual" type="number" min="0" step="1" defaultValue="0" className={`${inp} w-20`} />
            </div>
            <button className="app-action-compact bg-primary text-primary-foreground hover:bg-primary/90">
              Adicionar
            </button>
          </form>
        </section>

        {/* demanda */}
        <section id="materiais" className="mt-8 scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Demanda de insumos {temFalta && <span className="text-warning-strong">· há faltas</span>}
              </h2>
              {temFalta && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Faltas não viram compra direta: elas abrem um pedido interno para seguir validação, compras e recebimento.
                </p>
              )}
            </div>
            {temFalta && (
              <form action={comprarFaltasDoPlano}>
                <input type="hidden" name="planejamento_id" value={planId} />
                <button className="app-action-compact bg-primary text-primary-foreground hover:bg-primary/90">
                  Gerar pedido interno
                </button>
              </form>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Demanda prevista</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(demandaTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(valorUsoEstimadoTotal)} em uso previsto</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Físico disponível</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(fisicoDisponivelTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Saldo livre agora, sem quarentena/vencidos</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-medium text-muted-foreground">Comprometido no plano</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmt(reservadoTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Lotes já reservados para esta execução</p>
            </div>
            <div className={`rounded-lg border p-3 ${faltaTotal > 0 ? "border-warning-strong/30 bg-warning-soft" : "border-border bg-card"}`}>
              <p className="text-xs font-medium text-muted-foreground">Falta operacional</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${faltaTotal > 0 ? "text-warning-strong" : ""}`}>{fmt(faltaTotal)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(valorCompraEstimadoTotal)} em pedido ajustado</p>
            </div>
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-transparent text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left">Un.</th>
                  <th className="px-4 py-3 text-right">Demanda</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-left">Lote reservado</th>
                  <th className="px-4 py-3 text-right">Falta</th>
                  <th className="px-4 py-3 text-right">Qtd. pedido</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {demanda.map((d) => {
                  const reservasInsumo = reservasPorInsumo.get(d.insumo_id) ?? [];
                  const minimoCompra = d.quantidadeMinimaCompra ?? d.quantidadeEmbalagem;
                  return (
                    <tr key={d.insumo_id} className={d.falta > 0 ? "bg-warning-soft/60" : ""}>
                      <td className="px-4 py-2 max-w-sm truncate" title={d.especificacao}>{d.especificacao}</td>
                      <td className="px-4 py-2 text-muted-foreground">{d.unidade ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{fmt(d.demanda)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmt(d.disponivel)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {reservasInsumo.length > 0 ? (
                          <div className="space-y-1">
                            {reservasInsumo.map((reserva) => (
                              <div key={reserva.id}>
                                {reserva.lote_id ? (
                                  <Link href={`/estoque/lotes/${reserva.lote_id}`} className="font-medium text-primary hover:underline">
                                    #{reserva.lote_id}
                                  </Link>
                                ) : "sem lote"}
                                {" · "}
                                {fmt(reserva.quantidade)} · {reserva.status}
                              </div>
                            ))}
                          </div>
                        ) : "—"}
                      </td>
                      <td className={`px-4 py-2 text-right tabular-nums font-medium ${d.falta > 0 ? "text-warning-strong" : "text-muted-foreground/80"}`}>
                        {d.falta > 0 ? fmt(d.falta) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {d.quantidadeCompra > 0 ? (
                          <div>
                            <span className="font-medium">{fmt(d.quantidadeCompra)}</span>
                            {minimoCompra ? (
                              <p className="text-[11px] text-muted-foreground">
                                mín. {fmt(minimoCompra)} {d.unidade ?? ""}
                              </p>
                            ) : null}
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {d.valorCompraEstimado > 0 ? (
                          <div>
                            <span className="font-medium">{formatCurrency(d.valorCompraEstimado)}</span>
                            <p className="text-[11px] text-muted-foreground">
                              {d.custoUnitario == null ? "sem custo un." : `${formatCurrency(d.custoUnitario)}/un.`}
                            </p>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {demanda.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground/80">
                      Adicione análises para calcular a demanda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {baixaPendente && insumosConferencia.length > 0 && (
          <PlanejamentoConferenciaLotes
            planId={planId}
            insumos={insumosConferencia}
            conferencias={conferencias}
          />
        )}

        {/* ações */}
        <section id="acoes" className="mt-8 scroll-mt-24">
          <PlanoAcoes
            planId={planId}
            status={statusLabel}
            temFalta={temFalta}
            contextoCompleto={contextoCompleto}
            temBloqueioEquipamentos={temBloqueioEquipamentos}
          />
          <div className="mt-6">
            <ConfirmActionButton
              action={excluirPlano}
              fields={{ planejamento_id: planId }}
              trigger="Excluir plano"
              titulo="Excluir plano"
              mensagem={`Excluir o plano “${plano.nome}”? Esta ação não pode ser desfeita.`}
              confirmLabel="Excluir plano"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function IndicadorMargem({ titulo, valor, detalhe, destaque = false }: { titulo: string; valor: number; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30" : "border-border bg-muted/30"}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{formatCurrency(valor)}</p>
      {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
    </div>
  );
}
