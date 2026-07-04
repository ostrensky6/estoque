import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClientUntyped } from "@/lib/supabase/server";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import { adicionarItem, removerItem, excluirPlano } from "@/lib/actions/planejamento";
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
import { formatNumber as fmt } from "@/lib/formatters";
import {
  loteSugeridoFefo,
  type LoteConferencia,
} from "@/lib/planejamento/conferencia-lotes";

export const dynamic = "force-dynamic";

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

  const [{ data: itens }, { data: analises }, { data: reservas }] = await Promise.all([
    supabase.from("planejamento_itens").select("id, codigo_analise, n_amostras, n_controles, repeticoes, perda_percentual").eq("planejamento_id", planId).order("id"),
    supabase.from("analises").select("codigo, nome").order("codigo"),
    supabase.from("reservas_estoque").select("status").eq("planejamento_id", planId),
  ]);

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

  const rs = (reservas ?? []) as { status: string }[];
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
  const baixaPendente = statusLabel === "Reservado";
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
    const loteSugerido = loteSugeridoFefo(lotesPorInsumo.get(d.insumo_id) ?? []);
    const loteSugeridoCompleto = loteSugerido
      ? lotesPorInsumo.get(d.insumo_id)?.find((lote) => lote.id === loteSugerido.id) ?? null
      : null;

    return {
      insumoId: d.insumo_id,
      especificacao: d.especificacao,
      unidade: d.unidade,
      quantidadePrevista: d.demanda,
      loteSugeridoId: loteSugerido?.id ?? null,
      loteSugeridoLabel: loteSugerido
        ? `#${loteSugerido.id}${loteSugeridoCompleto?.codigoLote ? ` · ${loteSugeridoCompleto.codigoLote}` : ""}`
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
        {baixaPendente && (
          <p className="mt-3 rounded-lg border border-warning-strong/30 bg-warning-soft px-4 py-2 text-sm text-warning-strong">
            Insumos reservados, mas a baixa definitiva ainda não foi feita. Use Iniciar quando a análise entrar em execução.
          </p>
        )}
        {plano.data_alvo && (
          <p className="mt-1 text-sm text-muted-foreground">Data alvo: {plano.data_alvo}</p>
        )}

        {/* itens do plano */}
        <section className="mt-8">
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
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Adicionar
            </button>
          </form>
        </section>

        {/* demanda */}
        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Demanda de insumos {temFalta && <span className="text-warning-strong">· há faltas</span>}
            </h2>
            {temFalta && (
              <form action={comprarFaltasDoPlano}>
                <input type="hidden" name="planejamento_id" value={planId} />
                <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90">
                  Comprar faltas
                </button>
              </form>
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-transparent text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Insumo</th>
                  <th className="px-4 py-3 text-left">Un.</th>
                  <th className="px-4 py-3 text-right">Demanda</th>
                  <th className="px-4 py-3 text-right">Disponível</th>
                  <th className="px-4 py-3 text-right">Falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {demanda.map((d) => (
                  <tr key={d.insumo_id} className={d.falta > 0 ? "bg-warning-soft/60" : ""}>
                    <td className="px-4 py-2 max-w-sm truncate" title={d.especificacao}>{d.especificacao}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.unidade ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(d.demanda)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{fmt(d.disponivel)}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-medium ${d.falta > 0 ? "text-warning-strong" : "text-muted-foreground/80"}`}>
                      {d.falta > 0 ? fmt(d.falta) : "—"}
                    </td>
                  </tr>
                ))}
                {demanda.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground/80">
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
        <section className="mt-8">
          <PlanoAcoes planId={planId} />
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
