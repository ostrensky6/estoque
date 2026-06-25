import { describe, expect, it } from "vitest";
import { calcularPrevisaoOperacionalDemanda } from "./previsao-operacional";

describe("previsao operacional da demanda", () => {
  it("calcula lotes e consumo de reagentes por amostra e por execucao", () => {
    const previsao = calcularPrevisaoOperacionalDemanda({
      analises: [
        { codigo_analise: "A", quantidade_amostras: 10 },
        { codigo_analise: "B", quantidade_amostras: 25 },
      ],
      etapas: [
        {
          codigo_analise: "A",
          nome_etapa: "Preparo",
          nome_atividade: "PCR",
          execucoes_por_dia: 2,
          amostras_por_execucao: 8,
        },
        {
          codigo_analise: "B",
          nome_etapa: "Extração",
          nome_atividade: "Placa",
          execucoes_por_dia: 1,
          amostras_por_execucao: 12,
        },
      ],
      insumos: [
        {
          codigo_analise: "A",
          especificacao_insumo: "Primer",
          unidade: "uL",
          quantidade_por_amostra: 2,
          modo_cobranca: "por_amostra",
        },
        {
          codigo_analise: "A",
          especificacao_insumo: "Kit corrida",
          unidade: "kit",
          quantidade_por_amostra: 1,
          modo_cobranca: "por_execucao",
        },
        {
          codigo_analise: "B",
          especificacao_insumo: "Tampão",
          unidade: "mL",
          quantidade_por_amostra: 0.5,
          modo_cobranca: "por_amostra",
        },
      ],
    });

    expect(previsao).toHaveLength(2);
    expect(previsao[0]).toMatchObject({
      codigo_analise: "A",
      quantidade_amostras: 10,
      lote_padrao: 8,
      lotes: 2,
      capacidade_dia: 16,
      prazo_dias: 1,
    });
    expect(previsao[0].reagentes).toEqual([
      { especificacao: "Primer", unidade: "uL", modo_cobranca: "por_amostra", consumo_total: 20 },
      { especificacao: "Kit corrida", unidade: "kit", modo_cobranca: "por_execucao", consumo_total: 2 },
    ]);
    expect(previsao[1]).toMatchObject({
      codigo_analise: "B",
      quantidade_amostras: 25,
      lote_padrao: 12,
      lotes: 3,
      capacidade_dia: 12,
      prazo_dias: 3,
    });
    expect(previsao[1].reagentes[0]).toMatchObject({ consumo_total: 12.5 });
  });
});
