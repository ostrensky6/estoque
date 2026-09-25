/**
 * Máscara de valores sigilosos (salário dos técnicos, valores de pessoal PE).
 * Sem imports de servidor: usado também pelos Client Components.
 *
 * "XXX" indica que o valor EXISTE, mas o usuário não tem a permissão
 * "Ver salário dos técnicos". O valor real nunca chega ao navegador.
 */
export const VALOR_MASCARADO = "XXX";

export const NOTA_VALOR_MASCARADO = "Visível só para quem tem permissão";

export function estaMascarado(value: unknown): boolean {
  return typeof value === "string" && value.trim().toUpperCase() === VALOR_MASCARADO;
}
