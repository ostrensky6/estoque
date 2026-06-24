import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { exportOrcamentoFinalDocx, exportOrcamentoFinalXlsx } from "./final-exporters";
import { montarPropostaFinalExport } from "./proposta-final-export";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
const saveAsMock = vi.mocked(saveAs);

// Estrutura reconciliada (Política A): lab 80 + projeto 200, Σ 20% → total 350.
const dados = montarPropostaFinalExport({
  versao: {
    numero: "OF-2026-0001-v1",
    versao: 1,
    status: "emitido",
    criado_em: "2026-06-21T08:00:00Z",
    valido_ate: "2026-07-20",
    validade_dias: 30,
    total_final: 350,
  },
  snapshot: {
    consolidado: {
      totalLaboratorioCusto: 80,
      totalProjetoCusto: 200,
      economia: {
        politica: "A_GROSS_UP_TOTAL",
        subtotal: 280,
        somaPercentual: 20,
        fatorGrossUp: 1.25,
        totalParametros: 70,
        totalFinal: 350,
        formula: "total_final = (custo_laboratorial_tecnico + custo_direto_projeto) / (1 - Σparametros/100)",
        parametros: [{ label: "Impostos", percentual: 20, valorNominal: 70 }],
      },
    },
    orcamentos_analises: [{ orcamento_itens: [{ codigo_analise: "qPCR", n_amostras: 2, custo_unitario: 40, preco_unitario: 60 }] }],
    orcamentos_projeto: [{ orcamento_projeto_custos: [{ rubrica: "MC", quantidade: 1, custo_unitario: 200 }], orcamento_projeto_analises: [] }],
  },
  demanda: { titulo: "Demanda híbrida", cliente_nome: "Cliente Final", modalidade: "projeto_com_analises", escopo_preliminar: "Escopo" },
});

describe("exportOrcamentoFinalXlsx (reconciliado)", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera workbook com composição comercial reconciliada ao total final", async () => {
    await exportOrcamentoFinalXlsx(dados);
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-final-OF-2026-0001-v1.xlsx");

    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());

    expect(wb.worksheets.map((s) => s.name)).toEqual([
      "Proposta",
      "Resumo econômico",
      "Composição comercial",
      "Detalhamento técnico",
    ]);
    // a soma dos valores comerciais deve reconciliar com o total final (350)
    const comercial = wb.getWorksheet("Composição comercial")!;
    let soma = 0;
    comercial.eachRow((row, n) => {
      if (n === 1) return; // header
      const v = row.getCell(7).value; // coluna "Valor comercial"
      if (typeof v === "number") soma += v;
    });
    // inclui a linha "Total final" (350) + linhas dos componentes (350) = 700
    expect(soma).toBe(700);
  });
});

describe("exportOrcamentoFinalDocx (reconciliado)", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera DOCX nomeado pelo numero da versao final", async () => {
    await exportOrcamentoFinalDocx(dados);
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-final-OF-2026-0001-v1.docx");
    expect((saveAsMock.mock.calls[0][0] as Blob).size).toBeGreaterThan(1000);
  });
});
