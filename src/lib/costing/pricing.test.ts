import { describe, expect, it } from "vitest";
import {
  aplicarParametrosEconomicos,
  type ParametroEconomicoAplicavel,
} from "./pricing";

const parametrosBase: ParametroEconomicoAplicavel[] = [
  {
    chave: "impostos",
    label: "Impostos",
    base: "TODOS_COMPONENTES",
    percentual: 10,
  },
  {
    chave: "margem",
    label: "Margem",
    base: "TODOS_COMPONENTES",
    percentual: 20,
  },
];

describe("aplicarParametrosEconomicos", () => {
  it("calcula markup sobre laboratorio e projeto quando ambos entram como custo", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      projeto: { custo: 500 },
      parametros: parametrosBase,
    });

    expect(result.subtotalCustos).toBe(1500);
    expect(result.totalParametros).toBe(450);
    expect(result.totalFinal).toBe(1950);
  });

  it("calcula gross-up separando custo tecnico de laboratorio e projeto", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "GROSS_UP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      projeto: { custo: 500 },
      parametros: parametrosBase,
    });

    expect(result.laboratorio.total).toBe(1428.57);
    expect(result.projeto.total).toBe(714.29);
    expect(result.totalFinal).toBe(2142.86);
  });

  it("bloqueia gross-up quando a soma percentual aplicavel chega a 100%", () => {
    expect(() =>
      aplicarParametrosEconomicos({
        metodo: "GROSS_UP",
        laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
        parametros: [
          { chave: "impostos", label: "Impostos", base: "TODOS_COMPONENTES", percentual: 60 },
          { chave: "margem", label: "Margem", base: "TODOS_COMPONENTES", percentual: 40 },
        ],
      }),
    ).toThrow("gross-up deve ser menor que 100%");
  });

  it("aplica parametro apenas sobre laboratorio quando a base e APENAS_LABORATORIO", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      projeto: { custo: 500 },
      parametros: [
        { chave: "fundo", label: "Fundo", base: "APENAS_LABORATORIO", percentual: 10 },
      ],
    });

    expect(result.parametros[0]?.baseLaboratorio).toBe(1000);
    expect(result.parametros[0]?.baseProjeto).toBe(0);
    expect(result.totalFinal).toBe(1600);
  });

  it("aplica parametro apenas sobre projeto quando a base e APENAS_PROJETO", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      projeto: { custo: 500 },
      parametros: [
        { chave: "gestao", label: "Gestao", base: "APENAS_PROJETO", percentual: 10 },
      ],
    });

    expect(result.parametros[0]?.baseLaboratorio).toBe(0);
    expect(result.parametros[0]?.baseProjeto).toBe(500);
    expect(result.totalFinal).toBe(1550);
  });

  it("soma valor fixo ao total sem criar base percentual", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      parametros: [
        { chave: "taxa_fixa", label: "Taxa fixa", base: "VALOR_FIXO", valor: 125 },
      ],
    });

    expect(result.parametros[0]?.baseLaboratorio).toBe(0);
    expect(result.parametros[0]?.valorCalculado).toBe(125);
    expect(result.totalFinal).toBe(1125);
  });

  it("preserva parametro nao aplicavel no snapshot sem alterar total", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      parametros: [
        { chave: "observado", label: "Observado", base: "NAO_APLICAVEL", percentual: 99 },
      ],
    });

    expect(result.parametros[0]?.aplicado).toBe(false);
    expect(result.totalFinal).toBe(1000);
  });

  it("nao reaplica parametros sobre laboratorio ja precificado por padrao", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1300, modo: "PRECO_JA_FORMADO" },
      projeto: { custo: 500 },
      parametros: parametrosBase,
    });

    expect(result.laboratorio.baseIncidencia).toBe(0);
    expect(result.parametros[0]?.baseLaboratorio).toBe(0);
    expect(result.parametros[0]?.baseProjeto).toBe(500);
    expect(result.totalFinal).toBe(1950);
    expect(result.alertas.length).toBeGreaterThan(0);
  });

  it("permite incidencia deliberada sobre laboratorio ja precificado quando explicitado", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1300, modo: "PRECO_JA_FORMADO" },
      parametros: [
        {
          chave: "ajuste",
          label: "Ajuste deliberado",
          base: "APENAS_LABORATORIO",
          percentual: 10,
          incluirLaboratorioPrecificado: true,
        },
      ],
    });

    expect(result.parametros[0]?.baseLaboratorio).toBe(1300);
    expect(result.totalFinal).toBe(1430);
    expect(result.alertas).toEqual([]);
  });

  it("gera snapshot completo dos parametros aplicados", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "MARKUP",
      laboratorio: { valor: 1000, modo: "CUSTO_TECNICO" },
      projeto: { custo: 500 },
      parametros: parametrosBase,
    });

    expect(result.snapshot.metodo).toBe("MARKUP");
    expect(result.snapshot.totalFinal).toBe(1950);
    expect(result.snapshot.parametros).toHaveLength(2);
  });

  it("mantem laboratorio ja precificado fora do gross-up e aplica gross-up apenas ao projeto", () => {
    const result = aplicarParametrosEconomicos({
      metodo: "GROSS_UP",
      laboratorio: { valor: 1300, modo: "PRECO_JA_FORMADO" },
      projeto: { custo: 500 },
      parametros: parametrosBase,
    });

    expect(result.laboratorio.total).toBe(1300);
    expect(result.projeto.total).toBe(714.29);
    expect(result.totalFinal).toBe(2014.29);
  });
});
