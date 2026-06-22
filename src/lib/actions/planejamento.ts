"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import { assegurarAnalisesLiberadas } from "@/lib/cadastros/guard-custeio";
import type { FormState } from "./cadastros";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DemandaInsumo = Awaited<ReturnType<typeof computarDemandaPlano>>[number];
type Shortfall = { insumo_id: number; falta: number };

function parseShortfalls(value: unknown): Shortfall[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const insumoId = Number(row.insumo_id);
      const falta = Number(row.falta);
      return insumoId > 0 && falta > 0 ? { insumo_id: insumoId, falta } : null;
    })
    .filter((item): item is Shortfall => item !== null);
}

async function notificarFaltasPlano(
  supabase: SupabaseClient,
  planId: number,
  faltas: Array<DemandaInsumo & { falta: number }>,
  origem: "reserva" | "baixa",
) {
  if (faltas.length === 0) return;

  const titulo =
    origem === "reserva" ? "Falta de estoque no planejamento" : "Baixa com falta de estoque";
  const rows = faltas.map((item) => ({
    tipo: "falta_plano",
    titulo,
    corpo: `${item.especificacao}: falta ${item.falta} ${item.unidade ?? ""} no planejamento #${planId}.`,
    entidade_tipo: "planejamento",
    entidade_id: planId,
    papel_destino: "coordenador",
    dedupe_key: `falta_plano:${origem}:${planId}:${item.insumo_id}`,
  }));
  const keys = rows.map((row) => row.dedupe_key);
  const { data: existentes } = await supabase
    .from("notificacoes")
    .select("dedupe_key")
    .in("dedupe_key", keys);
  const keysExistentes = new Set((existentes ?? []).map((row) => row.dedupe_key));
  const novas = rows.filter((row) => !keysExistentes.has(row.dedupe_key));

  if (novas.length === 0) return;
  const { error } = await supabase.from("notificacoes").insert(novas as never);
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function criarPlano(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim() || "Plano sem nome";
  const data_alvo = (formData.get("data_alvo") as string) || null;
  const projeto_id = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planejamento")
    .insert({ nome, data_alvo, projeto_id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/planejamento/${data.id}`);
}

/**
 * 2.2 — Orçamento (de análises) aprovado → gera um planejamento já vinculado
 * ao mesmo projeto, com as análises/amostras do orçamento. Um clique.
 */
export async function gerarPlanejamentoDeOrcamento(formData: FormData) {
  const orcamentoId = Number(formData.get("orcamento_id"));
  if (!orcamentoId) return;
  const supabase = await createClient();

  const { data: orc, error: orcErr } = await supabase
    .from("orcamentos")
    .select("id, cliente_nome, projeto_id, orcamento_itens(codigo_analise, n_amostras)")
    .eq("id", orcamentoId)
    .single();
  if (orcErr) throw new Error(orcErr.message);

  const itens = orc.orcamento_itens ?? [];
  if (itens.length === 0)
    throw new Error("O orçamento não tem análises para gerar um planejamento.");

  // Não gera planejamento a partir de análises bloqueadas (custo zero silencioso).
  await assegurarAnalisesLiberadas(itens.map((it) => it.codigo_analise));

  const { data: plano, error: planoErr } = await supabase
    .from("planejamento")
    .insert({
      nome: `Orçamento ${orc.id} — ${orc.cliente_nome ?? "sem cliente"}`,
      projeto_id: orc.projeto_id,
    })
    .select("id")
    .single();
  if (planoErr) throw new Error(planoErr.message);

  const { error: itensErr } = await supabase.from("planejamento_itens").insert(
    itens.map((it) => ({
      planejamento_id: plano.id,
      codigo_analise: it.codigo_analise,
      n_amostras: Number(it.n_amostras),
    })),
  );
  if (itensErr) throw new Error(itensErr.message);

  revalidatePath("/planejamento");
  redirect(`/planejamento/${plano.id}`);
}

/**
 * 2.2 — Variante para orçamento de projeto (rubricas + análises). Usa as
 * análises do orçamento de projeto para semear o planejamento.
 */
export async function gerarPlanejamentoDeOrcamentoProjeto(formData: FormData) {
  const orcamentoProjetoId = Number(formData.get("orcamento_projeto_id"));
  if (!orcamentoProjetoId) return;
  const supabase = await createClient();

  const { data: orc, error: orcErr } = await supabase
    .from("orcamento_projetos")
    .select("id, titulo, projeto_id, orcamento_projeto_analises(codigo_analise, n_amostras)")
    .eq("id", orcamentoProjetoId)
    .single();
  if (orcErr) throw new Error(orcErr.message);

  const itens = orc.orcamento_projeto_analises ?? [];
  if (itens.length === 0)
    throw new Error("O orçamento de projeto não tem análises para gerar um planejamento.");

  // Não gera planejamento a partir de análises bloqueadas (custo zero silencioso).
  await assegurarAnalisesLiberadas(itens.map((it) => it.codigo_analise));

  const { data: plano, error: planoErr } = await supabase
    .from("planejamento")
    .insert({
      nome: `Projeto: ${orc.titulo ?? `Orçamento ${orc.id}`}`,
      projeto_id: orc.projeto_id,
    })
    .select("id")
    .single();
  if (planoErr) throw new Error(planoErr.message);

  const { error: itensErr } = await supabase.from("planejamento_itens").insert(
    itens.map((it) => ({
      planejamento_id: plano.id,
      codigo_analise: it.codigo_analise,
      n_amostras: Number(it.n_amostras),
    })),
  );
  if (itensErr) throw new Error(itensErr.message);

  revalidatePath("/planejamento");
  redirect(`/planejamento/${plano.id}`);
}

export async function adicionarItem(formData: FormData) {
  const planId = Number(formData.get("planejamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const n = Number(formData.get("n_amostras"));
  if (!planId || !codigo || !(n > 0)) return;
  const controles = Number(formData.get("n_controles")) || 0;
  const repeticoes = Number(formData.get("repeticoes")) || 1;
  const perda = Number(formData.get("perda_percentual")) || 0;
  const supabase = await createClient();
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
  const supabase = await createClient();
  await supabase.from("planejamento_itens").delete().eq("id", id);
  revalidatePath(`/planejamento/${planId}`);
}

export async function reservarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClient();
  const demanda = await computarDemandaPlano(supabase, planId);
  if (demanda.length === 0)
    return { ok: false, message: "Adicione análises ao plano antes de reservar." };

  const itens = demanda.map((d) => ({ insumo_id: d.insumo_id, quantidade: d.demanda }));
  const { error } = await supabase.rpc("reservar_plano", {
    p_planejamento_id: planId,
    p_itens: itens,
  });
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("marcar_planejamento_reservado" as never, {
    p_planejamento_id: planId,
  } as never);

  const faltasPlano = demanda.filter((d) => d.falta > 0);
  await notificarFaltasPlano(supabase, planId, faltasPlano, "reserva");
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/notificacoes");
  revalidatePath("/");
  revalidatePath("/estoque");
  return {
    ok: true,
    message:
      faltasPlano.length > 0
        ? `Reservado com ${faltasPlano.length} insumo(s) em falta — veja a coluna Falta.`
        : "Insumos reservados.",
  };
}

export async function iniciarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClient();
  const demanda = await computarDemandaPlano(supabase, planId);
  const { data, error } = await supabase.rpc("dar_baixa_plano", {
    p_planejamento_id: planId,
  });
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("marcar_planejamento_em_execucao" as never, {
    p_planejamento_id: planId,
  } as never);

  const shortfalls = parseShortfalls((data as { shortfalls?: unknown } | null)?.shortfalls);
  const faltaPorInsumo = new Map(shortfalls.map((item) => [item.insumo_id, item.falta]));
  const faltasPlano = demanda
    .filter((item) => faltaPorInsumo.has(item.insumo_id))
    .map((item) => ({ ...item, falta: faltaPorInsumo.get(item.insumo_id) ?? item.falta }));
  await notificarFaltasPlano(supabase, planId, faltasPlano, "baixa");
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/notificacoes");
  revalidatePath("/");
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("liberar_plano", { p_planejamento_id: planId });
  if (error) return { ok: false, message: error.message };
  await supabase.rpc("cancelar_planejamento_operacional" as never, {
    p_planejamento_id: planId,
  } as never);
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/estoque");
  return { ok: true, message: "Reservas liberadas." };
}

export async function concluirPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("concluir_planejamento" as never, {
    p_planejamento_id: planId,
  } as never);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/planejamento");
  return { ok: true, message: "Planejamento concluído." };
}

export async function excluirPlano(formData: FormData) {
  const id = Number(formData.get("planejamento_id"));
  const supabase = await createClient();
  await supabase.from("planejamento").delete().eq("id", id);
  revalidatePath("/planejamento");
  redirect("/planejamento");
}
