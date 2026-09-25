/**
 * Campos aceitos por public.criar_insumo_com_quantidade. A lista é fechada no
 * banco: qualquer chave fora dela gera "Campo não reconhecido no cadastro do
 * insumo". O custo_unitario é calculado pela própria RPC e por isso nunca é
 * enviado; codigo_lote nomeia o lote inicial quando há quantidade (0111).
 */
export const CAMPOS_RPC_CRIAR_INSUMO = new Set([
  "categoria_compra", "codigo_fabricante", "codigo_interno", "condicao_armazenamento",
  "custo_total_embalagem", "data_aquisicao", "data_fabricacao", "data_validade",
  "especificacao", "estoque_seguranca", "fabricante", "fator_conversao",
  "fornecedor_alt_id", "fornecedor_id", "lead_time_dias", "nome_item", "ponto_reposicao",
  "prazo_entrega_max_dias", "quantidade_embalagem", "quantidade_minima_compra", "sds_url",
  "tipo_insumo_id", "unidade", "unidade_consumo", "validade_apos_abertura_dias",
  "validade_dias", "codigo_lote",
]);

export function dadosCriacaoInsumo(payload: Record<string, unknown>, formData: FormData) {
  const dados: Record<string, unknown> = {};
  for (const [chave, valor] of Object.entries(payload)) {
    if (CAMPOS_RPC_CRIAR_INSUMO.has(chave)) dados[chave] = valor;
  }
  const codigoLote = String(formData.get("codigo_lote") ?? "").trim();
  if (codigoLote) dados.codigo_lote = codigoLote.slice(0, 80);
  return dados;
}
