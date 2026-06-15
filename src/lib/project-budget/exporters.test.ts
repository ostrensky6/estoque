import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { calcularOrcamentoProjetoLegacy } from "./legacy";
import {
  exportProjetoDocx,
  exportProjetoXlsx,
  type ProjetoExportInfo,
  type ProjetoExportItem,
} from "./exporters";
import { saveAs } from "file-saver";

vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
const saveAsMock = vi.mocked(saveAs);

const info: ProjetoExportInfo = {
  numero: "ORC-2026-0007",
  titulo: "Projeto & Campo",
  cliente_nome: "Cliente <Especial>",
  cliente_cnpj: "00.000.000/0001-00",
  cliente_contato: "contato@cliente.com",
  coordenador: "Coordenação",
  proprietario: "ATGC",
  responsavel: "Resp.",
  data_orcamento: "2026-06-15",
  status: "rascunho",
  project_months: 6,
  escopo: "Escopo do projeto",
  cronograma: "6 meses",
  observacoes: "Observação com <tag> & aspas",
};

const itens: ProjetoExportItem[] = [
  {
    rubrica: "MC",
    categoria: "Reagentes",
    descricao: "Kit extração DNA",
    unidade: "un",
    quantidade: 2,
    preco_unitario: 150,
    meses_selecionados: [],
    total: 300,
  },
  {
    rubrica: "PE",
    categoria: "Equipe",
    descricao: "Pesquisador",
    unidade: "mês",
    quantidade: 0,
    preco_unitario: 1000,
    meses_selecionados: [1, 2, 3],
    total: 3000,
  },
];

const calculo = calcularOrcamentoProjetoLegacy(
  itens.map((it) => ({
    rubrica: it.rubrica,
    quantidade: it.quantidade,
    preco_unitario: it.preco_unitario,
    meses_selecionados: it.meses_selecionados,
  })),
  { impostos_legacy: 10, incubacao: 5, reserva: 0, investimentos: 0, lucro: 5 },
);

describe("exportProjetoXlsx", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera workbook com abas Projeto/Itens/Demonstrativo e valores corretos", async () => {
    await exportProjetoXlsx(info, itens, calculo);

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-projeto-ORC-2026-0007.xlsx");

    const blob = saveAsMock.mock.calls[0][0] as Blob;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());

    expect(wb.worksheets.map((s) => s.name)).toEqual(["Projeto", "Itens", "Demonstrativo"]);
    const itemSheet = wb.getWorksheet("Itens");
    expect(itemSheet?.getCell("C2").value).toBe("Kit extração DNA");
    expect(itemSheet?.getCell("H2").value).toBe(300);
    expect(itemSheet?.getCell("F3").value).toBe("1, 2, 3");
    expect(itemSheet?.getCell("H3").value).toBe(3000);
  });
});

describe("exportProjetoDocx", () => {
  beforeEach(() => saveAsMock.mockClear());

  it("gera DOCX como blob nomeado pelo número", async () => {
    await exportProjetoDocx(info, itens, calculo);

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    expect(saveAsMock.mock.calls[0][1]).toBe("orcamento-projeto-ORC-2026-0007.docx");
    const blob = saveAsMock.mock.calls[0][0] as Blob;
    expect(blob.size).toBeGreaterThan(1000);
  });
});
