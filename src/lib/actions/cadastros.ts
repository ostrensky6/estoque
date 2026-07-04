"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCadastrosOrdenados, type CadastroConfig, type Campo } from "@/lib/cadastros/config";
import { TECH_ID_HEADER, TECH_SUFFIX, opcoesParaCampos } from "@/lib/cadastros/xlsx";
import { createClientUntyped } from "@/lib/supabase/server";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export type ImportCadastroResumo = {
  aba: string;
  inseridos: number;
  atualizados: number;
  removidos: number;
  ignorados: number;
  erros: string[];
  naoRemovidosPorVinculo: string[];
};

export type ImportCadastrosState = {
  ok: boolean;
  message?: string;
  resumo?: ImportCadastroResumo[];
};

// ---- helpers de coerção ----
const reqNum = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number({ error: "Obrigatório" })
      .refine((n) => !Number.isNaN(n), "Número inválido")
      .refine((n) => opts.min == null || n >= opts.min, `Mínimo ${opts.min}`)
      .refine((n) => opts.max == null || n <= opts.max, `Máximo ${opts.max}`),
  );
const optNum = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z
      .number()
      .refine((n) => opts.min == null || n >= opts.min, `Mínimo ${opts.min}`)
      .refine((n) => opts.max == null || n <= opts.max, `Máximo ${opts.max}`)
      .nullable(),
  );
const reqStr = z.string().trim().min(1, "Obrigatório");
const optStr = z.preprocess(
  (v) => (v === "" || v == null ? null : String(v).trim()),
  z.string().nullable(),
);
const optDate = optStr;

function dateFromInput(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateToInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateText: unknown, days: unknown): string | null {
  const base = dateFromInput(dateText);
  const n = Number(days);
  if (!base || !Number.isFinite(n) || n <= 0) return null;
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + Math.round(n));
  return dateToInput(result);
}

function addYears(dateText: unknown, years: unknown): string | null {
  const n = Number(years);
  if (!Number.isFinite(n) || n <= 0) return null;
  return addDays(dateText, n * 365.2425);
}

const SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  clientes: z.object({
    nome: reqStr,
    cnpj: optStr,
    endereco: optStr,
    contato: optStr,
    email: optStr,
    telefone: optStr,
    observacoes: optStr,
    ativo: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  }),
  projetos: z.object({
    nome: reqStr,
    cliente_id: optNum({ min: 0 }),
    responsavel: optStr,
    status: z.preprocess(
      (v) => (v === "" || v == null ? "proposto" : v),
      z.enum(["proposto", "ativo", "concluido", "cancelado"]),
    ),
    data_inicio: optDate,
    data_fim: optDate,
    descricao: optStr,
  }),
  equipamentos: z.object({
    nome: reqStr,
    quantidade: reqNum({ min: 0 }),
    custo_unitario: reqNum({ min: 0 }),
    data_aquisicao: optDate,
    data_validade: optDate,
    vida_util_anos: optNum({ min: 0 }),
    percentual_manutencao_anual: optNum({ min: 0, max: 1 }),
    manutencao_anual_fixa: optNum({ min: 0 }),
    possui: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  }).transform((d) => ({
    ...d,
    data_validade: addYears(d.data_aquisicao, d.vida_util_anos) ?? d.data_validade,
  })),
  insumos: z
    .object({
      tipo_insumo_id: optNum({ min: 0 }),
      nome_item: optStr,
      especificacao: reqStr,
      fabricante: optStr,
      codigo_fabricante: optStr,
      codigo_interno: optStr,
      custo_total_embalagem: reqNum({ min: 0 }),
      quantidade_embalagem: reqNum({ min: 0.000001 }),
      unidade: optStr,
      unidade_consumo: optStr,
      fator_conversao: reqNum({ min: 0.000001 }),
      data_aquisicao: optDate,
      data_fabricacao: optDate,
      validade_dias: optNum({ min: 0 }),
      data_validade: optDate,
      fornecedor_id: optNum({ min: 0 }),
      fornecedor_alt_id: optNum({ min: 0 }),
      categoria_compra: optStr,
      quantidade_minima_compra: optNum({ min: 0 }),
      prazo_entrega_max_dias: optNum({ min: 0 }),
      ponto_reposicao: optNum({ min: 0 }),
      estoque_seguranca: optNum({ min: 0 }),
      lead_time_dias: optNum({ min: 0 }),
      condicao_armazenamento: optStr,
      validade_apos_abertura_dias: optNum({ min: 0 }),
      sds_url: optStr,
    })
    .transform((d) => ({
      ...d,
      ponto_reposicao: d.ponto_reposicao ?? 0,
      estoque_seguranca: d.estoque_seguranca ?? 0,
      data_validade:
        d.data_validade ??
        addDays(d.data_fabricacao ?? d.data_aquisicao, d.validade_dias),
      // custo unitário derivado da embalagem
      custo_unitario:
        Number(d.quantidade_embalagem) > 0
          ? Number(d.custo_total_embalagem) / Number(d.quantidade_embalagem)
          : null,
    })),
  tipo_insumos: z.object({
    nome: reqStr,
    classe: z.preprocess(
      (v) => (v === "" || v == null ? "insumo" : v),
      z.enum(["reagente", "consumivel", "material", "equipamento_consumivel", "servico", "insumo"]),
    ),
    unidade_referencia: optStr,
    finalidade: optStr,
    observacoes: optStr,
    ativo: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  }),
  tecnicos: z.object({
    nome: reqStr,
    processo: optStr,
    valor_mes: reqNum({ min: 0 }),
    horas_mes_base: reqNum({ min: 1 }),
    percentual_dedicado: reqNum({ min: 0, max: 100 }),
  }),
  overhead: z.object({
    item: reqStr,
    custo_mensal: reqNum({ min: 0 }),
    percentual_compensada: reqNum({ min: 0, max: 100 }),
    horas_bancada_mes: reqNum({ min: 1 }),
  }),
  fornecedores: z.object({
    nome: reqStr,
    cnpj: optStr,
    contato: optStr,
    email: optStr,
    telefone: optStr,
    site: optStr,
    endereco: optStr,
    catalogo_padrao: optStr,
    prazo_medio_dias: optNum({ min: 0 }),
    prazo_max_dias: optNum({ min: 0 }),
    observacoes: optStr,
    ativo: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  }),
  locais: z.object({
    nome: reqStr,
    tipo: optStr,
    parent_id: optNum({ min: 0 }),
    condicao_armazenamento: optStr,
  }),
};

const TABELAS: Record<string, string> = {
  clientes: "clientes",
  projetos: "projetos",
  equipamentos: "equipamentos",
  insumos: "insumos",
  tipo_insumos: "tipo_insumos",
  tecnicos: "tecnicos",
  overhead: "overhead",
  fornecedores: "fornecedores",
  locais: "locais",
};

/** Páginas que derivam dados dos cadastros — revalidadas a cada alteração. */
const DEPENDENTES = [
  "/cadastros",
  "/custeio",
  "/analises",
  "/orcamento",
  "/estoque",
  "/compras",
  "/planejamento",
  "/insumos",
  "/",
];
function revalidarDependentes(slug: string) {
  revalidatePath(`/cadastros/${slug}`);
  for (const p of DEPENDENTES) revalidatePath(p);
}

function formToObject(formData: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("_")) continue;
    o[k] = v;
  }
  return o;
}

function aplicarPadroesCadastro(slug: string, obj: Record<string, unknown>) {
  if (slug === "equipamentos" && !("possui" in obj)) obj.possui = "false";
  if (slug === "tipo_insumos" && !("ativo" in obj)) obj.ativo = "false";
  if ((slug === "clientes" || slug === "fornecedores") && !("ativo" in obj)) obj.ativo = "false";
  if (slug === "insumos") {
    if (!("fator_conversao" in obj) || obj.fator_conversao === "") obj.fator_conversao = "1";
    if (
      (!("unidade_consumo" in obj) || obj.unidade_consumo === "") &&
      typeof obj.unidade === "string" &&
      obj.unidade.trim()
    ) {
      obj.unidade_consumo = obj.unidade;
    }
  }
  return obj;
}

function errosZod(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = String(issue.path[0] ?? "");
    if (path && !errors[path]) errors[path] = issue.message;
  }
  return errors;
}

export async function salvarRegistro(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("_slug") ?? "");
  const idRaw = formData.get("_id");
  const id = idRaw ? Number(idRaw) : null;

  const schema = SCHEMAS[slug];
  const tabela = TABELAS[slug];
  if (!schema || !tabela) return { ok: false, message: "Cadastro inválido." };

  // checkbox ausente não vem no FormData
  const obj = aplicarPadroesCadastro(slug, formToObject(formData));

  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados.", errors: errosZod(parsed.error) };
  }

  const supabase = await createClientUntyped();
  const payload = parsed.data;

  const res = id
    ? await supabase.from(tabela).update(payload).eq("id", id)
    : await supabase.from(tabela).insert(payload);

  if (res.error) return { ok: false, message: res.error.message };

  revalidarDependentes(slug);
  return { ok: true, message: id ? "Atualizado." : "Criado." };
}

export async function excluirRegistro(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("_slug") ?? "");
  const id = Number(formData.get("_id"));
  const tabela = TABELAS[slug];
  if (!tabela || !id) return { ok: false, message: "Registro inválido." };

  const supabase = await createClientUntyped();
  const { error } = await supabase.from(tabela).delete().eq("id", id);

  if (error) {
    const msg =
      error.code === "23503"
        ? "Não é possível excluir: está em uso por outra tabela (ex.: alocação em análise)."
        : error.message;
    return { ok: false, message: msg };
  }

  revalidarDependentes(slug);
  return { ok: true, message: "Excluído." };
}

function normalizarChave(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function valorCelula(cell: ExcelJS.Cell) {
  const value = cell.value;
  if (value == null) return null;
  if (value instanceof Date) return dateToInput(value);
  if (typeof value !== "object") return value;
  if ("text" in value && typeof value.text === "string") return value.text;
  if ("hyperlink" in value && "text" in value && typeof value.text === "string") return value.text;
  if ("result" in value) return value.result ?? null;
  if ("richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return String(cell.text ?? "");
}

function valorParaCampo(value: unknown, campo: Campo, opcoes?: Map<string, string>) {
  if (value == null || value === "") return "";
  if (campo.tipo === "checkbox") {
    const normalized = normalizarChave(value);
    return ["sim", "true", "1", "x", "yes", "on"].includes(normalized) ? "true" : "false";
  }
  if (campo.tipo === "date") {
    if (value instanceof Date) return dateToInput(value);
    return String(value).slice(0, 10);
  }
  if (campo.tipo === "percent") {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n * 100 : value;
  }
  if (campo.tipo === "select") {
    const raw = String(value).trim();
    if (!opcoes) return raw;
    if (opcoes.has(raw)) return raw;
    const idPorLabel = new Map(
      [...opcoes.entries()].map(([id, label]) => [normalizarChave(label), id]),
    );
    return idPorLabel.get(normalizarChave(raw)) ?? raw;
  }
  return value;
}

function mapaCabecalhos(cfg: CadastroConfig) {
  const mapa = new Map<string, string>();
  mapa.set(normalizarChave(TECH_ID_HEADER), "id");
  mapa.set("id", "id");
  for (const campo of cfg.campos) {
    mapa.set(normalizarChave(campo.label), campo.name);
    mapa.set(normalizarChave(campo.name), campo.name);
    if (campo.tipo === "select" && campo.opcoesDe) {
      mapa.set(normalizarChave(`${campo.label} ID`), `${campo.name}${TECH_SUFFIX}`);
      mapa.set(normalizarChave(`${campo.name}${TECH_SUFFIX}`), `${campo.name}${TECH_SUFFIX}`);
    }
  }
  return mapa;
}

function registrosDaAba(
  sheet: ExcelJS.Worksheet,
  cfg: CadastroConfig,
  opcoes: Record<string, Map<string, string>>,
) {
  const headers: string[] = [];
  const headerMap = mapaCabecalhos(cfg);
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = headerMap.get(normalizarChave(valorCelula(cell))) ?? "";
  });

  const campoPorNome = new Map(cfg.campos.map((campo) => [campo.name, campo]));
  const rows: { excelRow: number; id: number | null; obj: Record<string, unknown> }[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    const technicalIds: Record<string, unknown> = {};

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const value = valorCelula(cell);
      if (value == null || value === "") return;
      if (key === "id") {
        obj.id = value;
        return;
      }
      if (key.endsWith(TECH_SUFFIX)) {
        technicalIds[key.slice(0, -TECH_SUFFIX.length)] = value;
        return;
      }
      const campo = campoPorNome.get(key);
      obj[key] = campo ? valorParaCampo(value, campo, opcoes[key]) : value;
    });

    for (const [key, value] of Object.entries(technicalIds)) {
      if (value != null && value !== "") obj[key] = value;
    }

    const temValor = Object.entries(obj).some(([key, value]) => key !== "id" && value != null && value !== "");
    if (!temValor) return;

    rows.push({
      excelRow: rowNumber,
      id: obj.id == null || obj.id === "" ? null : Number(obj.id),
      obj: aplicarPadroesCadastro(cfg.slug, obj),
    });
  });

  return rows;
}

function mapaNatural(existingRows: Record<string, unknown>[], rotulo: string) {
  const map = new Map<string, Record<string, unknown> | null>();
  for (const row of existingRows) {
    const key = normalizarChave(row[rotulo]);
    if (!key) continue;
    map.set(key, map.has(key) ? null : row);
  }
  return map;
}

const REFERENCIAS_CADASTROS: Record<string, { tabela: string; coluna: string; label: string }[]> = {
  clientes: [{ tabela: "projetos", coluna: "cliente_id", label: "projetos" }],
  projetos: [
    { tabela: "orcamentos", coluna: "projeto_id", label: "orçamentos" },
    { tabela: "demandas_propostas", coluna: "projeto_id", label: "demandas" },
  ],
  tipo_insumos: [{ tabela: "insumos", coluna: "tipo_insumo_id", label: "insumos" }],
  insumos: [
    { tabela: "insumo_analise", coluna: "insumo_id", label: "insumos por análise" },
    { tabela: "lotes_estoque", coluna: "insumo_id", label: "lotes de estoque" },
  ],
  equipamentos: [
    { tabela: "equipamento_analise", coluna: "equipamento_id", label: "equipamentos por análise" },
    { tabela: "equipamentos_unidades", coluna: "equipamento_id", label: "unidades de equipamento" },
  ],
  fornecedores: [
    { tabela: "insumos", coluna: "fornecedor_id", label: "insumos" },
    { tabela: "insumos", coluna: "fornecedor_alt_id", label: "insumos" },
    { tabela: "pedidos_compra", coluna: "fornecedor_id", label: "pedidos de compra" },
  ],
  locais: [
    { tabela: "locais", coluna: "parent_id", label: "locais filhos" },
    { tabela: "lotes_estoque", coluna: "local_id", label: "lotes de estoque" },
    { tabela: "equipamentos_unidades", coluna: "local_id", label: "unidades de equipamento" },
    { tabela: "inventario_ciclos", coluna: "local_id", label: "inventário" },
    { tabela: "inventario_contagens", coluna: "local_id", label: "contagens de inventário" },
  ],
};

async function motivoVinculoExistente(
  supabase: Awaited<ReturnType<typeof createClientUntyped>>,
  slug: string,
  id: number,
) {
  for (const referencia of REFERENCIAS_CADASTROS[slug] ?? []) {
    const { data, error } = await supabase
      .from(referencia.tabela)
      .select("id")
      .eq(referencia.coluna, id)
      .limit(1);
    if (error) continue;
    if (Array.isArray(data) && data.length > 0) return referencia.label;
  }
  return null;
}

async function importarCadastro(
  cfg: CadastroConfig,
  sheet: ExcelJS.Worksheet,
): Promise<ImportCadastroResumo> {
  const resumo: ImportCadastroResumo = {
    aba: cfg.titulo,
    inseridos: 0,
    atualizados: 0,
    removidos: 0,
    ignorados: 0,
    erros: [],
    naoRemovidosPorVinculo: [],
  };
  const schema = SCHEMAS[cfg.slug];
  const tabela = TABELAS[cfg.slug];
  if (!schema || !tabela) {
    resumo.erros.push("Cadastro sem schema/tabela configurado.");
    return resumo;
  }

  const supabase = await createClientUntyped();
  const { data: existing, error: selectError } = await supabase.from(tabela).select("*").order("id");
  if (selectError) {
    resumo.erros.push(selectError.message);
    return resumo;
  }

  const existingRows = (existing ?? []) as Record<string, unknown>[];
  const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
  const existingByNatural = mapaNatural(existingRows, cfg.rotulo);
  const opcoes = await opcoesParaCampos(cfg.campos, existingRows);
  const importedRows = registrosDaAba(sheet, cfg, opcoes);
  const vistos = new Set<number>();
  const naturaisImportados = new Set<string>();

  for (const row of importedRows) {
    const parsed = schema.safeParse(row.obj);
    if (!parsed.success) {
      resumo.ignorados += 1;
      const fields = Object.entries(errosZod(parsed.error))
        .map(([field, message]) => `${field}: ${message}`)
        .join("; ");
      resumo.erros.push(`Linha ${row.excelRow}: ${fields || "dados inválidos"}`);
      continue;
    }

    const naturalKey = normalizarChave(row.obj[cfg.rotulo]);
    if (!row.id && naturalKey && naturaisImportados.has(naturalKey)) {
      resumo.ignorados += 1;
      resumo.erros.push(`Linha ${row.excelRow}: chave natural repetida na planilha.`);
      continue;
    }
    const naturalMatch = naturalKey ? existingByNatural.get(naturalKey) : null;
    if (!row.id && naturalKey && existingByNatural.has(naturalKey) && naturalMatch == null) {
      resumo.ignorados += 1;
      resumo.erros.push(
        `Linha ${row.excelRow}: chave natural duplicada em ${cfg.titulo}; informe o ID para atualizar com segurança.`,
      );
      continue;
    }
    const targetId =
      row.id && existingById.has(row.id)
        ? row.id
        : naturalMatch && naturalMatch.id != null
          ? Number(naturalMatch.id)
          : null;

    if (targetId) {
      const { error } = await supabase.from(tabela).update(parsed.data).eq("id", targetId);
      if (error) {
        resumo.ignorados += 1;
        resumo.erros.push(`Linha ${row.excelRow}: ${error.message}`);
        continue;
      }
      vistos.add(targetId);
      if (naturalKey) naturaisImportados.add(naturalKey);
      resumo.atualizados += 1;
      continue;
    }

    const { data, error } = await supabase.from(tabela).insert(parsed.data).select("id").single();
    if (error) {
      resumo.ignorados += 1;
      resumo.erros.push(`Linha ${row.excelRow}: ${error.message}`);
      continue;
    }
    if (data && typeof data === "object" && "id" in data) vistos.add(Number(data.id));
    if (naturalKey) naturaisImportados.add(naturalKey);
    resumo.inseridos += 1;
  }

  if (resumo.erros.length === 0) {
    for (const existingRow of existingRows) {
      const id = Number(existingRow.id);
      if (!id || vistos.has(id)) continue;
      const label = String(existingRow[cfg.rotulo] ?? `ID ${id}`);
      const vinculo = await motivoVinculoExistente(supabase, cfg.slug, id);
      if (vinculo) {
        resumo.naoRemovidosPorVinculo.push(`${label}: não removido por vínculo existente (${vinculo}).`);
        continue;
      }
      const { error } = await supabase.from(tabela).delete().eq("id", id);
      if (error) {
        const msg =
          error.code === "23503"
            ? `${label}: não removido por vínculo existente.`
            : `${label}: ${error.message}`;
        if (error.code === "23503") resumo.naoRemovidosPorVinculo.push(msg);
        else resumo.erros.push(msg);
        continue;
      }
      resumo.removidos += 1;
    }
  }

  revalidarDependentes(cfg.slug);
  return resumo;
}

export async function importarCadastrosWorkbook(
  _prev: ImportCadastrosState,
  formData: FormData,
): Promise<ImportCadastrosState> {
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecione uma planilha XLSX para importar." };
  }

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());

    const resumo: ImportCadastroResumo[] = [];
    for (const cfg of getCadastrosOrdenados()) {
      const sheet = workbook.getWorksheet(cfg.titulo) ?? workbook.getWorksheet(cfg.titulo.slice(0, 31));
      if (!sheet) {
        resumo.push({
          aba: cfg.titulo,
          inseridos: 0,
          atualizados: 0,
          removidos: 0,
          ignorados: 0,
          erros: ["Aba não encontrada; cadastro ignorado."],
          naoRemovidosPorVinculo: [],
        });
        continue;
      }
      resumo.push(await importarCadastro(cfg, sheet));
    }

    const totalErros = resumo.reduce((acc, item) => acc + item.erros.length, 0);
    return {
      ok: totalErros === 0,
      message:
        totalErros === 0
          ? "Importação concluída."
          : "Importação concluída com avisos ou erros. Revise o relatório.",
      resumo,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível ler a planilha.",
    };
  }
}
