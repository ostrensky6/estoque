import { describe, expect, it } from "vitest";
import { calcularFundos, extrairFundosPrevistos } from "./fundos";

describe("fundos de orcamento", () => {
  it("extrai valores previstos do snapshot de parametros aplicados", () => {
    expect(extrairFundosPrevistos([
      { chave: "impostos_legacy", valorCalculado: 100 },
      { chave: "incubacao", valorCalculado: 20 },
      { chave: "reserva", valorCalculado: 50 },
      { chave: "investimentos", valorCalculado: 30 },
      { chave: "lucro", valorCalculado: 300 },
    ])).toEqual({
      impostos: 100,
      incubacao: 20,
      reserva: 50,
      investimentos: 30,
    });
  });

  it("lê o formato real gravado na emissão ({chave, label, percentual, valorNominal})", () => {
    // Mesmo formato de economia.parametros persistido em parametros_snapshot.
    expect(extrairFundosPrevistos([
      { chave: "impostos_legacy", label: "Impostos", percentual: 16, valorNominal: 160 },
      { chave: "incubacao", label: "Incubação", percentual: 2, valorNominal: 20 },
      { chave: "reserva", label: "Reserva", percentual: 5, valorNominal: 50 },
      { chave: "investimentos", label: "Investimentos", percentual: 3, valorNominal: 30 },
      { chave: "lucro", label: "Lucro", percentual: 10, valorNominal: 100 },
    ])).toEqual({ impostos: 160, incubacao: 20, reserva: 50, investimentos: 30 });
  });

  it("usa economia.parametros do snapshot final quando não há parâmetros aplicados", () => {
    expect(extrairFundosPrevistos(null, {
      consolidado: {
        economia: {
          parametros: [
            { chave: "impostos_legacy", label: "Impostos", percentual: 10, valorNominal: 100 },
            { chave: "reserva", label: "Reserva", percentual: 5, valorNominal: 50 },
          ],
        },
      },
    })).toEqual({ impostos: 100, incubacao: 0, reserva: 50, investimentos: 0 });
  });

  it("libera fundos proporcionalmente ao valor recebido", () => {
    const resultado = calcularFundos({
      totalFinal: 1000,
      previstos: { impostos: 160, incubacao: 20, reserva: 50, investimentos: 50 },
      lancamentos: {
        valorRecebido: 250,
        impostosPagos: 10,
        incubacaoPaga: 2,
        reservaGasta: 3,
        investimentoGasto: 4,
      },
    });

    expect(resultado.percentualRecebido).toBe(0.25);
    expect(resultado.liberado).toEqual({
      impostos: 40,
      incubacao: 5,
      reserva: 12.5,
      investimentos: 12.5,
    });
    expect(resultado.saldo).toEqual({
      impostos: 30,
      incubacao: 3,
      reserva: 9.5,
      investimentos: 8.5,
    });
  });

  it("limita recebimento acima do total em 100 por cento", () => {
    const resultado = calcularFundos({
      totalFinal: 1000,
      previstos: { impostos: 160, incubacao: 20, reserva: 50, investimentos: 50 },
      lancamentos: {
        valorRecebido: 1500,
        impostosPagos: 0,
        incubacaoPaga: 0,
        reservaGasta: 0,
        investimentoGasto: 0,
      },
    });

    expect(resultado.percentualRecebido).toBe(1);
    expect(resultado.liberado.reserva).toBe(50);
  });

  it("permite ajustar saldo final de fundos sem alterar baixas executadas", () => {
    const resultado = calcularFundos({
      totalFinal: 1000,
      previstos: { impostos: 0, incubacao: 0, reserva: 100, investimentos: 200 },
      lancamentos: {
        valorRecebido: 1000,
        impostosPagos: 0,
        incubacaoPaga: 0,
        reservaGasta: 25,
        investimentoGasto: 50,
        reservaSaldoAjustado: 10,
        investimentoSaldoAjustado: 0,
      },
    });

    expect(resultado.executado.reserva).toBe(25);
    expect(resultado.executado.investimentos).toBe(50);
    expect(resultado.saldo.reserva).toBe(10);
    expect(resultado.saldo.investimentos).toBe(0);
  });
});
