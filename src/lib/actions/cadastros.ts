"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClientUntyped } from "@/lib/supabase/server";
import { normalizarTexto } from "@/lib/cadastros/normalizar";

export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
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
// Normalização de texto no servidor (trim + colapsa espaços + NFC). Garante que
// espaços iniciais/finais e caixa Unicode nunca sejam persistidos a partir do
// formulário — a regra do plano é não confiar só no frontend.
const reqStr = z.preprocess(
  (v) => normalizarTexto(v == null ? null : String(v)),
  z.string().min(1, "Obrigatório"),
);
const optStr = z.preprocess(
  (v) => {
    const s = normalizarTexto(v == null ? null : String(v));
    return s === "" ? null : s;
  },
  z.string().nullable(),
);
const optDate = optStr;

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
    vida_util_anos: optNum({ min: 0 }),
    percentual_manutencao_anual: optNum({ min: 0, max: 1 }),
    manutencao_anual_fixa: optNum({ min: 0 }),
    possui: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  }),
  insumos: z
    .object({
      nome_item: optStr,
      especificacao: reqStr,
      fabricante: optStr,
      codigo_fabricante: optStr,
      codigo_interno: optStr,
      custo_total_embalagem: reqNum({ min: 0 }),
      quantidade_embalagem: reqNum({ min: 0 }),
      unidade: optStr,
      data_aquisicao: optDate,
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
      // custo unitário derivado da embalagem
      custo_unitario:
        Number(d.quantidade_embalagem) > 0
          ? Number(d.custo_total_embalagem) / Number(d.quantidade_embalagem)
          : null,
    })),
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
};

const TABELAS: Record<string, string> = {
  clientes: "clientes",
  projetos: "projetos",
  equipamentos: "equipamentos",
  insumos: "insumos",
  tecnicos: "tecnicos",
  overhead: "overhead",
  fornecedores: "fornecedores",
};

/** Páginas que derivam dados dos cadastros — revalidadas a cada alteração. */
const DEPENDENTES = [
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
  const obj = formToObject(formData);
  if (slug === "equipamentos" && !("possui" in obj)) obj.possui = "false";

  const parsed = schema.safeParse(obj);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? "");
      if (path && !errors[path]) errors[path] = issue.message;
    }
    return { ok: false, message: "Verifique os campos destacados.", errors };
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
