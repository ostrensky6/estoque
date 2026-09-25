"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCadastrosOrdenados, type CadastroConfig } from "@/lib/cadastros/config";
import {
  QUANTIDADE_INSUMO_KEY,
  QUANTIDADE_INSUMO_LABEL,
  aplicarPadroesCadastro,
  diferencas,
  erroLinha,
  hashConteudo,
  lerAbaCadastro,
  normalizarChave,
  operacaoIdDeterministico,
  payloadRpcInsumo,
  registroAtualizado,
  registroNovo,
  rotuloCampo,
  valoresEquivalentes,
} from "@/lib/cadastros/importacao";
import { projetarQuantidadeInsumos, type LoteInsumo } from "@/lib/cadastros/insumos";
import { opcoesParaCampos } from "@/lib/cadastros/xlsx";
import { lerLinhasCadastro, prepararSalarioTecnico } from "@/lib/cadastros/salario";
import { podeVerSalario } from "@/lib/auth/permissao-efetiva";
import { createClientUntyped } from "@/lib/supabase/server";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  createdId?: number;
};

export type ImportCadastroResumo = {
  aba: string;
  inseridos: number;
  atualizados: number;
  /** linhas que batem com um registro existente sem nenhuma diferença */
  inalterados: number;
  /** linhas não importadas por erro */
  ignorados: number;
  erros: string[];
  avisos: string[];
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
const quantidadeInsumoSchema = z.preprocess(
  (v) => (v === "" || v == null ? 0 : Number(v)),
  z
    .number({ error: "Número inválido" })
    .refine((n) => !Number.isNaN(n), "Número inválido")
    .refine((n) => Number.isInteger(n), "Use um número inteiro de embalagens")
    .refine((n) => n >= 0, "Mínimo 0"),
);
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

const tecnicosSchema = z.object({
  nome: reqStr,
  processo: optStr,
  valor_mes: reqNum({ min: 0 }),
  horas_mes_base: reqNum({ min: 1 }),
  percentual_dedicado: reqNum({ min: 0, max: 100 }),
});
/** Sem permissão (ou valor "XXX"): o salário não é validado nem gravado. */
const tecnicosSemSalarioSchema = tecnicosSchema.omit({ valor_mes: true });

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
  tecnicos: tecnicosSchema,
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

/**
 * Técnicos: aplica a regra do salário (ver prepararSalarioTecnico) e escolhe o
 * schema. Os demais cadastros passam direto.
 */
function schemaEObjeto(
  slug: string,
  obj: Record<string, unknown>,
  opcoes: { podeVerSalario: boolean; contexto: "formulario" | "importacao" },
): { schema: z.ZodType<Record<string, unknown>> | undefined; obj: Record<string, unknown> } {
  if (slug !== "tecnicos") return { schema: SCHEMAS[slug], obj };
  const preparado = prepararSalarioTecnico(obj, {
    podeVer: opcoes.podeVerSalario,
    contexto: opcoes.contexto,
  });
  return {
    schema: preparado.semSalario ? tecnicosSemSalarioSchema : tecnicosSchema,
    obj: preparado.obj,
  };
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

  const tabela = TABELAS[slug];
  if (!SCHEMAS[slug] || !tabela) return { ok: false, message: "Cadastro inválido." };

  // checkbox ausente não vem no FormData
  const { schema, obj } = schemaEObjeto(slug, aplicarPadroesCadastro(slug, formToObject(formData)), {
    podeVerSalario: slug === "tecnicos" ? await podeVerSalario() : false,
    contexto: "formulario",
  });
  if (!schema) return { ok: false, message: "Cadastro inválido." };

  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos destacados.", errors: errosZod(parsed.error) };
  }

  const supabase = await createClientUntyped();
  const payload = parsed.data;

  if (id) {
    const { error } = await supabase.from(tabela).update(payload).eq("id", id);
    if (error) return { ok: false, message: error.message };

    revalidarDependentes(slug);
    return { ok: true, message: "Atualizado." };
  }

  // Insumos: a quantidade (embalagens fechadas) é informada no próprio
  // cadastro e entra direto (sem quarentena), atômico com a criação do
  // insumo — ver public.criar_insumo_com_quantidade.
  if (slug === "insumos") {
    const quantidadeParsed = quantidadeInsumoSchema.safeParse(formData.get("quantidade"));
    if (!quantidadeParsed.success) {
      return {
        ok: false,
        message: "Verifique os campos destacados.",
        errors: { quantidade: quantidadeParsed.error.issues[0]?.message ?? "Inválido" },
      };
    }
    const operacaoId = String(formData.get("_operacao_id") ?? "").trim() || crypto.randomUUID();
    // A RPC recusa chaves fora da lista de 0109 (ex.: custo_unitario, que ela
    // mesma deriva da embalagem): envia só os campos aceitos.
    const { data, error } = await supabase.rpc("criar_insumo_com_quantidade", {
      p_dados_insumo: payloadRpcInsumo(payload),
      p_quantidade_embalagens: quantidadeParsed.data,
      p_operacao_id: operacaoId,
    });
    if (error) return { ok: false, message: error.message };

    const createdId = (data as { insumo_id?: number } | null)?.insumo_id;
    if (typeof createdId !== "number" || !Number.isSafeInteger(createdId) || createdId <= 0) {
      return {
        ok: false,
        message: "Não foi possível confirmar o identificador do registro criado.",
      };
    }

    revalidarDependentes(slug);
    return { ok: true, message: "Criado.", createdId };
  }

  const { data, error } = await supabase.from(tabela).insert(payload).select("id").single();
  if (error) return { ok: false, message: error.message };

  const createdId = data?.id;
  if (typeof createdId !== "number" || !Number.isSafeInteger(createdId) || createdId <= 0) {
    return {
      ok: false,
      message: "Não foi possível confirmar o identificador do registro criado.",
    };
  }

  revalidarDependentes(slug);
  return { ok: true, message: "Criado.", createdId };
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

// ---- importação XLSX ("só adicionar e atualizar") ----

function mapaNatural(existingRows: Record<string, unknown>[], rotulo: string) {
  const map = new Map<string, Record<string, unknown> | null>();
  for (const row of existingRows) {
    const key = normalizarChave(row[rotulo]);
    if (!key) continue;
    map.set(key, map.has(key) ? null : row);
  }
  return map;
}

function errosDaLinha(cfg: CadastroConfig, excelRow: number, error: z.ZodError) {
  const erros = Object.entries(errosZod(error)).map(([campo, mensagem]) =>
    erroLinha(excelRow, rotuloCampo(cfg, campo), mensagem),
  );
  return erros.length ? erros : [`Linha ${excelRow}: dados inválidos.`];
}

function localizarAba(workbook: ExcelJS.Workbook, cfg: CadastroConfig) {
  const nomes = new Set([normalizarChave(cfg.titulo), normalizarChave(cfg.titulo.slice(0, 31))]);
  return workbook.worksheets.find((sheet) => nomes.has(normalizarChave(sheet.name)));
}

async function quantidadesAtuaisInsumos(
  supabase: Awaited<ReturnType<typeof createClientUntyped>>,
  existingRows: Record<string, unknown>[],
) {
  const { data: lotes, error } = await supabase
    .from("lotes_estoque")
    .select("insumo_id, status, quantidade_atual, validade, validade_apos_abertura, data_abertura");
  if (error) return null;
  return new Map(
    projetarQuantidadeInsumos(
      existingRows.map((row) => ({ id: row.id })),
      (lotes ?? []) as LoteInsumo[],
    ).map((row) => [String(row.id), Number(row.quantidade ?? 0)]),
  );
}

async function importarCadastro(
  cfg: CadastroConfig,
  sheet: ExcelJS.Worksheet,
  arquivoHash: string,
): Promise<ImportCadastroResumo> {
  const resumo: ImportCadastroResumo = {
    aba: cfg.titulo,
    inseridos: 0,
    atualizados: 0,
    inalterados: 0,
    ignorados: 0,
    erros: [],
    avisos: [],
  };
  const tabela = TABELAS[cfg.slug];
  if (!SCHEMAS[cfg.slug] || !tabela) {
    resumo.erros.push("Cadastro sem schema/tabela configurado.");
    return resumo;
  }

  const supabase = await createClientUntyped();
  const podeVerSalarioTecnicos = cfg.slug === "tecnicos" ? await podeVerSalario() : false;
  const { data: existing, error: selectError } = await lerLinhasCadastro(supabase, tabela, {
    podeVerSalario: podeVerSalarioTecnicos,
  });
  if (selectError) {
    resumo.erros.push(selectError.message);
    return resumo;
  }

  const existingRows = (existing ?? []) as Record<string, unknown>[];
  const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
  const existingByNatural = mapaNatural(existingRows, cfg.rotulo);
  const opcoes = await opcoesParaCampos(cfg.campos);
  const { linhas, colunas } = lerAbaCadastro(sheet, cfg, opcoes);
  const rotuloNatural = rotuloCampo(cfg, cfg.rotulo);
  const quantidadeAtual =
    cfg.slug === "insumos" && colunas.has(QUANTIDADE_INSUMO_KEY) && existingRows.length > 0
      ? await quantidadesAtuaisInsumos(supabase, existingRows)
      : null;

  const naturaisImportados = new Set<string>();
  const idsTocados = new Set<number>();
  let houveMudanca = false;
  const falhar = (mensagens: string[]) => {
    resumo.ignorados += 1;
    resumo.erros.push(...mensagens);
  };

  // Técnicos: "XXX"/em branco no salário = manter o atual; sem permissão o
  // salário da planilha é sempre ignorado (o banco rejeitaria a alteração).
  const validar = (registro: Record<string, unknown>) => {
    const { schema, obj } = schemaEObjeto(cfg.slug, registro, {
      podeVerSalario: podeVerSalarioTecnicos,
      contexto: "importacao",
    });
    return schema!.safeParse(obj);
  };

  for (const linha of linhas) {
    if (linha.erros.length > 0) {
      falhar(linha.erros);
      continue;
    }

    const naturalKey = normalizarChave(linha.valores[cfg.rotulo]);
    let alvo: Record<string, unknown> | null = null;
    if (linha.id != null && existingById.has(linha.id)) {
      alvo = existingById.get(linha.id) ?? null;
    } else if (naturalKey && existingByNatural.has(naturalKey)) {
      alvo = existingByNatural.get(naturalKey) ?? null;
      if (!alvo) {
        falhar([
          `Linha ${linha.excelRow}: ${rotuloNatural} "${String(linha.valores[cfg.rotulo])}" aparece mais de uma vez em ${cfg.titulo}; informe o ID para atualizar com segurança.`,
        ]);
        continue;
      }
    }

    if (alvo) {
      const alvoId = Number(alvo.id);
      if (idsTocados.has(alvoId)) {
        falhar([`Linha ${linha.excelRow}: o registro ID ${alvoId} já foi atualizado por outra linha da planilha.`]);
        continue;
      }
      const parsed = validar(registroAtualizado(cfg, alvo, linha.valores));
      if (!parsed.success) {
        falhar(errosDaLinha(cfg, linha.excelRow, parsed.error));
        continue;
      }
      idsTocados.add(alvoId);
      if (naturalKey) naturaisImportados.add(naturalKey);

      if (quantidadeAtual && linha.quantidade != null) {
        const atual = quantidadeAtual.get(String(alvoId)) ?? 0;
        if (!valoresEquivalentes(linha.quantidade, atual)) {
          resumo.avisos.push(
            `Linha ${linha.excelRow}: ${QUANTIDADE_INSUMO_LABEL} ignorada para item existente (atual ${atual}, planilha ${linha.quantidade}). Registre entradas e baixas em Estoque.`,
          );
        }
      }

      const payload = diferencas(parsed.data, alvo);
      if (Object.keys(payload).length === 0) {
        resumo.inalterados += 1;
        continue;
      }
      const { error } = await supabase.from(tabela).update(payload).eq("id", alvoId);
      if (error) {
        falhar([`Linha ${linha.excelRow}: ${error.message}`]);
        continue;
      }
      resumo.atualizados += 1;
      houveMudanca = true;
      continue;
    }

    if (naturalKey && naturaisImportados.has(naturalKey)) {
      falhar([`Linha ${linha.excelRow}: ${rotuloNatural} repetido na planilha.`]);
      continue;
    }
    const parsed = validar(registroNovo(cfg, linha.valores));
    if (!parsed.success) {
      falhar(errosDaLinha(cfg, linha.excelRow, parsed.error));
      continue;
    }

    if (cfg.slug === "insumos") {
      // Mesmo caminho do formulário: criação atômica com a quantidade inicial
      // (embalagens fechadas). operacao_id determinístico por arquivo+linha
      // torna o reenvio do mesmo arquivo idempotente (sem estoque duplicado).
      const quantidade = quantidadeInsumoSchema.safeParse(linha.quantidade ?? 0);
      if (!quantidade.success) {
        falhar([
          erroLinha(
            linha.excelRow,
            QUANTIDADE_INSUMO_LABEL,
            quantidade.error.issues[0]?.message ?? "inválida",
          ),
        ]);
        continue;
      }
      const { data, error } = await supabase.rpc("criar_insumo_com_quantidade", {
        p_dados_insumo: payloadRpcInsumo(parsed.data),
        p_quantidade_embalagens: quantidade.data,
        p_operacao_id: operacaoIdDeterministico(arquivoHash, cfg.slug, linha.excelRow),
      });
      if (error) {
        falhar([`Linha ${linha.excelRow}: ${error.message}`]);
        continue;
      }
      if (naturalKey) naturaisImportados.add(naturalKey);
      if ((data as { repetido?: boolean } | null)?.repetido) {
        resumo.inalterados += 1;
        resumo.avisos.push(
          `Linha ${linha.excelRow}: já importada antes com este mesmo arquivo; nada foi criado de novo.`,
        );
        continue;
      }
      resumo.inseridos += 1;
      houveMudanca = true;
      continue;
    }

    const { error } = await supabase.from(tabela).insert(parsed.data);
    if (error) {
      falhar([`Linha ${linha.excelRow}: ${error.message}`]);
      continue;
    }
    if (naturalKey) naturaisImportados.add(naturalKey);
    resumo.inseridos += 1;
    houveMudanca = true;
  }

  if (houveMudanca) revalidarDependentes(cfg.slug);
  return resumo;
}

/**
 * Importa a planilha de cadastros. Só adiciona e atualiza: nunca exclui
 * registros; em registros existentes, células vazias e colunas ausentes
 * mantêm o valor atual. Abas ausentes são ignoradas.
 */
export async function importarCadastrosWorkbook(
  _prev: ImportCadastrosState,
  formData: FormData,
): Promise<ImportCadastrosState> {
  const file = formData.get("arquivo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecione uma planilha XLSX para importar." };
  }

  try {
    const conteudo = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(conteudo);
    const arquivoHash = hashConteudo(conteudo);

    const resumo: ImportCadastroResumo[] = [];
    for (const cfg of getCadastrosOrdenados()) {
      const sheet = localizarAba(workbook, cfg);
      if (!sheet) continue;
      resumo.push(await importarCadastro(cfg, sheet, arquivoHash));
    }

    if (resumo.length === 0) {
      return {
        ok: false,
        message:
          'Nenhuma aba de cadastro encontrada. Use os nomes de aba da planilha modelo (Baixar XLSX), por exemplo "Insumos".',
      };
    }

    const soma = (campo: "inseridos" | "atualizados" | "inalterados" | "ignorados") =>
      resumo.reduce((acc, item) => acc + item[campo], 0);
    const totalErros = resumo.reduce((acc, item) => acc + item.erros.length, 0);
    const partes = [
      `${soma("inseridos")} inserido(s)`,
      `${soma("atualizados")} atualizado(s)`,
      `${soma("inalterados")} sem alteração`,
    ];
    if (soma("ignorados") > 0) partes.push(`${soma("ignorados")} linha(s) com erro não importada(s)`);

    return {
      ok: totalErros === 0,
      message: `${totalErros === 0 ? "Importação concluída" : "Importação concluída com erros"}: ${partes.join(", ")}. Nada foi excluído; células vazias mantêm o valor atual.`,
      resumo,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Não foi possível ler a planilha.",
    };
  }
}

