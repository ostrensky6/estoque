// Rótulos de status do orçamento e status efetivo das versões finais (propostas).

export const ROTULO_STATUS_VERSAO_FINAL: Record<string, string> = {
  emitido: "Emitida",
  enviado: "Enviada",
  alterado_reenviado: "Alterada e reenviada",
  aprovado: "Aprovada",
  rejeitado: "Rejeitada",
  recusado: "Recusada",
  substituido: "Substituída",
  cancelado: "Cancelada",
  vencido: "Vencida",
  convertido_projeto: "Convertida em projeto",
};

export function rotuloStatusVersaoFinal(status?: string | null) {
  if (!status) return "—";
  return ROTULO_STATUS_VERSAO_FINAL[status] ?? status;
}

/** Data de hoje (AAAA-MM-DD) no fuso do laboratório. */
export function hojeCalendario(agora: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/**
 * Status para exibição: uma versão ainda "emitida" com validade passada é
 * mostrada como vencida, sem depender de escrita no banco.
 */
export function statusEfetivoVersaoFinal(
  versao: { status: string; valido_ate?: string | null },
  hoje: string = hojeCalendario(),
) {
  if (versao.status === "emitido" && versao.valido_ate && versao.valido_ate.slice(0, 10) < hoje) {
    return "vencido";
  }
  return versao.status;
}

// Módulos de custo (laboratório/projeto).
const ROTULO_STATUS_MODULO: Record<string, string> = {
  rascunho: "Rascunho",
  pendente: "Pendente",
  preenchido: "Preenchido",
  revisado: "Revisado",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
};

export function rotuloStatusModulo(status?: string | null) {
  if (!status) return "—";
  return ROTULO_STATUS_MODULO[status] ?? status;
}

// Processo de orçamento (registro em demandas_propostas).
const ROTULO_STATUS_ORCAMENTO: Record<string, string> = {
  nova: "Nova",
  em_analise: "Em análise",
  orcada: "Orçada",
  enviada: "Enviada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export function rotuloStatusOrcamento(status?: string | null) {
  if (!status) return "—";
  return ROTULO_STATUS_ORCAMENTO[status] ?? status;
}
