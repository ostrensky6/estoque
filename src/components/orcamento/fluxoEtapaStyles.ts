import type { EstadoEtapa } from "@/lib/orcamento/etapas-proposta";

export function classeEtapaFluxo(estado: EstadoEtapa, isAtual: boolean) {
  if (isAtual) {
    return "border-2 border-brand-500 bg-brand-100 text-brand-950 shadow-md ring-1 ring-brand-200 dark:border-brand-300 dark:bg-brand-900/70 dark:text-brand-50 dark:ring-brand-800";
  }
  if (estado === "concluido" || estado === "ativo") {
    return "border border-brand-200 bg-brand-50/70 text-brand-800 dark:border-brand-800 dark:bg-brand-950/25 dark:text-brand-200";
  }
  if (estado === "bloqueado") {
    return "border border-warning-strong/30 bg-warning-soft text-warning-strong";
  }
  if (estado === "pulado") {
    return "border border-border bg-muted/50 text-muted-foreground/80";
  }
  return "border border-border bg-card text-muted-foreground";
}
