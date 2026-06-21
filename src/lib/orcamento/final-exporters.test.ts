import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  exportOrcamentoFinalDocx,
  exportOrcamentoFinalXlsx,
  type OrcamentoFinalExportInfo,
  type OrcamentoFinalExportItem,
  type OrcamentoFinalExportOrigem,
  type OrcamentoFinalExportResumo,
} from "./final-exporters";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
const saveAsMock = vi.mocked(saveAs);

const info: OrcamentoFinalExportInfo = {
  numero: "OF-2026-0001-v1",
  versao: 1,
  status: "Emitido",
  cliente_nome: "Cliente Final",
  cliente_cnpj: "00.000.000/0001-00",
  cliente_contato: "contato@cliente.com",
  demanda_titulo: "Demanda híbrida",
  modalidade: "projeto_analises_custos",
  validade: "20/07/2026",
  escopo: "Escopo preservado",
};

const resumo: OrcamentoFinalExportResumo = {
  total_laboratorio_custo: 80,
  total_laboratorio_preco: 120,
  total_projeto_custo: 200,
  total_projeto_final: 300,
  total_final: 420,
};

const itens: OrcamentoFinalExportItem[] = [
  {
    grupo: "Laboratório",
    origem: "Laboratório #1",
    descricao: "qPCR",
    quantidade: 2,
    unidade: "amostra",
    custo_unitario: 40,
    preco_unitario: 60,
    subtotal: 120,
  },
];

const origens: OrcamentoFinalExportOrigem[] = [
  {
    titulo: "Total final",
    campo: "totalFinal",
    origem: "totalLaboratorioPreco + totalProjetoFinal",
    regra: "Soma dos módulos revisados.",
    valor: 420,
  },
];

describe("exportOrcamentoFinalXlsx", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera workbook com resumo, itens e origem dos valores", async () => {
    await exportOrcamentoFinalXlsx(info, resumo, itens, origens);

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-final-OF-2026-0001-v1.xlsx");

    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());

    expect(wb.worksheets.map((sheet) => sheet.name)).toEqual([
      "Orçamento Final",
      "Resumo",
      "Itens",
      "Origem dos Valores",
    ]);
    expect(wb.getWorksheet("Resumo")?.getCell("B6").value).toBe(420);
    expect(wb.getWorksheet("Itens")?.getCell("C2").value).toBe("qPCR");
  });
});

describe("exportOrcamentoFinalDocx", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera DOCX nomeado pelo numero da versao final", async () => {
    await exportOrcamentoFinalDocx(info, resumo, itens, origens);

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-final-OF-2026-0001-v1.docx");
    expect((saveAsMock.mock.calls[0][0] as Blob).size).toBeGreaterThan(1000);
  });
});
