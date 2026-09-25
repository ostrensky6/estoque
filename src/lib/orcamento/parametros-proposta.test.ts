import { describe, expect, it } from "vitest";

import {
  padroesDeParametrosGlobais,
  resolverParametrosProposta,
} from "./parametros-proposta";

const padroes = padroesDeParametrosGlobais([
  { chave: "impostos", valor: 16.33 },
  { chave: "taxas", valor: 2 },
  { chave: "fundo_reserva", valor: 5 },
  { chave: "fundo_investimento", valor: "5" },
  { chave: "margem_lucro", valor: 20 },
  { chave: "dias_uteis_ano", valor: 222 },
]);

describe("parâmetros econômicos da proposta", () => {
  it("mapeia os parâmetros de custeio para o vocabulário da proposta", () => {
    expect(padroes).toEqual({ impostos_legacy: 16.33, incubacao: 2, reserva: 5, investimentos: 5, lucro: 20 });
  });

  it("com projeto, usa os percentuais do projeto (comportamento de sempre)", () => {
    const r = resolverParametrosProposta({
      projeto: { impostos: 10, incubacao: 1, reserva: 2, investimentos: 3, margem_lucro: 4 },
      proposta: { param_lucro: 50 },
      padroes,
    });
    expect(r.origem).toBe("projeto");
    expect(r.rates).toEqual({ impostos_legacy: 10, incubacao: 1, reserva: 2, investimentos: 3, lucro: 4 });
  });

  it("apenas análises: usa os percentuais gravados na proposta", () => {
    const r = resolverParametrosProposta({
      projeto: null,
      proposta: { param_impostos: 16.33, param_incubacao: 0, param_reserva: null, param_investimentos: null, param_lucro: 30 },
      padroes,
    });
    expect(r.origem).toBe("proposta");
    expect(r.rates).toEqual({ impostos_legacy: 16.33, incubacao: 0, reserva: 0, investimentos: 0, lucro: 30 });
  });

  it("apenas análises sem nada gravado: usa os padrões (nunca sai sem imposto por omissão)", () => {
    const r = resolverParametrosProposta({ projeto: null, proposta: {}, padroes });
    expect(r.origem).toBe("padrao");
    expect(r.rates).toEqual(padroes);
  });
});
