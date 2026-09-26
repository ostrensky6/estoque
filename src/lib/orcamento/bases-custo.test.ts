import { describe, expect, it } from "vitest";
import { totalLaboratorioCusto, totalLaboratorioPreco, totalProjetoCusto } from "./bases-custo";

describe("bases de custo da proposta", () => {
  const itensLaboratorio = [
    { n_amostras: 2, custo_unitario: 10, preco_unitario: 15 },
    { n_amostras: 3, custo_unitario: 20, preco_unitario: 40 },
  ];
  const itensProjeto = [
    { rubrica: "MC", quantidade: 2, custo_unitario: 50 },
    { rubrica: "PE", quantidade: 99, custo_unitario: 100, meses_selecionados: [1, 2, 3] },
  ];

  it("resume custos e precos laboratoriais a partir dos snapshots atuais", () => {
    expect(totalLaboratorioCusto(itensLaboratorio)).toBe(80);
    expect(totalLaboratorioPreco(itensLaboratorio)).toBe(150);
  });

  it("resume custo de projeto preservando a regra de meses da rubrica PE", () => {
    expect(totalProjetoCusto(itensProjeto)).toBe(400);
  });
});
