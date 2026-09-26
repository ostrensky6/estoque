import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const historico = readFileSync(new URL("../../app/orcamento/historico/page.tsx", import.meta.url), "utf8");
const exporters = readFileSync(new URL("../project-budget/exporters.ts", import.meta.url), "utf8");

describe("terminologia economica do orcamento", () => {
  it("usa Sigma parametros somente nos quatro rotulos mapeados", () => {
    expect([
      historico.includes("`Σ parâmetros ${markup.toLocaleString"),
      historico.includes('<Delta titulo="Σ parâmetros"'),
      exporters.includes('["Σ parâmetros (%)", calculo.markupRate]'),
      exporters.includes('tableRow(["Σ parâmetros", formatPercent(calculo.markupRate)])'),
    ]).toEqual([true, true, true, true]);
  });

  it("usa a soma nominal dos parametros apenas nos dois rotulos de exportacao", () => {
    expect(exporters.match(/calculo\.markupRate/g)).toHaveLength(2);
  });
});
