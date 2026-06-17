export const PEDIDO_INTERNO_STATUS = {
  rascunho: {
    label: "Rascunho",
    etapa: "Lista de materiais",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  },
  em_validacao: {
    label: "Em validação",
    etapa: "Validação do coordenador",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  ajuste_solicitante: {
    label: "Ajuste solicitante",
    etapa: "Verificação com solicitante",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300",
  },
  validado: {
    label: "Validado",
    etapa: "Informações confirmadas",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  },
  formalizado: {
    label: "Formalizado",
    etapa: "Pedido formal em compras",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300",
  },
  analise_administrativa: {
    label: "Análise adm.",
    etapa: "Fonte, rubrica e conformidade",
    className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-300",
  },
  ajuste_compras: {
    label: "Ajuste compras",
    etapa: "Verificação com compras/solicitante",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  },
  aprovado_compra: {
    label: "Aprovado para orçamento",
    etapa: "Aprovação administrativa",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  orcamentos: {
    label: "Em cotação",
    etapa: "Levantamento de cotações",
    className: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
  },
  orcamentos_recebidos: {
    label: "Orçamentos recebidos",
    etapa: "Propostas anexadas",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  },
  aguardando_aprovacao_final: {
    label: "Aguardando aprovação final",
    etapa: "Escolha do caminho de compra",
    className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300",
  },
  aprovado_para_compra: {
    label: "Aprovado para compra",
    etapa: "Fornecedor ou instituição definido",
    className: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  },
  compra_fechada: {
    label: "Compra fechada",
    etapa: "Fornecedor e documentos",
    className: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300",
  },
  encaminhado_instituicao: {
    label: "Encaminhado",
    etapa: "Instituição compradora",
    className: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300",
  },
  aguardando_pagamento_nf: {
    label: "Aguardando pagamento/NF",
    etapa: "Boleto, nota ou comprovante",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  },
  compra_concluida: {
    label: "Compra concluída",
    etapa: "Documentos finais registrados",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  cancelado: {
    label: "Cancelado",
    etapa: "Processo encerrado",
    className: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  },
} as const;

export type PedidoInternoStatus = keyof typeof PEDIDO_INTERNO_STATUS;

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
