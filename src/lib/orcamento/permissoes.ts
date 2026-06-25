import type { Papel } from "@/lib/auth/roles";

export type OperacaoOrcamento =
  | "visualizar_proposta"
  | "criar_proposta"
  | "editar_dados_demanda"
  | "criar_modulo_laboratorial"
  | "criar_modulo_projeto"
  | "adicionar_item_laboratorial"
  | "remover_item_laboratorial"
  | "recalcular_custos_laboratoriais"
  | "adicionar_custo_projeto"
  | "remover_custo_projeto"
  | "alterar_parametros_economicos"
  | "marcar_modulo_revisao" // enviado, aprovado, revisado
  | "cancelar_modulo"
  | "emitir_proposta_final"
  | "cancelar_versao_final"
  | "duplicar_versao_final"
  | "exportar_proposta"
  | "executar_preflight"
  | "acessar_historico_auditoria"
  | "administrar_parametros_globais"
  | "administrar_governanca";

export const MATRIZ_PERMISSOES: Record<OperacaoOrcamento, Papel[]> = {
  visualizar_proposta: ["tecnico", "coordenador", "gestor", "admin"],
  criar_proposta: ["tecnico", "coordenador", "gestor", "admin"],
  editar_dados_demanda: ["tecnico", "coordenador", "gestor", "admin"],
  criar_modulo_laboratorial: ["tecnico", "coordenador", "gestor", "admin"],
  criar_modulo_projeto: ["tecnico", "coordenador", "gestor", "admin"],
  adicionar_item_laboratorial: ["tecnico", "coordenador", "gestor", "admin"],
  remover_item_laboratorial: ["tecnico", "coordenador", "gestor", "admin"],
  recalcular_custos_laboratoriais: ["coordenador", "gestor", "admin"],
  adicionar_custo_projeto: ["tecnico", "coordenador", "gestor", "admin"],
  remover_custo_projeto: ["tecnico", "coordenador", "gestor", "admin"],
  alterar_parametros_economicos: ["gestor", "admin"], // Margens globais e margens de projeto
  marcar_modulo_revisao: ["coordenador", "gestor", "admin"], // status -> enviado / aprovado
  cancelar_modulo: ["coordenador", "gestor", "admin"],
  emitir_proposta_final: ["coordenador", "gestor", "admin"],
  cancelar_versao_final: ["coordenador", "gestor", "admin"],
  duplicar_versao_final: ["coordenador", "gestor", "admin"],
  exportar_proposta: ["tecnico", "coordenador", "gestor", "admin"],
  executar_preflight: ["gestor", "admin"],
  acessar_historico_auditoria: ["gestor", "admin"],
  administrar_parametros_globais: ["gestor", "admin"],
  administrar_governanca: ["admin"],
};

/**
 * Valida se um determinado papel tem permissão para executar uma operação.
 */
export function verificarPermissao(papel: Papel, operacao: OperacaoOrcamento): boolean {
  const papeisAutorizados = MATRIZ_PERMISSOES[operacao];
  return papeisAutorizados.includes(papel);
}
