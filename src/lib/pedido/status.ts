export const PEDIDO_INTERNO_STATUS = {
  rascunho: {
    label: "Rascunho",
    etapa: "Lista de materiais",
    className: "bg-muted text-muted-foreground",
  },
  em_validacao: {
    label: "Em validação",
    etapa: "Validação do coordenador",
    className: "bg-warning-soft text-warning-strong",
  },
  ajuste_solicitante: {
    label: "Ajuste solicitante",
    etapa: "Verificação com solicitante",
    className: "bg-warning-soft text-warning-strong",
  },
  validado: {
    label: "Validado",
    etapa: "Informações confirmadas",
    className: "bg-info-soft text-info-strong",
  },
  formalizado: {
    label: "Formalizado",
    etapa: "Pedido formal em compras",
    className: "bg-info-soft text-info-strong",
  },
  analise_administrativa: {
    label: "Análise adm.",
    etapa: "Fonte, rubrica e conformidade",
    className: "bg-warning-soft text-warning-strong",
  },
  ajuste_compras: {
    label: "Ajuste compras",
    etapa: "Verificação com compras/solicitante",
    className: "bg-warning-soft text-warning-strong",
  },
  aprovado_compra: {
    label: "Aprovado para orçamento",
    etapa: "Aprovação administrativa",
    className: "bg-success-soft text-success-strong",
  },
  orcamentos: {
    label: "Em cotação",
    etapa: "Levantamento de cotações",
    className: "bg-info-soft text-info-strong",
  },
  orcamentos_recebidos: {
    label: "Orçamentos recebidos",
    etapa: "Propostas anexadas",
    className: "bg-info-soft text-info-strong",
  },
  aguardando_aprovacao_final: {
    label: "Aguardando aprovação final",
    etapa: "Escolha do caminho de compra",
    className: "bg-warning-soft text-warning-strong",
  },
  aprovado_para_compra: {
    label: "Aprovado para compra",
    etapa: "Fornecedor ou instituição definido",
    className: "bg-success-soft text-success-strong",
  },
  compra_fechada: {
    label: "Compra fechada",
    etapa: "Fornecedor e documentos",
    className: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
  },
  encaminhado_instituicao: {
    label: "Encaminhado",
    etapa: "Instituição compradora",
    className: "bg-info-soft text-info-strong",
  },
  aguardando_pagamento_nf: {
    label: "Aguardando pagamento/NF",
    etapa: "Boleto, nota ou comprovante",
    className: "bg-warning-soft text-warning-strong",
  },
  compra_concluida: {
    label: "Compra concluída",
    etapa: "Documentos finais registrados",
    className: "bg-success-soft text-success-strong",
  },
  cancelado: {
    label: "Cancelado",
    etapa: "Processo encerrado",
    className: "bg-muted text-muted-foreground/80",
  },
} as const;

export type PedidoInternoStatus = keyof typeof PEDIDO_INTERNO_STATUS;

/**
 * Etapa 11 — "Compra recebida". É uma marca paralela (coluna `recebido_em`),
 * não um status do fluxo: pode ser registrada a qualquer momento após a
 * aprovação da compra, sem interferir no andamento de pagamento/NF.
 */
export const PEDIDO_INTERNO_ETAPA_RECEBIDA = {
  label: "Compra recebida",
  etapa: "Produto ou serviço entregue",
} as const;

/**
 * Status em que a compra já foi aprovada e o pedido aguarda a chegada do
 * produto/serviço — base da subaba de síntese e do gatilho da etapa 11.
 */
export const PEDIDO_INTERNO_AGUARDANDO_CHEGADA: PedidoInternoStatus[] = [
  "aprovado_para_compra",
  "compra_fechada",
  "encaminhado_instituicao",
  "aguardando_pagamento_nf",
  "compra_concluida",
];

/** Pode-se marcar/desmarcar "Compra recebida" a partir da aprovação da compra. */
export function podeMarcarRecebida(status: string) {
  return PEDIDO_INTERNO_AGUARDANDO_CHEGADA.includes(status as PedidoInternoStatus);
}

export const PEDIDO_INTERNO_FLUXO: PedidoInternoStatus[] = [
  "rascunho",
  "em_validacao",
  "validado",
  "formalizado",
  "analise_administrativa",
  "aprovado_compra",
  "orcamentos",
  "orcamentos_recebidos",
  "aguardando_aprovacao_final",
  "aprovado_para_compra",
];

export function pedidoInternoStatus(status: string | null | undefined) {
  return PEDIDO_INTERNO_STATUS[(status ?? "rascunho") as PedidoInternoStatus] ?? PEDIDO_INTERNO_STATUS.rascunho;
}

/** Número sequencial e único do pedido (derivado do id) — ex.: "Nº 0007". */
export function pedidoInternoNumero(id: number) {
  return `Nº ${String(id).padStart(4, "0")}`;
}
