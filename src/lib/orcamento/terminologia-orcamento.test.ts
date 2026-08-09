import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const historico = readFileSync(new URL("../../app/orcamento/historico/page.tsx", import.meta.url), "utf8");
const exporters = readFileSync(new URL("../project-budget/exporters.ts", import.meta.url), "utf8");
const parametrosDemanda = readFileSync(
  new URL("../../components/orcamento/ParametrosDemandaGrossUp.tsx", import.meta.url),
  "utf8",
);

describe("terminologia economica do orcamento", () => {
  it("usa Sigma parametros somente nos quatro rotulos mapeados", () => {
    expect([
      historico.includes("`\u03a3 parâmetros ${markup.toLocaleString"),
      historico.includes('<Delta titulo="\u03a3 parâmetros"'),
      exporters.includes('["\u03a3 parâmetros (%)", calculo.markupRate]'),
      exporters.includes('tableRow(["\u03a3 parâmetros", formatPercent(calculo.markupRate)])'),
    ]).toEqual([true, true, true, true]);
  });

  it("preserva o rotulo de markup quando o calculo e markup real sobre custo", () => {
    expect(parametrosDemanda).toContain('<Kpi titulo="Markup"');
    expect(parametrosDemanda).toContain("calculo.markupSobreCusto / subtotalTecnico");
    expect(exporters.match(/calculo\.markupRate/g)).toHaveLength(2);
  });
});
