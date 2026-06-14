import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gargalo, insumosSelecionados, type Etapa, type InsumoLinha } from "./engine";

export type DemandaLinha = {
  insumo_id: number;
  especificacao: string;
  unidade: string | null;
  demanda: number;
  disponivel: number;
  falta: number;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

/**
 * Demanda de insumos de um plano: nº de amostras × consumo/amostra, somando
 * todas as análises do plano. Reusa a seleção de grupo e a lógica por_execucao
 * da engine de custeio, garantindo coerência entre custo e consumo.
 */
export async function computarDemandaPlano(
  supabase: SupabaseClient,
  planId: number,
): Promise<DemandaLinha[]> {
  const { data: itens } = await supabase
    .from("planejamento_itens")
    .select("codigo_analise, n_amostras, n_controles, repeticoes, perda_percentual")
    .eq("planejamento_id", planId);

  if (!itens || itens.length === 0) return [];

  const codigos = [...new Set(itens.map((i) => i.codigo_analise as string))];
  const [{ data: etapas }, { data: ia }] = await Promise.all([
    supabase.from("etapas").select("*").in("codigo_analise", codigos),
    supabase
      .from("insumo_analise")
      .select(
        "codigo_analise, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumo_id, insumos(custo_unitario)",
      )
      .in("codigo_analise", codigos),
  ]);

  // agrega demanda por insumo_id
  const agg = new Map<number, { especificacao: string; demanda: number }>();

  for (const item of itens) {
    const codigo = item.codigo_analise as string;
    // N efetivo = (amostras + controles) × repetições × (1 + perda%)
    const repeticoes = num(item.repeticoes) || 1;
    const perda = num(item.perda_percentual) / 100;
    const n = (num(item.n_amostras) + num(item.n_controles)) * repeticoes * (1 + perda);
    const et = ((etapas ?? []) as Etapa[]).filter(
      (e) => (e as unknown as { codigo_analise: string }).codigo_analise === codigo,
    );
    const lote = gargalo(et).amostrasPorExecucao;

    const linhas: InsumoLinha[] = ((ia ?? []) as unknown[])
      .filter((x) => (x as { codigo_analise: string }).codigo_analise === codigo)
      .map((x) => {
        const r = x as {
          nome_etapa: string;
          nome_atividade: string;
          especificacao_insumo: string | null;
          grupo_escolha: string | null;
          quantidade_por_amostra: number | null;
          modo_cobranca: string | null;
          insumo_id: number | null;
          insumos: { custo_unitario: number | null } | null;
        };
        return {
          nome_etapa: r.nome_etapa,
          nome_atividade: r.nome_atividade,
          especificacao_insumo: r.especificacao_insumo,
          grupo_escolha: r.grupo_escolha,
          quantidade_por_amostra: r.quantidade_por_amostra,
          modo_cobranca: r.modo_cobranca,
          custo_unitario: r.insumos?.custo_unitario ?? null,
          insumo_id: r.insumo_id,
        };
      });

    for (const l of insumosSelecionados(linhas)) {
      if (l.insumo_id == null) continue;
      const q = num(l.quantidade_por_amostra);
      const qty =
        l.modo_cobranca === "por_execucao"
          ? q * (lote > 0 ? Math.ceil(n / lote) : 1)
          : q * n;
      const cur = agg.get(l.insumo_id) ?? {
        especificacao: l.especificacao_insumo ?? "",
        demanda: 0,
      };
      cur.demanda += qty;
      agg.set(l.insumo_id, cur);
    }
  }

  const ids = [...agg.keys()];
  if (ids.length === 0) return [];

  const [{ data: saldo }, { data: convs }] = await Promise.all([
    supabase.from("v_estoque_saldo").select("insumo_id, unidade, disponivel").in("insumo_id", ids),
    supabase.from("insumos").select("id, fator_conversao").in("id", ids),
  ]);
  const sMap = new Map(
    (saldo ?? []).map((s) => [s.insumo_id as number, s as { unidade: string | null; disponivel: number }]),
  );
  // 2.5 — ponte de unidades: a demanda é calculada em unidades de CONSUMO; o
  // estoque está em unidades de ESTOQUE. Converte antes de comparar/reservar.
  const fMap = new Map((convs ?? []).map((c) => [c.id as number, num(c.fator_conversao) || 1]));

  return ids
    .map((id) => {
      const d = agg.get(id)!;
      const s = sMap.get(id);
      const fator = fMap.get(id) || 1;
      const demanda = fator > 0 ? d.demanda / fator : d.demanda;
      const disponivel = num(s?.disponivel);
      return {
        insumo_id: id,
        especificacao: d.especificacao,
        unidade: s?.unidade ?? null,
        demanda,
        disponivel,
        falta: Math.max(0, demanda - disponivel),
      };
    })
    .sort((a, b) => b.falta - a.falta || a.especificacao.localeCompare(b.especificacao));
}
