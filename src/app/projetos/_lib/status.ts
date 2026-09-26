/** Rótulo e cor do status do projeto (lista e visão 360°). */
export const STATUS_PROJETO: Record<string, { label: string; cls: string }> = {
  proposto: { label: "Proposto", cls: "bg-warning-soft text-warning-strong" },
  ativo: { label: "Ativo", cls: "bg-brand-100 text-brand-800 dark:bg-brand-950/50 dark:text-brand-300" },
  concluido: { label: "Concluído", cls: "bg-info-soft text-info-strong" },
  cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
};
