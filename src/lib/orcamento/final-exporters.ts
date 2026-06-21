import ExcelJS from "exceljs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { formatCurrency } from "@/lib/formatters";

export type OrcamentoFinalExportInfo = {
  numero: string;
  versao: number;
  status: string;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_contato: string | null;
  demanda_titulo: string | null;
  modalidade: string | null;
  validade: string | null;
  escopo: string | null;
};

export type OrcamentoFinalExportResumo = {
  total_laboratorio_custo: number;
  total_laboratorio_preco: number;
  total_projeto_custo: number;
  total_projeto_final: number;
  total_final: number;
};

export type OrcamentoFinalExportItem = {
  grupo: string;
  origem: string;
  descricao: string;
  quantidade: number;
  unidade?: string | null;
  custo_unitario: number;
  preco_unitario: number;
  subtotal: number;
};

export type OrcamentoFinalExportOrigem = {
  titulo: string;
  campo: string;
  origem: string;
  regra: string;
  valor: number;
};

const FONT_FAMILY = "Helvetica";
const INK = "1B3530";
const BLUE = "005EA8";
const HEADER_FILL = "E8F4F3";
const SOFT_FILL = "F4FBFB";
const LINE = "D9E7E4";

const arquivoBase = (info: OrcamentoFinalExportInfo) =>
  `orcamento-final-${(info.numero || "kontrol").replace(/[^\w-]+/g, "_")}`;

export async function exportOrcamentoFinalXlsx(
  info: OrcamentoFinalExportInfo,
  resumo: OrcamentoFinalExportResumo,
  itens: OrcamentoFinalExportItem[],
  origens: OrcamentoFinalExportOrigem[],
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kontrol — ATGC";

  const dados = wb.addWorksheet("Orçamento Final");
  dados.addRows([
    ["Número", info.numero],
    ["Versão", info.versao],
    ["Status", info.status],
    ["Cliente", info.cliente_nome ?? ""],
    ["CNPJ/CPF", info.cliente_cnpj ?? ""],
    ["Contato", info.cliente_contato ?? ""],
    ["Demanda", info.demanda_titulo ?? ""],
    ["Modalidade", info.modalidade ?? ""],
    ["Validade", info.validade ?? ""],
    ["Escopo", info.escopo ?? ""],
  ]);

  const resumoSheet = wb.addWorksheet("Resumo");
  resumoSheet.addRows([
    ["Indicador", "Valor"],
    ["Custo laboratório", resumo.total_laboratorio_custo],
    ["Preço laboratório", resumo.total_laboratorio_preco],
    ["Custo projeto", resumo.total_projeto_custo],
    ["Projeto final", resumo.total_projeto_final],
    ["Total final", resumo.total_final],
  ]);

  const itensSheet = wb.addWorksheet("Itens");
  itensSheet.columns = [
    { header: "Grupo", key: "grupo", width: 26 },
    { header: "Origem", key: "origem", width: 24 },
    { header: "Descrição", key: "descricao", width: 48 },
    { header: "Quantidade", key: "quantidade", width: 14 },
    { header: "Unidade", key: "unidade", width: 12 },
    { header: "Custo unitário", key: "custo_unitario", width: 16 },
    { header: "Preço unitário", key: "preco_unitario", width: 16 },
    { header: "Subtotal", key: "subtotal", width: 16 },
  ];
  itens.forEach((item) => itensSheet.addRow(item));

  const origemSheet = wb.addWorksheet("Origem dos Valores");
  origemSheet.columns = [
    { header: "Total", key: "titulo", width: 24 },
    { header: "Campo", key: "campo", width: 26 },
    { header: "Origem", key: "origem", width: 48 },
    { header: "Regra", key: "regra", width: 68 },
    { header: "Valor", key: "valor", width: 16 },
  ];
  origens.forEach((origem) => origemSheet.addRow(origem));

  styleWorkbook(wb);
  formatCurrencyColumn(resumoSheet, ["B"]);
  formatCurrencyColumn(itensSheet, ["F", "G", "H"]);
  formatCurrencyColumn(origemSheet, ["E"]);

  const buffer = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${arquivoBase(info)}.xlsx`);
}

export async function exportOrcamentoFinalDocx(
  info: OrcamentoFinalExportInfo,
  resumo: OrcamentoFinalExportResumo,
  itens: OrcamentoFinalExportItem[],
  origens: OrcamentoFinalExportOrigem[],
) {
  const doc = new Document({
    creator: "Kontrol — ATGC",
    styles: {
      default: {
        document: {
          run: { font: FONT_FAMILY, color: INK, size: 22 },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 900, right: 720, bottom: 900, left: 720 } } },
        children: [
          docParagraph("Orçamento final — ATGC Genética Ambiental", {
            heading: HeadingLevel.TITLE,
            bold: true,
            color: BLUE,
            size: 34,
          }),
          docParagraph(`Número: ${info.numero} · Versão ${info.versao}`),
          docParagraph(`Cliente: ${info.cliente_nome || "-"}`),
          docParagraph(`Demanda: ${info.demanda_titulo || "-"}`),
          docParagraph(`Validade: ${info.validade || "-"}`),
          docParagraph("Resumo financeiro", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: tableBorders(),
            rows: [
              tableRow(["Indicador", "Valor"], true),
              tableRow(["Custo laboratório", formatCurrency(resumo.total_laboratorio_custo)]),
              tableRow(["Preço laboratório", formatCurrency(resumo.total_laboratorio_preco)]),
              tableRow(["Custo projeto", formatCurrency(resumo.total_projeto_custo)]),
              tableRow(["Projeto final", formatCurrency(resumo.total_projeto_final)]),
              tableRow(["Total final", formatCurrency(resumo.total_final)], true),
            ],
          }),
          docParagraph("Composição detalhada", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: tableBorders(),
            rows: [
              tableRow(["Grupo", "Descrição", "Qtd.", "Subtotal"], true),
              ...itens.map((item) =>
                tableRow([
                  item.grupo,
                  item.descricao,
                  `${item.quantidade} ${item.unidade ?? ""}`.trim(),
                  formatCurrency(item.subtotal),
                ]),
              ),
            ],
          }),
          docParagraph("Origem dos valores", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
            borders: tableBorders(),
            rows: [
              tableRow(["Total", "Regra", "Valor"], true),
              ...origens.map((origem) => tableRow([origem.titulo, origem.regra, formatCurrency(origem.valor)])),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${arquivoBase(info)}.docx`);
}

function styleWorkbook(wb: ExcelJS.Workbook) {
  wb.eachSheet((sheet) => {
    sheet.properties.defaultRowHeight = 22;
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.font = { name: FONT_FAMILY, size: 10, color: { argb: `FF${INK}` }, bold: rowNumber === 1 };
        cell.alignment = { vertical: "middle", horizontal: "justify", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: `FF${LINE}` } },
          left: { style: "thin", color: { argb: `FF${LINE}` } },
          bottom: { style: "thin", color: { argb: `FF${LINE}` } },
          right: { style: "thin", color: { argb: `FF${LINE}` } },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: rowNumber === 1 ? `FF${HEADER_FILL}` : "FFFFFFFF" },
        };
      });
    });
  });
}

function formatCurrencyColumn(sheet: ExcelJS.Worksheet, columns: string[]) {
  columns.forEach((column) => {
    sheet.getColumn(column).numFmt = '"R$" #,##0.00';
  });
}

function docParagraph(
  text: string,
  options: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    bold?: boolean;
    color?: string;
    size?: number;
  } = {},
) {
  return new Paragraph({
    heading: options.heading,
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        font: FONT_FAMILY,
        bold: options.bold,
        color: options.color ?? INK,
        size: options.size ?? 22,
      }),
    ],
  });
}

function tableRow(values: string[], header = false) {
  return new TableRow({
    children: values.map(
      (value) =>
        new TableCell({
          shading: header
            ? { type: ShadingType.CLEAR, fill: HEADER_FILL, color: "auto" }
            : { type: ShadingType.CLEAR, fill: SOFT_FILL, color: "auto" },
          margins: { top: 90, bottom: 90, left: 120, right: 120 },
          children: [
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [
                new TextRun({
                  text: value,
                  font: FONT_FAMILY,
                  bold: header,
                  color: header ? BLUE : INK,
                  size: 20,
                }),
              ],
            }),
          ],
        }),
    ),
  });
}

function tableBorders() {
  const border = { style: BorderStyle.SINGLE, color: LINE, size: 6 };
  return { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };
}
