/**
 * Convenção visual global do Kontrol (plano de redesenho §8.2):
 *
 *   Azul  = dado inserido, escolhido ou editável pelo usuário.
 *   Preto/neutro = dado calculado, derivado, fixo, bloqueado ou snapshotado.
 *
 * Este módulo é a ÚNICA fonte de verdade dessa convenção. Componentes de UI
 * (ValorEntrada / ValorCalculado) consomem `classesValor` para garantir que a
 * regra seja idêntica em todo o aplicativo (orçamentos, custeio, estoque,
 * compras, planejamento, cadastros, governança).
 *
 * Função pura — testável sem DOM.
 */

export type TipoValor = "entrada" | "calculado";

/** Sub-estado de um valor calculado; não muda a cor (sempre neutro), só ênfase. */
export type EstadoCalculado = "derivado" | "bloqueado" | "snapshot";

/** Token de azul institucional (GIA). Centralizado para auditoria da convenção. */
export const TOM_ENTRADA = "text-brand-700 dark:text-brand-300";

/** Token neutro para valores calculados/derivados/snapshot. */
export const TOM_CALCULADO = "text-foreground";

export function classesValor(tipo: TipoValor, estado?: EstadoCalculado): string {
  if (tipo === "entrada") {
    return `${TOM_ENTRADA} font-medium`;
  }
  // calculado: sempre neutro (nunca azul), variando apenas a ênfase tipográfica
  const enfase =
    estado === "bloqueado"
      ? "font-semibold tabular-nums"
      : estado === "snapshot"
        ? "font-medium tabular-nums opacity-90"
        : "font-medium tabular-nums";
  return `${TOM_CALCULADO} ${enfase}`;
}
