"use server";

import { revalidatePath } from "next/cache";
import { createClientUntyped } from "@/lib/supabase/server";

/** Atualiza as etiquetas de uma linha de insumo_analise (grupo + modo de cobrança). */
export async function atualizarInsumoLinha(formData: FormData) {
  const id = Number(formData.get("id"));
  const grupoRaw = (formData.get("grupo_escolha") as string | null)?.trim();
  const modoRaw = (formData.get("modo_cobranca") as string | null)?.trim();

  const grupo_escolha = grupoRaw ? grupoRaw : null;
  const modo_cobranca = modoRaw ? modoRaw : null;

  const supabase = await createClientUntyped();
  const { error } = await supabase
    .from("insumo_analise")
    .update({ grupo_escolha, modo_cobranca })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/insumos");
  revalidatePath("/custeio");
}

/**
 * Marca em lote todas as linhas de um insumo (por especificação) como um
 * grupo de escolha por_execucao — atalho para reagentes de sequenciamento.
 */
export async function marcarGrupoPorExecucao(formData: FormData) {
  const codigo_analise = formData.get("codigo_analise") as string;
  const grupo = (formData.get("grupo") as string).trim();
  const especificacoes = (formData.getAll("spec") as string[]).filter(Boolean);

  if (!grupo || especificacoes.length === 0) return;

  const supabase = await createClientUntyped();
  const { error } = await supabase
    .from("insumo_analise")
    .update({ grupo_escolha: grupo, modo_cobranca: "por_execucao" })
    .eq("codigo_analise", codigo_analise)
    .in("especificacao_insumo", especificacoes);

  if (error) throw new Error(error.message);

  revalidatePath("/insumos");
  revalidatePath("/custeio");
}
