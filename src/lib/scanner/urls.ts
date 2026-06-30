import type { EntidadeTipo } from "./identificadores";

export type EntidadeUrlCurta =
  | "lote"
  | "equipamento"
  | "equipamento_unidade";

export function gerarUrlCurtaKontrol(
  tipo: EntidadeUrlCurta,
  id: number,
): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("ID da entidade deve ser um inteiro positivo.");
  }

  return `/s/${tipo}/${id}`;
}

export function isTipoUrlCurtaKontrol(
  tipo: EntidadeTipo,
): tipo is EntidadeUrlCurta {
  return tipo === "lote" || tipo === "equipamento" || tipo === "equipamento_unidade";
}
