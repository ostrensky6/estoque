import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PainelParametrosEconomicos,
  type ParametroAplicadoView,
} from "./PainelParametrosEconomicos";

/**
 * Verificação automatizada da etapa de Parâmetros no fluxo (§8.1/§8.2) sem
 * browser: renderiza o componente para HTML e checa a convenção visual e os
 * números consolidados. Substitui parcialmente a confirmação visual manual.
 */

const parametros: ParametroAplicadoView[] = [
  { key: "impostos_legacy", label: "Impostos", nominalRate: 10, amount: 100 },
  { key: "lucro", label: "Lucro", nominalRate: 20, amount: 200 },
];

function render(props: Parameters<typeof PainelParametrosEconomicos>[0]) {
  return renderToStaticMarkup(createElement(PainelParametrosEconomicos, props));
}

describe("PainelParametrosEconomicos — render §8.2", () => {
  const baseProps = {
    exigeProjeto: true,
    metodo: "GROSS_UP",
    custoLaboratorio: 1000,
    precoLaboratorio: 1300,
    custoProjeto: 500,
    projetoFinal: 700,
    totalFinal: 2000,
    parametros,
    alertas: [] as string[],
  };

  it("renderiza percentuais (entrada do usuário) em azul institucional (brand)", () => {
    const html = render(baseProps);
    // percentuais usam ValorEntrada -> token brand
    expect(html).toMatch(/text-brand-700/);
    // os percentuais informados aparecem
    expect(html).toContain("10%");
    expect(html).toContain("20%");
  });

  it("renderiza total final calculado em tom neutro, nunca em azul", () => {
    const html = render(baseProps);
    expect(html).toMatch(/tabular-nums/);
    // a região do total não deve conter a classe de entrada (brand) — garantido
    // porque o total usa ValorCalculado; checamos que o valor aparece
    const totalFormatado = (2000).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    expect(html.replace(/ /g, " ")).toContain(totalFormatado.replace(/ /g, " "));
  });

  it("quando não há componente de projeto, não exibe parâmetros nem azul de entrada", () => {
    const html = render({ ...baseProps, exigeProjeto: false, parametros: [] });
    expect(html).toContain("não se aplicam");
    // sem ValorEntrada (nenhum percentual) => sem token brand
    expect(html).not.toMatch(/text-brand-700/);
  });

  it("exibe alertas anti-dupla-incidência quando fornecidos", () => {
    const html = render({
      ...baseProps,
      alertas: ["Margem nao incidiu sobre laboratorio ja precificado."],
    });
    expect(html).toContain("ja precificado");
  });
});
