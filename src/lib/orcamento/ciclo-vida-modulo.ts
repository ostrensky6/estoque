// Ciclo de vida dos módulos de orçamento (Fase 5).
//
// Decisão PURA: um documento revisado/enviado/aprovado/cancelado NÃO pode ser
// editado diretamente. A funcionalidade de "nova revisão" ainda não existe; por
// ora, a alteração é apenas BLOQUEADA (documentado para a próxima fase).
//
// Usada por validações DEFENSIVAS no servidor — não confiar só no botão da UI.

// Status de documento que travam a edição direta.
const STATUS_BLOQUEADO = new Set(["enviado", "aprovado", "cancelado"]);

export type EstadoModulo = {
  status?: string | null;
  /** Apenas laboratório possui status_operacional ('pendente'|'preenchido'|'revisado'|'cancelado'). */
  statusOperacional?: string | null;
};

export type ResultadoBloqueio = { bloqueado: boolean; motivo: string | null };

export function moduloBloqueadoParaEdicao(estado: EstadoModulo): ResultadoBloqueio {
  if (estado.status && STATUS_BLOQUEADO.has(estado.status)) {
    return {
      bloqueado: true,
      motivo: `Documento com status "${estado.status}" não pode ser editado diretamente. Crie uma nova revisão (funcionalidade da próxima fase).`,
    };
  }
  if (estado.statusOperacional === "revisado") {
    return {
      bloqueado: true,
      motivo: "Módulo revisado não pode ser editado diretamente. Crie uma nova revisão (funcionalidade da próxima fase).",
    };
  }
  return { bloqueado: false, motivo: null };
}
