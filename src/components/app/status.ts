import type { Tone } from "@/components/app/StatCard";

export type StatusInfo = { label: string; tone: Tone };

/** Dicionário único status→cor: o mesmo status tem sempre a mesma cor no app inteiro. */
const STATUS: Record<string, StatusInfo> = {
  // Elaboração / neutros
  rascunho: { label: "Rascunho", tone: "neutral" },
  em_elaboracao: { label: "Em elaboração", tone: "neutral" },
  em_composicao: { label: "Em composição", tone: "neutral" },
  em_preparacao: { label: "Em preparação", tone: "neutral" },
  nova: { label: "Nova", tone: "neutral" },
  arquivado: { label: "Arquivado", tone: "neutral" },
  arquivada: { label: "Arquivada", tone: "neutral" },
  consumido: { label: "Consumido", tone: "neutral" },
  inativo: { label: "Inativo", tone: "neutral" },
  inativa: { label: "Inativa", tone: "neutral" },
  nao_exigido: { label: "Não exigido", tone: "neutral" },
  nao_aplicavel: { label: "Não aplicável", tone: "neutral" },

  // Andamento / informativos
  iniciado: { label: "Iniciado", tone: "info" },
  em_execucao: { label: "Em execução", tone: "info" },
  em_uso: { label: "Em uso", tone: "info" },
  em_analise_cliente: { label: "Em análise do cliente", tone: "info" },
  enviado: { label: "Enviado", tone: "info" },
  emitido: { label: "Emitido", tone: "info" },
  formalizado: { label: "Formalizado", tone: "info" },
  orcada: { label: "Orçada", tone: "info" },
  orcamentos_recebidos: { label: "Orçamentos recebidos", tone: "info" },
  reservado: { label: "Reservado", tone: "info" },

  // Atenção / pendências
  pendente: { label: "Pendente", tone: "warning" },
  solicitado: { label: "Solicitado", tone: "warning" },
  parcial: { label: "Parcial", tone: "warning" },
  em_analise: { label: "Em análise", tone: "warning" },
  analise_administrativa: { label: "Análise administrativa", tone: "warning" },
  em_validacao: { label: "Em validação", tone: "warning" },
  em_revisao: { label: "Em revisão", tone: "warning" },
  revisao: { label: "Revisão", tone: "warning" },
  aguardando_aprovacao_final: { label: "Aguardando aprovação final", tone: "warning" },
  aguardando_pagamento_nf: { label: "Aguardando pagamento NF", tone: "warning" },
  ajuste_compras: { label: "Ajuste de compras", tone: "warning" },
  ajuste_solicitante: { label: "Ajuste do solicitante", tone: "warning" },
  quarentena: { label: "Quarentena", tone: "warning" },
  reposicao: { label: "Reposição", tone: "warning" },
  repor: { label: "Repor", tone: "warning" },
  sem_validade: { label: "Sem validade", tone: "warning" },
  nao_lida: { label: "Não lida", tone: "warning" },

  // Sucesso / concluídos
  aprovado: { label: "Aprovado", tone: "success" },
  aprovada: { label: "Aprovada", tone: "success" },
  aprovado_compra: { label: "Aprovado p/ compra", tone: "success" },
  aprovado_para_compra: { label: "Aprovado p/ compra", tone: "success" },
  aceito: { label: "Aceito", tone: "success" },
  validado: { label: "Validado", tone: "success" },
  revisado: { label: "Revisado", tone: "success" },
  liberado: { label: "Liberado", tone: "success" },
  concluido: { label: "Concluído", tone: "success" },
  compra_concluida: { label: "Compra concluída", tone: "success" },
  recebido: { label: "Recebido", tone: "success" },
  preenchido: { label: "Preenchido", tone: "success" },
  ativo: { label: "Ativo", tone: "success" },
  ativa: { label: "Ativa", tone: "success" },

  // Problemas / negativos
  perdido: { label: "Perdido", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "danger" },
  cancelada: { label: "Cancelada", tone: "danger" },
  recusado: { label: "Recusado", tone: "danger" },
  recusada: { label: "Recusada", tone: "danger" },
  rejeitado: { label: "Rejeitado", tone: "danger" },
  vencido: { label: "Vencido", tone: "danger" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  descartado: { label: "Descartado", tone: "danger" },
  sem_estoque: { label: "Sem estoque", tone: "danger" },
};

export function statusInfo(status: string): StatusInfo {
  return STATUS[status] ?? { label: status, tone: "neutral" };
}
