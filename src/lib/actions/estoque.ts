"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "./cadastros";

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
  return rpcLote("aceitar_lote", {
    p_lote_id: Number(formData.get("lote_id")),
    p_responsavel: (formData.get("responsavel") as string) || null,
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
