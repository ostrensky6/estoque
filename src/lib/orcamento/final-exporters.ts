/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
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
  emitido_em?: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_contato: string | null;
  demanda_titulo: string | null;
  modalidade: string | null;
  validade: string | null;
  validade_dias?: number | null;
  escopo: string | null;
  condicoes?: string | null;
  responsavel?: string | null;
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
const BLUE = "1A5292";
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
    ["Emitido em", info.emitido_em ?? ""],
    ["Cliente", info.cliente_nome ?? ""],
    ["CNPJ/CPF", info.cliente_cnpj ?? ""],
    ["Contato", info.cliente_contato ?? ""],
    ["Demanda", info.demanda_titulo ?? ""],
    ["Modalidade", info.modalidade ?? ""],
    ["Validade", info.validade ?? ""],
    ["Validade em dias", info.validade_dias ?? ""],
    ["Responsável", info.responsavel ?? ""],
    ["Condições comerciais", info.condicoes ?? ""],
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

  const clienteSheet = wb.addWorksheet("Proposta Cliente");
  clienteSheet.addRows([
    ["Grupo", "Descrição", "Quantidade", "Unidade", "Subtotal"],
    ...itens.map((item) => [item.grupo, item.descricao, item.quantidade, item.unidade ?? "", item.subtotal]),
    ["", "", "", "Total final", resumo.total_final],
  ]);

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
  formatCurrencyColumn(clienteSheet, ["E"]);

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
          docParagraph(`Emitido em: ${info.emitido_em || "-"} · Validade: ${info.validade || "-"}`),
          docParagraph(`Cliente: ${info.cliente_nome || "-"}`),
          docParagraph(`Contato: ${info.cliente_contato || "-"} · Responsável: ${info.responsavel || "-"}`),
          docParagraph(`Demanda: ${info.demanda_titulo || "-"}`),
          docParagraph("Escopo", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
          docParagraph(info.escopo || "-"),
          docParagraph("Composição comercial", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
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
              tableRow(["", "Total final", "", formatCurrency(resumo.total_final)], true),
            ],
          }),
          docParagraph("Condições comerciais", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
          docParagraph(info.condicoes || "Valores válidos até a data indicada. Alterações de escopo, quantidade de amostras ou premissas técnicas podem exigir nova versão."),
          docParagraph("Resumo interno", { heading: HeadingLevel.HEADING_1, bold: true, color: BLUE, size: 26 }),
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

export async function exportPropostaConfiguradaDocx(
  info: any,
  resumo: any,
  itens: any[],
  rubricas: any[],
  opcoes: Record<string, boolean>,
  tipoEmissao: "GIA / UFPR" | "ATGC",
  signer: any,
) {
  const children: any[] = [];
  const mainColor = tipoEmissao === "GIA / UFPR" ? BLUE : "0B8793"; // Blue vs Teal
  const titleText = tipoEmissao === "GIA / UFPR"
    ? "Grupo Integrado de Aquicultura e Estudos Ambientais"
    : "ATGC Genética Ambiental Limitada";

  children.push(
    docParagraph(titleText, {
      heading: HeadingLevel.TITLE,
      bold: true,
      color: mainColor,
      size: 30,
    })
  );

  children.push(docParagraph(`Proposta Comercial: ${info.numero} · Versão ${info.versao}`));
  children.push(docParagraph(`Emissão: ${info.emitido_em || "-"} · Validade: ${info.validade || "-"}`));
  children.push(docParagraph(`Cliente: ${info.cliente_nome || "-"}`));
  if (info.cliente_contato) {
    children.push(docParagraph(`Contato do Cliente: ${info.cliente_contato}`));
  }
  children.push(docParagraph(`Assunto: ${info.demanda_titulo || "-"}`));

  if (opcoes.resumo_demanda && info.escopo) {
    children.push(docParagraph("1. Objeto e Escopo", { heading: HeadingLevel.HEADING_1, bold: true, color: mainColor, size: 24 }));
    children.push(docParagraph(info.escopo));
  }

  if (opcoes.analises_incluidas && itens.length > 0) {
    children.push(docParagraph("2. Análises e Serviços Laboratoriais", { heading: HeadingLevel.HEADING_1, bold: true, color: mainColor, size: 24 }));

    const showPrices = opcoes.custos_laboratoriais;
    const headers = ["Código", "Análise / Descrição"];
    if (opcoes.qtd_amostras) headers.push("Amostras");
    if (showPrices) {
      headers.push("V. Unitário");
      headers.push("Subtotal");
    }

    const rows = [
      tableRow(headers, true),
      ...itens.map((item) => {
        const codigo = item.codigo ?? item.codigo_analise;
        const nome = item.nome ?? item.analises?.nome ?? "Análise Técnica";
        const amostras = item.amostras ?? item.n_amostras ?? 0;
        const precoUnitario = item.precoUnitarioMedio ?? item.preco_unitario ?? 0;
        const precoSubtotal = item.preco ?? (amostras * precoUnitario);

        const rowCells = [codigo, nome];
        if (opcoes.qtd_amostras) rowCells.push(String(amostras));
        if (showPrices) {
          rowCells.push(formatCurrency(precoUnitario));
          rowCells.push(formatCurrency(precoSubtotal));
        }
        return tableRow(rowCells, false);
      })
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: tableBorders(),
        rows,
      })
    );
  }

  if (opcoes.custos_projeto && rubricas.length > 0) {
    children.push(docParagraph("3. Custos Diretos de Projeto", { heading: HeadingLevel.HEADING_1, bold: true, color: mainColor, size: 24 }));

    const headers = ["Descrição", "Rubrica", "Qtd", "Unitário", "Subtotal"];
    const rows = [
      tableRow(headers, true),
      ...rubricas.map((item) => {
        const desc = item.descricao ?? item.nome ?? "Item de projeto";
        const rub = item.rubrica ?? item.codigo ?? "OU";
        const qty = item.quantidade ?? item.itens ?? 0;
        const uni = item.preco_unitario ?? (item.custo ? item.custo / (qty || 1) : 0);
        const sub = (item.preco_unitario && item.quantidade) ? (item.preco_unitario * item.quantidade) : (item.custo ?? 0);
        return tableRow([
          desc,
          rub,
          String(qty),
          formatCurrency(uni),
          formatCurrency(sub),
        ], false);
      })
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        layout: TableLayoutType.FIXED,
        borders: tableBorders(),
        rows,
      })
    );
  }

  if (opcoes.subtotais_modulo || opcoes.taxas || opcoes.impostos) {
    children.push(docParagraph("Detalhamento Econômico", { heading: HeadingLevel.HEADING_1, bold: true, color: mainColor, size: 22 }));

    const detailRows: any[] = [];
    if (opcoes.subtotais_modulo) {
      detailRows.push(tableRow(["Subtotal Lab / Análises", formatCurrency(resumo.total_laboratorio_preco)]));
      detailRows.push(tableRow(["Subtotal Custo de Projeto", formatCurrency(resumo.total_projeto_final)]));
    }
    if (opcoes.impostos) {
      const taxesVal = resumo.total_final - (resumo.total_laboratorio_preco + resumo.total_projeto_final);
      detailRows.push(tableRow(["Impostos e Encargos Fiscais", formatCurrency(taxesVal > 0 ? taxesVal : 0)]));
    }

    if (detailRows.length > 0) {
      children.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          layout: TableLayoutType.FIXED,
          borders: tableBorders(),
          rows: [
            tableRow(["Indicador", "Valor"], true),
            ...detailRows
          ]
        })
      );
    }
  }

  children.push(docParagraph("Valor Total da Proposta", { heading: HeadingLevel.HEADING_2, bold: true, color: mainColor, size: 22 }));
  children.push(
    docParagraph(`Valor Total: ${formatCurrency(resumo.total_final)}`, {
      bold: true,
      size: 26,
    })
  );

  if (opcoes.prazo_execucao && signer.prazo) {
    children.push(docParagraph(`Prazo de Execução: ${signer.prazo}`));
  }
  if (opcoes.prazo_validade && signer.formaPagamento) {
    children.push(docParagraph(`Forma de Pagamento: ${signer.formaPagamento}`));
  }
  if (opcoes.condicoes_comerciais && info.condicoes) {
    children.push(docParagraph("Condições Comerciais", { bold: true }));
    children.push(docParagraph(info.condicoes));
  }
  if (signer.observacoes) {
    children.push(docParagraph("Observações Gerais", { bold: true }));
    children.push(docParagraph(signer.observacoes));
  }

  if (opcoes.dados_emissor) {
    children.push(new Paragraph({ spacing: { before: 800 } }));
    const assinaturaBytes = dataUrlToUint8Array(signer.assinaturaUrl ?? signer.assinatura_url);
    if (assinaturaBytes) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              data: assinaturaBytes,
              transformation: { width: 180, height: 72 },
              type: "png",
            }),
          ],
        }),
      );
    }
    children.push(docParagraph(signer.nome, { bold: true }));
    children.push(docParagraph(`${signer.cargo} — ${signer.instituicao}`));
    if (signer.email || signer.telefone) {
      children.push(docParagraph(`${signer.email || ""} | ${signer.telefone || ""}`, { size: 18, color: "555555" }));
    }
  }

  // Rodapé com o endereço
  children.push(new Paragraph({ spacing: { before: 600 } }));
  const brandName = tipoEmissao === "GIA / UFPR" ? "Grupo Integrado de Aquicultura e Estudos Ambientais" : "ATGC Genética Ambiental Limitada";
  children.push(docParagraph(brandName, { bold: true, size: 16, color: "888888" }));
  children.push(docParagraph("Universidade Federal do Paraná, Rua dos Funcionários, 1540, Juvevê, Curitiba - PR, CEP 80035-050", { size: 16, color: "888888" }));

  const doc = new Document({
    creator: "Kontrol",
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
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `proposta-comercial-${(info.numero || "final").replace(/[^\w-]+/g, "_")}.docx`);
}

function dataUrlToUint8Array(dataUrl?: string | null) {
  if (!dataUrl?.startsWith("data:image/png;base64,")) return null;
  const base64 = dataUrl.split(",", 2)[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
