"use server";

import { revalidatePath } from "next/cache";
import { createClientUntyped } from "@/lib/supabase/server";
import type { FormState } from "./cadastros";

/** Chaves editáveis na tela de Parâmetros (constantes globais de custeio/preço). */
const CHAVES = [
  "margem_lucro",
  "impostos",
  "taxas",
  "fundo_reserva",
  "fundo_investimento",
  "dias_uteis_ano",
  "horas_mes_tecnico",
  "horas_bancada_mes",
] as const;

/**
 * Salva os parâmetros globais e revalida tudo que depende do custeio.
 * Os 5 fatores de preço transformam custo total em preço de venda
 * (preço = custo × (1 + Σfatores/100)); por isso mexer aqui recalcula
 * custeio, orçamentos, análises e estoque.
 */
export async function salvarParametros(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClientUntyped();

  const updates: { chave: string; valor: number }[] = [];
  for (const chave of CHAVES) {
    const raw = formData.get(chave);
    if (raw == null || raw === "") continue;
    const valor = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(valor) || valor < 0) {
      return { ok: false, message: `Valor inválido para "${chave}".` };
    }
    updates.push({ chave, valor });
  }

  for (const u of updates) {
    const { error } = await supabase
      .from("parametros")
      .update({ valor: u.valor, atualizado_em: new Date().toISOString() })
      .eq("chave", u.chave);
    if (error) return { ok: false, message: error.message };
  }

  for (const p of [
    "/parametros",
    "/custeio",
    "/orcamento",
    "/analises",
    "/estoque",
    "/cadastros",
    "/",
  ]) {
    revalidatePath(p);
  }

  return { ok: true, message: "Parâmetros salvos — custeio e preços recalculados." };
}
