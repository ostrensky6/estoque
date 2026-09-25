"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./cadastros";
import { usuarioAtual } from "@/lib/auth/roles";

const schema = z.object({
  insumo_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  quantidade: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: "Obrigatório" }).positive("Deve ser > 0"),
  ),
  validade: z.preprocess(
    (v) => (v === "" || v == null ? null : String(v)),
    z.string().nullable(),
  ),
  custo: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().min(0).nullable(),
  ),
  codigo: z.preprocess((v) => (v === "" || v == null ? null : String(v)), z.string().nullable()),
  fornecedor: z.preprocess((v) => (v === "" || v == null ? null : String(v)), z.string().nullable()),
  motivo: z.preprocess((v) => (v === "" || v == null ? null : String(v)), z.string().nullable()),
});

const baixaManualSchema = z.object({
  lote_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  quantidade: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: "Obrigatório" }).positive("Deve ser > 0"),
  ),
  motivo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim()),
    z.string({ error: "Obrigatório" }).min(3, "Informe o motivo"),
  ),
});

const corrigirQuantidadeSchema = z.object({
  insumo_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  quantidade_alvo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number({ error: "Obrigatório" })
      .refine((n) => Number.isInteger(n), "Use um número inteiro de embalagens")
      .refine((n) => n >= 0, "Deve ser >= 0"),
  ),
  motivo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim()),
    z.string({ error: "Obrigatório" }).min(3, "Informe o motivo"),
  ),
  operacao_id: z.preprocess(
    (v) => (v ? String(v) : crypto.randomUUID()),
    z.string().min(1),
  ),
});

const ajusteSaldoSchema = z.object({
  lote_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  quantidade_nova: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number({ error: "Obrigatório" }).min(0, "Deve ser >= 0"),
  ),
  motivo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim()),
    z.string({ error: "Obrigatório" }).min(3, "Informe o motivo"),
  ),
});

const estornoSchema = z.object({
  lote_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  motivo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim()),
    z.string({ error: "Obrigatório" }).min(3, "Informe o motivo"),
  ),
});

function formErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const i of error.issues) {
    const p = String(i.path[0] ?? "");
    if (p && !errors[p]) errors[p] = i.message;
  }
  return errors;
}

/**
 * 2.4 — Entrada de inventário / ajuste (porta avulsa, EXPLÍCITA). O recebimento
 * "normal" de compra acontece pelo item do pedido (receberItemPedido). Aqui é a
 * entrada sem pedido (contagem, doação, correção), com motivo próprio na trilha.
 */
export async function entradaInventario(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    insumo_id: formData.get("insumo_id"),
    quantidade: formData.get("quantidade"),
    validade: formData.get("validade"),
    custo: formData.get("custo"),
    codigo: formData.get("codigo"),
    fornecedor: formData.get("fornecedor"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const { data: insumo } = await supabase
    .from("insumos")
    .select("categoria_compra")
    .eq("id", d.insumo_id)
    .single();
  if (insumo?.categoria_compra === "critico" && !d.validade) {
    return {
      ok: false,
      message: "Validade é obrigatória para insumo crítico.",
      errors: { validade: "Obrigatório para crítico" },
    };
  }
  const { error } = await supabase.rpc("entrada_inventario", {
    p_insumo_id: d.insumo_id,
    p_quantidade: d.quantidade,
    p_validade: d.validade ?? undefined,
    p_custo: d.custo ?? undefined,
    p_codigo: d.codigo ?? undefined,
    p_fornecedor: d.fornecedor ?? undefined,
    p_motivo: d.motivo ?? undefined,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/estoque");
  return { ok: true, message: "Entrada de inventário registrada (lote em quarentena)." };
}

async function rpcLote(
  fn: string,
  args: Record<string, unknown>,
): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as never, args as never);
  if (error) return { ok: false, message: error.message };
  revalidatePath("/estoque");
  return { ok: true };
}

export async function aceitarLote(formData: FormData): Promise<FormState> {
  const u = await usuarioAtual();
  return rpcLote("aceitar_lote", {
    p_lote_id: Number(formData.get("lote_id")),
    p_responsavel: (formData.get("responsavel") as string) || u?.nome || u?.email || null,
    p_criterio: (formData.get("criterio") as string) || null,
  });
}

export async function bloquearLote(formData: FormData): Promise<FormState> {
  return rpcLote("bloquear_lote", {
    p_lote_id: Number(formData.get("lote_id")),
    p_motivo: (formData.get("motivo") as string) || "—",
  });
}

export async function desbloquearLote(formData: FormData): Promise<FormState> {
  return rpcLote("desbloquear_lote", { p_lote_id: Number(formData.get("lote_id")) });
}

export async function descartarLote(formData: FormData): Promise<FormState> {
  return rpcLote("descartar_lote", {
    p_lote_id: Number(formData.get("lote_id")),
    p_justificativa: (formData.get("justificativa") as string) || "—",
  });
}

export async function estornarRecebimentoLote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = estornoSchema.safeParse({
    lote_id: formData.get("lote_id"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const supabase = await createClient();
  const [recebimentoCompra, recebimentoInterno] = await Promise.all([
    supabase
      .from("pedidos_compra_item_recebimentos")
      .select("id")
      .eq("lote_id", parsed.data.lote_id)
      .limit(1),
    supabase
      .from("pedidos_internos_item_recebimentos")
      .select("id")
      .eq("lote_id", parsed.data.lote_id)
      .limit(1),
  ]);
  if (recebimentoCompra.error || recebimentoInterno.error) {
    return {
      ok: false,
      message: "Não foi possível confirmar a origem da entrada. Tente novamente.",
    };
  }
  if ((recebimentoCompra.data?.length ?? 0) > 0 || (recebimentoInterno.data?.length ?? 0) > 0) {
    return {
      ok: false,
      message: "Este lote pertence a um recebimento vinculado. Faça o estorno pelo fluxo de Recebimento para reconciliar pedidos e histórico.",
    };
  }

  const { error } = await supabase.rpc("estornar_recebimento_lote" as never, {
    p_lote_id: parsed.data.lote_id,
    p_motivo: parsed.data.motivo,
  } as never);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/estoque");
  revalidatePath(`/estoque/lotes/${parsed.data.lote_id}`);
  return { ok: true, message: "Entrada estornada." };
}

export async function baixarManualLote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = baixaManualSchema.safeParse({
    lote_id: formData.get("lote_id"),
    quantidade: formData.get("quantidade"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("baixa_manual_lote" as never, {
    p_lote_id: parsed.data.lote_id,
    p_quantidade: parsed.data.quantidade,
    p_motivo: parsed.data.motivo,
  } as never);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/estoque");
  revalidatePath(`/estoque/lotes/${parsed.data.lote_id}`);
  return { ok: true, message: "Baixa manual registrada." };
}

/**
 * Correção autorizada e auditável da quantidade (embalagens fechadas) de um
 * insumo no fluxo novo — usada na edição do cadastro. Nunca sobrescreve o
 * saldo diretamente: aumento cria um lote de ajuste, redução baixa dos lotes
 * existentes; ambos com motivo obrigatório e trilha em eventos_status.
 */
export async function corrigirQuantidadeEmbalagens(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = corrigirQuantidadeSchema.safeParse({
    insumo_id: formData.get("insumo_id"),
    quantidade_alvo: formData.get("quantidade_alvo"),
    motivo: formData.get("motivo"),
    operacao_id: formData.get("operacao_id"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("corrigir_quantidade_embalagens_fechadas" as never, {
    p_insumo_id: parsed.data.insumo_id,
    p_quantidade_alvo: parsed.data.quantidade_alvo,
    p_operacao_id: parsed.data.operacao_id,
    p_motivo: parsed.data.motivo,
  } as never);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/estoque");
  revalidatePath("/cadastros/insumos");
  return { ok: true, message: "Quantidade corrigida." };
}

export async function ajustarSaldoLote(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = ajusteSaldoSchema.safeParse({
    lote_id: formData.get("lote_id"),
    quantidade_nova: formData.get("quantidade_nova"),
    motivo: formData.get("motivo"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("ajustar_saldo_lote" as never, {
    p_lote_id: parsed.data.lote_id,
    p_quantidade_nova: parsed.data.quantidade_nova,
    p_motivo: parsed.data.motivo,
  } as never);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/estoque");
  revalidatePath(`/estoque/lotes/${parsed.data.lote_id}`);
  return { ok: true, message: "Saldo do lote ajustado." };
}

const CATEGORIAS_SAIDA = ["consumo_avulso", "perda", "quebra", "vencido", "descarte", "outro"] as const;

const saidaAvulsaSchema = z
  .object({
    insumo_id: z.preprocess((v) => Number(v), z.number().int().positive()),
    quantidade: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))),
      z.number({ error: "Obrigatório" }).positive("Deve ser maior que zero"),
    ),
    categoria: z.enum(CATEGORIAS_SAIDA, { error: "Escolha o motivo" }),
    observacao: z.preprocess(
      (v) => (v === "" || v == null ? null : String(v).trim()),
      z.string().max(300, "Máximo de 300 caracteres").nullable(),
    ),
    lote_id: z.preprocess(
      (v) => (v === "" || v == null ? null : Number(v)),
      z.number().int().positive().nullable(),
    ),
    operacao_id: z.string().uuid("Operação inválida; recarregue a página."),
  })
  .refine((d) => d.categoria !== "outro" || Boolean(d.observacao), {
    path: ["observacao"],
    message: "Descreva o motivo",
  });

/**
 * Saída avulsa de insumo (perda, quebra, vencido, descarte ou consumo fora de
 * plano). A RPC escolhe os lotes por FEFO quando nenhum lote é indicado e
 * nunca consome quantidade reservada para planos.
 */
export async function registrarSaidaAvulsa(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = saidaAvulsaSchema.safeParse({
    insumo_id: formData.get("insumo_id"),
    quantidade: formData.get("quantidade"),
    categoria: formData.get("categoria"),
    observacao: formData.get("observacao"),
    lote_id: formData.get("lote_id"),
    operacao_id: formData.get("operacao_id"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_saida_avulsa" as never, {
    p_insumo_id: parsed.data.insumo_id,
    p_quantidade: parsed.data.quantidade,
    p_categoria: parsed.data.categoria,
    p_observacao: parsed.data.observacao,
    p_lote_id: parsed.data.lote_id,
    p_operacao_id: parsed.data.operacao_id,
  } as never);
  if (error) {
    const semFuncao = /registrar_saida_avulsa/.test(error.message) && /function|schema cache/i.test(error.message);
    return {
      ok: false,
      message: semFuncao
        ? "A saída avulsa ainda não está disponível no banco (migration 0111 pendente)."
        : error.message,
    };
  }

  for (const path of ["/estoque", "/estoque/controle", "/suprimentos", "/cadastros/insumos", "/insumos"]) {
    revalidatePath(path);
  }
  if (parsed.data.lote_id) revalidatePath(`/estoque/lotes/${parsed.data.lote_id}`);
  return { ok: true, message: "Saída registrada." };
}

const entradaEmbalagensSchema = z.object({
  insumo_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  quantidade: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number({ error: "Obrigatório" })
      .refine((n) => Number.isInteger(n), "Use um número inteiro de embalagens")
      .refine((n) => n > 0, "Deve ser maior que zero"),
  ),
  validade: z.preprocess((v) => (v === "" || v == null ? null : String(v)), z.string().nullable()),
  custo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))),
    z.number({ error: "Obrigatório" }).min(0, "Deve ser ≥ 0"),
  ),
  codigo: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().max(80).nullable()),
  fornecedor: z.preprocess((v) => (v === "" || v == null ? null : String(v).trim()), z.string().nullable()),
  motivo: z.preprocess(
    (v) => (v === "" || v == null ? undefined : String(v).trim()),
    z.string({ error: "Obrigatório" }).min(3, "Informe o motivo"),
  ),
  operacao_id: z.string().uuid("Operação inválida; recarregue a página."),
});

/**
 * Entrada de um novo lote para insumo contado em embalagens fechadas
 * (registrar_entrada_manual_embalagens, 0109). Mantém o mesmo modelo de
 * contagem do insumo: o lote entra liberado e com número inteiro.
 */
export async function entradaEmbalagens(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = entradaEmbalagensSchema.safeParse({
    insumo_id: formData.get("insumo_id"),
    quantidade: formData.get("quantidade"),
    validade: formData.get("validade"),
    custo: formData.get("custo"),
    codigo: formData.get("codigo"),
    fornecedor: formData.get("fornecedor"),
    motivo: formData.get("motivo"),
    operacao_id: formData.get("operacao_id"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Verifique os campos.", errors: formErrors(parsed.error) };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("registrar_entrada_manual_embalagens" as never, {
    p_insumo_id: d.insumo_id,
    p_quantidade_embalagens: d.quantidade,
    p_operacao_id: d.operacao_id,
    p_validade: d.validade,
    p_custo_total_embalagem: d.custo,
    p_codigo_lote: d.codigo,
    p_fornecedor: d.fornecedor,
    p_motivo: d.motivo,
  } as never);
  if (error) return { ok: false, message: error.message };

  for (const path of ["/estoque", "/estoque/controle", "/suprimentos", "/cadastros/insumos", "/insumos"]) {
    revalidatePath(path);
  }
  return { ok: true, message: "Lote registrado e liberado para uso." };
}
