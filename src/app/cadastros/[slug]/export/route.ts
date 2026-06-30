import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { CADASTROS, type Campo } from "@/lib/cadastros/config";
import { createClientUntyped } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Row = Record<string, unknown>;

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function dateFromInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function valueForCell(value: unknown, campo?: Campo, opcoes?: Map<string, string>) {
  if (value == null || value === "") return null;
  if (campo?.tipo === "checkbox") return value ? "Sim" : "Não";
  if (campo?.tipo === "select" && opcoes) return opcoes.get(String(value)) ?? value;
  if (campo?.tipo === "date") return dateFromInput(value) ?? value;
  if (campo && ["number", "currency", "percent"].includes(campo.tipo)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  return value;
}

async function opcoesParaCampos(
  campos: Campo[],
  rows: Row[],
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

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<unknown> },
) {
  const params = await ctx.params;
  const slug =
    typeof params === "object" && params != null && "slug" in params
      ? String((params as { slug: unknown }).slug)
      : "";
  const cfg = CADASTROS[slug];
  if (!cfg) return new Response("Cadastro não encontrado.", { status: 404 });

  const supabase = await createClientUntyped();
  const { data, error } = await supabase.from(cfg.tabela).select("*").order("id");
  if (error) return new Response(error.message, { status: 500 });

  const rows = ((data ?? []) as Row[]).map((row) => ({ ...row }));
  const opcoes = await opcoesParaCampos(cfg.campos, rows);
  const campoPorNome = new Map(cfg.campos.map((campo) => [campo.name, campo]));
  const labels = new Map<string, string>([
    ["id", "ID"],
    ...cfg.campos.map((campo) => [campo.name, campo.label] as const),
  ]);

  const orderedKeys = [
    "id",
    ...cfg.campos.map((campo) => campo.name),
    ...Object.keys(rows[0] ?? {}).filter(
      (key) => key !== "id" && !cfg.campos.some((campo) => campo.name === key),
    ),
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Kontrol";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(cfg.titulo.slice(0, 31));

  sheet.columns = orderedKeys.map((key) => ({
    key,
    header: labels.get(key) ?? key,
    width: Math.min(Math.max((labels.get(key) ?? key).length + 4, 12), 36),
  }));

  for (const row of rows) {
    sheet.addRow(
      Object.fromEntries(
        orderedKeys.map((key) => [
          key,
          valueForCell(row[key], campoPorNome.get(key), opcoes[key]),
        ]),
      ),
    );
  }

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
    to: { row: Math.max(1, rows.length + 1), column: orderedKeys.length },
  };

  for (const column of sheet.columns) {
    column.alignment = { vertical: "top", wrapText: true };
    const campo = campoPorNome.get(String(column.key));
    if (campo?.tipo === "currency") column.numFmt = '"R$" #,##0.00';
    if (campo?.tipo === "number") column.numFmt = '#,##0.###';
    if (campo?.tipo === "percent") column.numFmt = '0.0%';
    if (campo?.tipo === "date") column.numFmt = 'yyyy-mm-dd';
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `${safeFileName(cfg.titulo)}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
