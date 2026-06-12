"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import type { FormState } from "./cadastros";

export async function criarPlano(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim() || "Plano sem nome";
  const data_alvo = (formData.get("data_alvo") as string) || null;
  const projeto_id = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const supabase = await createClientUntyped();
  const { data, error } = await supabase
    .from("planejamento")
    .insert({ nome, data_alvo, projeto_id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/planejamento/${data.id}`);
}

export async function adicionarItem(formData: FormData) {
  const planId = Number(formData.get("planejamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const n = Number(formData.get("n_amostras"));
  if (!planId || !codigo || !(n > 0)) return;
  const controles = Number(formData.get("n_controles")) || 0;
  const repeticoes = Number(formData.get("repeticoes")) || 1;
  const perda = Number(formData.get("perda_percentual")) || 0;
  const supabase = await createClientUntyped();
  await supabase.from("planejamento_itens").insert({
    planejamento_id: planId,
    codigo_analise: codigo,
    n_amostras: n,
    n_controles: controles,
    repeticoes,
    perda_percentual: perda,
  });
  revalidatePath(`/planejamento/${planId}`);
}

export async function removerItem(formData: FormData) {
  const id = Number(formData.get("item_id"));
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  await supabase.from("planejamento_itens").delete().eq("id", id);
  revalidatePath(`/planejamento/${planId}`);
}

export async function reservarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  const demanda = await computarDemandaPlano(supabase, planId);
  if (demanda.length === 0)
    return { ok: false, message: "Adicione análises ao plano antes de reservar." };

  const itens = demanda.map((d) => ({ insumo_id: d.insumo_id, quantidade: d.demanda }));
  const { error } = await supabase.rpc("reservar_plano", {
    p_planejamento_id: planId,
    p_itens: itens,
  });
  if (error) return { ok: false, message: error.message };

  const faltas = demanda.filter((d) => d.falta > 0).length;
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/estoque");
  return {
    ok: true,
    message:
      faltas > 0
        ? `Reservado com ${faltas} insumo(s) em falta — veja a coluna Falta.`
        : "Insumos reservados.",
  };
}

export async function iniciarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  const { data, error } = await supabase.rpc("dar_baixa_plano", {
    p_planejamento_id: planId,
  });
  if (error) return { ok: false, message: error.message };

  const shortfalls = (data as { shortfalls?: unknown[] } | null)?.shortfalls ?? [];
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/estoque");
  return {
    ok: true,
    message:
      shortfalls.length > 0
        ? `Baixa concluída, mas ${shortfalls.length} insumo(s) ficaram sem estoque suficiente.`
        : "Análise iniciada — baixa definitiva concluída (FEFO).",
  };
}

export async function liberarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  const { error } = await supabase.rpc("liberar_plano", { p_planejamento_id: planId });
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/estoque");
  return { ok: true, message: "Reservas liberadas." };
}

export async function excluirPlano(formData: FormData) {
  const id = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  await supabase.from("planejamento").delete().eq("id", id);
  revalidatePath("/planejamento");
  redirect("/planejamento");
}
