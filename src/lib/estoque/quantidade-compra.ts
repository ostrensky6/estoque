import { formatNumber } from "@/lib/formatters";

/**
 * Quantidade de um item de compra ou pedido interno (migration 0123): em
 * frascos ("embalagem"), com o volume de cada frasco, ou na unidade física do
 * cadastro ("unidade", itens anteriores à compra em frascos).
 */
export type ItemQuantidade = {
  quantidade: number | string | null;
  quantidade_em?: string | null;
  conteudo_embalagem?: number | string | null;
};

export function emFrascos(item: Pick<ItemQuantidade, "quantidade_em">) {
  return item.quantidade_em === "embalagem";
}

export function rotuloFrascos(quantidade: number) {
  return quantidade === 1 ? "frasco" : "frascos";
}

/** "3 frascos de 100 mL" · "300 mL" · "3". */
export function rotuloQuantidadeItem(
  item: ItemQuantidade,
  unidade: string | null | undefined,
  quantidade: number | string | null = item.quantidade,
) {
  const qtd = Number(quantidade ?? 0);
  const unidadeFisica = (unidade ?? "").trim();
  if (emFrascos(item)) {
    const conteudo = Number(item.conteudo_embalagem ?? 0);
    const volume = conteudo > 0 ? ` de ${formatNumber(conteudo)}${unidadeFisica ? ` ${unidadeFisica}` : ""}` : "";
    return `${formatNumber(qtd)} ${rotuloFrascos(qtd)}${volume}`;
  }
  return `${formatNumber(qtd)}${unidadeFisica ? ` ${unidadeFisica}` : ""}`;
}
