import type { EstadoEtapaDemanda } from "@/lib/orcamento/fluxo-demanda";

export function classeEtapaFluxo(estado: EstadoEtapaDemanda, isAtual: boolean) {
  if (isAtual) {
    return "border-2 border-brand-500 bg-brand-100 text-brand-950 shadow-md ring-1 ring-brand-200 dark:border-brand-300 dark:bg-brand-900/70 dark:text-brand-50 dark:ring-brand-800";
  }
  if (estado === "concluido" || estado === "ativo") {
    return "border border-brand-200 bg-brand-50/70 text-brand-800 dark:border-brand-800 dark:bg-brand-950/25 dark:text-brand-200";
  }
  if (estado === "bloqueado") {
    return "border border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100";
  }
  if (estado === "pulado") {
    return "border border-zinc-200 bg-zinc-50 text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-500";
  }
  return "border border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
}
