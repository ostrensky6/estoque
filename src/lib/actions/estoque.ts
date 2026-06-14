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
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const p = String(i.path[0] ?? "");
      if (p && !errors[p]) errors[p] = i.message;
    }
    return { ok: false, message: "Verifique os campos.", errors };
  }

  const d = parsed.data;
  const supabase = await createClient();
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
