/** Arredondamento monetário único do app (centavos, com correção de ponto flutuante). */
export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
