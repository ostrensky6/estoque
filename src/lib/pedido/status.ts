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
    label: "Orçamentos",
    etapa: "Levantamento de cotações",
    className: "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300",
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
];

export function pedidoInternoStatus(status: string | null | undefined) {
  return PEDIDO_INTERNO_STATUS[(status ?? "rascunho") as PedidoInternoStatus] ?? PEDIDO_INTERNO_STATUS.rascunho;
}
