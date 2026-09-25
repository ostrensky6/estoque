import type { EntidadeTipo } from "./identificadores";

export type EntidadeUrlCurta =
  | "lote"
  | "equipamento"
  | "equipamento_unidade";

/**
 * Gera o endereço curto `/s/{tipo}/{id}`. Com `origem` (ex.: "https://kontrol.lab"),
 * devolve o endereço completo — é o que a etiqueta QR deve conter, para que a câmera
 * do celular abra o Kontrol em vez de mostrar só texto.
 */
export function gerarUrlCurtaKontrol(
  tipo: EntidadeUrlCurta,
  id: number,
  origem?: string | null,
): string {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("ID da entidade deve ser um inteiro positivo.");
  }

  const caminho = `/s/${tipo}/${id}`;
  const base = normalizarOrigem(origem);
  return base ? `${base}${caminho}` : caminho;
}

/** Aceita "https://host[:porta]" (com ou sem barra/caminho final); devolve só a origem. */
export function normalizarOrigem(origem?: string | null): string | null {
  const bruto = origem?.trim();
  if (!bruto) return null;
  try {
    const url = new URL(bruto);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function isTipoUrlCurtaKontrol(
  tipo: EntidadeTipo,
): tipo is EntidadeUrlCurta {
  return tipo === "lote" || tipo === "equipamento" || tipo === "equipamento_unidade";
}
