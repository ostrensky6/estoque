import ExcelJS from "exceljs";
import { CADASTROS, getCadastrosOrdenados, type CadastroConfig, type Campo } from "@/lib/cadastros/config";
import { createClientUntyped } from "@/lib/supabase/server";

export type CadastroRow = Record<string, unknown>;

export const TECH_ID_HEADER = "ID";
export const TECH_SUFFIX = "__id";

export function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function dateFromInput(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateToInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function opcoesParaCampos(
  campos: Campo[],
  rows: CadastroRow[] = [],
): Promise<Record<string, Map<string, string>>> {
  const supabase = await createClientUntyped();
  const opcoes: Record<string, Map<string, string>> = {};

  for (const campo of campos) {
    if (campo.opcoes) {
      opcoes[campo.name] = new Map(campo.opcoes.map((o) => [String(o.value), o.label]));
    }
    if (campo.opcoesDe) {
      const { data } = await supabase.from(campo.opcoesDe).select("id, nome").order("nome");
      opcoes[campo.name] = new Map(
        (data ?? []).map((r) => [
          String((r as unknown as { id: number }).id),
          String((r as unknown as { nome: string | null }).nome ?? ""),
        ]),
      );
    }
  }

  if (opcoes.tipo_insumo_id) {
    const tipoIdPorNome = new Map(
      [...opcoes.tipo_insumo_id.entries()].map(([id, label]) => [label.trim().toLowerCase(), id]),
    );
    for (const row of rows) {
      if (row.tipo_insumo_id != null || row.nome_item == null) continue;
      const id = tipoIdPorNome.get(String(row.nome_item).trim().toLowerCase());
      if (id) row.tipo_insumo_id = id;
    }
  }

  return opcoes;
}

export function valueForCell(value: unknown, campo?: Campo, opcoes?: Map<string, string>) {
  if (value == null || value === "") return null;
  if (campo?.tipo === "checkbox") return value ? "Sim" : "Não";
  if (campo?.tipo === "select" && opcoes) return opcoes.get(String(value)) ?? value;
  if (campo?.tipo === "date") return dateFromInput(value) ?? value;
  if (campo?.tipo === "percent") {
    const n = Number(value);
    return Number.isFinite(n) ? n / 100 : value;
  }
  if (campo && ["number", "currency", "percent"].includes(campo.tipo)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

export function workbookColumns(cfg: CadastroConfig, rows: CadastroRow[]) {
  const labels = new Map<string, string>([
    ["id", TECH_ID_HEADER],
    ...cfg.campos.map((campo) => [campo.name, campo.label] as const),
  ]);
  const keys = [
    "id",
    ...cfg.campos.flatMap((campo) =>
      campo.tipo === "select" && campo.opcoesDe ? [campo.name, `${campo.name}${TECH_SUFFIX}`] : [campo.name],
    ),
    ...Object.keys(rows[0] ?? {}).filter(
      (key) =>
        key !== "id" &&
        !cfg.campos.some((campo) => campo.name === key) &&
        !cfg.campos.some((campo) => `${campo.name}${TECH_SUFFIX}` === key),
    ),
  ];

  return keys.map((key) => ({
    key,
    header: key.endsWith(TECH_SUFFIX)
      ? `${labels.get(key.slice(0, -TECH_SUFFIX.length)) ?? key.slice(0, -TECH_SUFFIX.length)} ID`
      : labels.get(key) ?? key,
    width: Math.min(Math.max((labels.get(key) ?? key).length + 4, 12), 36),
  }));
}

export function applyWorksheetFormatting(
  sheet: ExcelJS.Worksheet,
  cfg: CadastroConfig,
  rowCount: number,
) {
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rowCount + 1), column: sheet.columnCount },
  };

  const campoPorNome = new Map(cfg.campos.map((campo) => [campo.name, campo]));
  for (const column of sheet.columns) {
    column.alignment = { vertical: "top", wrapText: true };
    const key = String(column.key ?? "");
    const campo = campoPorNome.get(key.endsWith(TECH_SUFFIX) ? key.slice(0, -TECH_SUFFIX.length) : key);
    if (key.endsWith(TECH_SUFFIX)) column.hidden = true;
    if (campo?.tipo === "currency") column.numFmt = '"R$" #,##0.00';
    if (campo?.tipo === "number") column.numFmt = "#,##0.###";
    if (campo?.tipo === "percent") column.numFmt = "0.0%";
    if (campo?.tipo === "date") column.numFmt = "yyyy-mm-dd";
  }
}

export async function addCadastroWorksheet(
  workbook: ExcelJS.Workbook,
  cfg: CadastroConfig,
  rows: CadastroRow[],
) {
  const sheet = workbook.addWorksheet(cfg.titulo.slice(0, 31));
  const opcoes = await opcoesParaCampos(cfg.campos, rows);
  const campoPorNome = new Map(cfg.campos.map((campo) => [campo.name, campo]));

  sheet.columns = workbookColumns(cfg, rows);
  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        sheet.columns.map((column) => {
          const key = String(column.key ?? "");
          if (key.endsWith(TECH_SUFFIX)) {
            const sourceKey = key.slice(0, -TECH_SUFFIX.length);
            return [key, row[sourceKey] ?? null];
          }
          return [key, valueForCell(row[key], campoPorNome.get(key), opcoes[key])];
        }),
      ),
    );
  }

  applyWorksheetFormatting(sheet, cfg, rows.length);
}

export async function buildCadastrosWorkbook(slug?: string) {
  const supabase = await createClientUntyped();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kontrol";
  workbook.created = new Date();

  const cadastros = slug ? [CADASTROS[slug]].filter(Boolean) : getCadastrosOrdenados();
  for (const cfg of cadastros) {
    const { data, error } = await supabase.from(cfg.tabela).select("*").order("id");
    if (error) throw new Error(error.message);
    await addCadastroWorksheet(workbook, cfg, ((data ?? []) as CadastroRow[]).map((row) => ({ ...row })));
  }

  return workbook;
}
