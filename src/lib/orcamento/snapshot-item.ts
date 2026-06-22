import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import type { BreakdownComIntegridade } from "@/lib/costing/loader";
import type { OverrideRegistro } from "@/lib/cadastros/guard-custeio";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type AlvoSnapshot =
  | { orcamento_item_id: number }
  | { orcamento_projeto_analise_id: number };

/**
 * Grava a composição integral do custo técnico de um item de orçamento no
 * momento do cálculo (tabela `orcamento_item_snapshot`, migração 0043). É a
 * fonte de leitura de orçamentos históricos — preserva reagentes, equipamentos,
 * pessoal, overhead, lote, alertas e o eventual override de integridade.
 *
 * Tolerante a ambientes sem a migração 0043 aplicada: se a tabela não existir,
 * registra um aviso e segue (não derruba a inclusão do item).
 */
export async function gravarSnapshotItem(
  supabase: SupabaseClient,
  alvo: AlvoSnapshot,
  codigo: string,
  breakdown: BreakdownComIntegridade | undefined,
  override: OverrideRegistro | null,
): Promise<void> {
  const alertas = (breakdown?.integridade?.problemas ?? []).filter(
    (p) => p.gravidade === "alerta",
  );
  const { error } = await supabase.from("orcamento_item_snapshot").insert({
    ...alvo,
    codigo_analise: codigo,
    lote: breakdown?.lote ?? null,
    reagentes: breakdown?.reagentes ?? 0,
    equipamentos: breakdown?.equipamento ?? 0,
    pessoal: breakdown?.pessoal ?? 0,
    overhead: breakdown?.overhead ?? 0,
    custo_tecnico_unitario: breakdown?.custoTotal ?? 0,
    escolhas_grupo: {} as Json,
    alertas: alertas as unknown as Json,
    cadastros_versao: { calculado_em: new Date().toISOString() } as Json,
    override_aplicado: !!override,
    override_justificativa: override?.justificativa ?? null,
    override_usuario: override?.usuario_id ?? null,
    override_problemas: (override?.problemas ?? []) as unknown as Json,
    calculado_em: new Date().toISOString(),
  });
  if (error) {
    // Não bloqueia o fluxo se a migração 0043 ainda não foi aplicada.
    console.warn(`[snapshot-item] não foi possível gravar snapshot de ${codigo}: ${error.message}`);
  }
}
