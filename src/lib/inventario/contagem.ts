export type DivergenciaInventario = {
  quantidadeSistema: number;
  quantidadeContada: number;
  divergencia: number;
  temDivergencia: boolean;
};

export function calcularDivergenciaInventario(
  quantidadeSistema: number,
  quantidadeContada: number,
): DivergenciaInventario {
  const sistema = Number.isFinite(quantidadeSistema) ? quantidadeSistema : 0;
  const contada = Number.isFinite(quantidadeContada) ? quantidadeContada : 0;
  const divergencia = contada - sistema;

  return {
    quantidadeSistema: sistema,
    quantidadeContada: contada,
    divergencia,
    temDivergencia: Math.abs(divergencia) > 0.000001,
  };
}

export function exigeJustificativaInventario(
  quantidadeSistema: number,
  quantidadeContada: number,
) {
  return calcularDivergenciaInventario(quantidadeSistema, quantidadeContada).temDivergencia;
}
