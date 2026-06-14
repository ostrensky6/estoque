"use server";

import { revalidatePath } from "next/cache";
import { createClientUntyped } from "@/lib/supabase/server";
import type { FormState } from "./cadastros";

/**
 * Salva os parâmetros globais de custeio (fatores de preço, dias úteis, etc.).
 * Cada campo `valor_<chave>` do formulário atualiza a linha correspondente em
 * `parametros`. Como qualquer parâmetro muda custo e/ou preço, revalida todas
 * as telas que derivam desses números.
 */
export async function salvarParametros(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const chaves = String(formData.get("chaves") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (chaves.length === 0) return { ok: false, message: "Nada a salvar." };

  const errors: Record<string, string> = {};
  const updates: { chave: string; valor: number }[] = [];
  for (const chave of chaves) {
    const raw = formData.get(`valor_${chave}`);
    const valor = Number(raw);
    if (raw == null || raw === "" || !Number.isFinite(valor) || valor < 0) {
      errors[chave] = "Informe um número ≥ 0";
      continue;
    }
    updates.push({ chave, valor });
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Verifique os campos destacados.", errors };
  }

  const supabase = await createClientUntyped();
  for (const u of updates) {
    const { error } = await supabase
      .from("parametros")
      .update({ valor: u.valor, atualizado_em: new Date().toISOString() })
      .eq("chave", u.chave);
    if (error) return { ok: false, message: error.message };
  }

  // qualquer parâmetro afeta o custeio → revalida todo o app dependente
  for (const p of [
    "/parametros",
    "/custeio",
    "/orcamento",
    "/analises",
    "/estoque",
    "/compras",
    "/planejamento",
    "/insumos",
    "/",
  ]) {
    revalidatePath(p);
  }
  return { ok: true, message: "Parâmetros salvos. Custos e preços recalculados." };
}
