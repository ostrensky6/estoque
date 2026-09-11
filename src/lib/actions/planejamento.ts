"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createClientUntyped } from "@/lib/supabase/server";
import { garantirEscrita } from "@/lib/supabase/escrita";
import { usuarioAtual } from "@/lib/auth/roles";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import type { FormState } from "./cadastros";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type DemandaInsumo = Awaited<ReturnType<typeof computarDemandaPlano>>[number];
type Shortfall = { insumo_id: number; falta: number };

function texto(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

function numeroOpcional(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function erroSchemaCache(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("Could not find the")),
  );
}

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
  const u = await usuarioAtual();
  const nome = String(formData.get("nome") ?? "").trim() || "Plano sem nome";
  const data_inicio_prevista = texto(formData, "data_inicio_prevista");
  const data_fim_prevista = texto(formData, "data_fim_prevista");
  const data_alvo = texto(formData, "data_alvo") ?? data_fim_prevista;
  const projeto_id = numeroOpcional(formData, "projeto_id");
  const prioridade = texto(formData, "prioridade") ?? "normal";
  const responsavel = texto(formData, "responsavel");
  const supabase = await createClientUntyped();
  let { data, error } = await supabase
    .from("planejamento")
    .insert({
      nome,
      data_alvo,
      data_inicio_prevista,
      data_fim_prevista,
      projeto_id,
      prioridade,
      responsavel,
      planejado_por: u?.nome ?? u?.email ?? null,
      origem_planejamento: "manual",
    })
    .select("id")
    .single();
  if (erroSchemaCache(error)) {
    const retry = await supabase
      .from("planejamento")
      .insert({
        nome,
        data_alvo,
        projeto_id,
        responsavel,
      })
      .select("id")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível criar o planejamento.");
  redirect(`/planejamento/${data.id}`);
}

async function validarEquipamentosDoPlano(
  supabase: Awaited<ReturnType<typeof createClientUntyped>>,
  planId: number,
): Promise<string | null> {
  const { data: itens, error: itensError } = await supabase
    .from("planejamento_itens")
    .select("codigo_analise")
    .eq("planejamento_id", planId);
  if (itensError) return itensError.message;
  const codigos = [...new Set((itens ?? []).map((item) => item.codigo_analise).filter(Boolean))];
  if (codigos.length === 0) return "Adicione análises ao plano antes de iniciar.";

  const { data: vinculos, error: vinculosError } = await supabase
    .from("equipamento_analise")
    .select("equipamento_id")
    .in("codigo_analise", codigos);
  if (vinculosError) return vinculosError.message;
  const requeridos = [...new Set((vinculos ?? []).map((vinculo) => Number(vinculo.equipamento_id)).filter(Number.isFinite))];
  if (requeridos.length === 0) return null;

  const { data: reservas, error: reservasError } = await supabase
    .from("equipamento_reservas")
    .select("equipamento_unidade_id, equipamento_unidades(equipamento_id, ativo, status_operacional)")
    .eq("planejamento_id", planId)
    .in("status", ["reservado", "em_uso"]);
  if (reservasError) return reservasError.message;

  const cobertos = new Set<number>();
  for (const reserva of reservas ?? []) {
    const unidadeRaw = reserva.equipamento_unidades;
    const unidade = Array.isArray(unidadeRaw) ? unidadeRaw[0] : unidadeRaw;
    if (!unidade?.ativo || ["em_manutencao", "calibracao_vencida", "inativo", "descartado"].includes(String(unidade.status_operacional))) continue;
    cobertos.add(Number(unidade.equipamento_id));
  }
  const faltantes = requeridos.filter((equipamentoId) => !cobertos.has(equipamentoId));
  return faltantes.length > 0
    ? `Não é possível iniciar: ${faltantes.length} equipamento(s) exigido(s) pela análise não têm unidade operacional reservada para este plano.`
    : null;
}

export async function atualizarPlanejamentoExecutivo(formData: FormData) {
  const u = await usuarioAtual();
  const planId = Number(formData.get("planejamento_id"));
  if (!planId) return;

  const data_inicio_prevista = texto(formData, "data_inicio_prevista");
  const data_fim_prevista = texto(formData, "data_fim_prevista");
  const supabase = await createClientUntyped();
  let { error } = await supabase
    .from("planejamento")
    .update({
      nome: texto(formData, "nome") ?? "Plano sem nome",
      projeto_id: numeroOpcional(formData, "projeto_id"),
      data_inicio_prevista,
      data_fim_prevista,
      data_alvo: texto(formData, "data_alvo") ?? data_fim_prevista,
      prioridade: texto(formData, "prioridade") ?? "normal",
      responsavel: texto(formData, "responsavel"),
      planejado_por: u?.nome ?? u?.email ?? null,
      observacao: texto(formData, "observacao"),
    })
    .eq("id", planId)
    .in("status_operacional", ["rascunho", "reservado"]);
  if (erroSchemaCache(error)) {
    const retry = await supabase
      .from("planejamento")
      .update({
        nome: texto(formData, "nome") ?? "Plano sem nome",
        projeto_id: numeroOpcional(formData, "projeto_id"),
        data_alvo: texto(formData, "data_alvo") ?? data_fim_prevista,
        responsavel: texto(formData, "responsavel"),
        observacao: texto(formData, "observacao"),
      })
      .eq("id", planId);
    error = retry.error;
  }
  if (error) throw new Error(error.message);

  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/planejamento");
  revalidatePath("/suprimentos");
}

/** Reserva uma unidade física exigida pelas análises do próprio plano.
 * A RPC faz a checagem transacional de indisponibilidade e sobreposição; esta
 * camada também impede que o formulário reserve equipamento alheio ao escopo.
 */
export async function reservarEquipamentoDoPlano(formData: FormData) {
  const planId = Number(formData.get("planejamento_id"));
  const unidadeId = Number(formData.get("equipamento_unidade_id"));
  const inicio = texto(formData, "data_inicio");
  const fim = texto(formData, "data_fim");
  if (!planId || !unidadeId || !inicio || !fim) {
    throw new Error("Informe o equipamento e o período da reserva.");
  }

  const inicioDate = new Date(inicio);
  const fimDate = new Date(fim);
  if (Number.isNaN(inicioDate.getTime()) || Number.isNaN(fimDate.getTime()) || fimDate <= inicioDate) {
    throw new Error("Período de reserva inválido.");
  }

  const supabase = await createClientUntyped();
  const [{ data: plano, error: planoError }, { data: itens }, { data: unidade, error: unidadeError }] = await Promise.all([
    supabase
      .from("planejamento")
      .select("status_operacional, data_inicio_prevista, data_fim_prevista")
      .eq("id", planId)
      .single(),
    supabase
      .from("planejamento_itens")
      .select("codigo_analise")
      .eq("planejamento_id", planId),
    supabase
      .from("equipamento_unidades")
      .select("id, equipamento_id")
      .eq("id", unidadeId)
      .single(),
  ]);
  if (planoError) throw new Error(planoError.message);
  if (unidadeError || !unidade) throw new Error(unidadeError?.message ?? "Equipamento não encontrado.");
  if (["cancelado", "concluido"].includes(String(plano?.status_operacional ?? ""))) {
    throw new Error("Não é possível reservar equipamento para um plano encerrado.");
  }
  if (!plano?.data_inicio_prevista || !plano?.data_fim_prevista) {
    throw new Error("Defina início e fim previstos do plano antes de reservar equipamentos.");
  }

  const inicioPlano = new Date(`${plano.data_inicio_prevista}T00:00:00`);
  const fimPlano = new Date(`${plano.data_fim_prevista}T23:59:59`);
  if (inicioDate < inicioPlano || fimDate > fimPlano) {
    throw new Error("A reserva do equipamento deve ficar dentro do período previsto do plano.");
  }

  const codigos = [...new Set((itens ?? []).map((item) => item.codigo_analise).filter(Boolean))];
  if (codigos.length === 0) throw new Error("Adicione análises ao plano antes de reservar equipamentos.");
  const { data: vinculos, error: vinculosError } = await supabase
    .from("equipamento_analise")
    .select("equipamento_id")
    .in("codigo_analise", codigos);
  if (vinculosError) throw new Error(vinculosError.message);
  const equipamentosPermitidos = new Set((vinculos ?? []).map((vinculo) => Number(vinculo.equipamento_id)));
  if (!equipamentosPermitidos.has(Number(unidade.equipamento_id))) {
    throw new Error("Este equipamento não está vinculado às análises do plano.");
  }

  const usuario = await usuarioAtual();
  const { error } = await supabase.rpc("reservar_equipamento_planejamento", {
    p_equipamento_unidade_id: unidadeId,
    p_planejamento_id: planId,
    p_data_inicio: inicioDate.toISOString(),
    p_data_fim: fimDate.toISOString(),
    p_responsavel: texto(formData, "responsavel") ?? usuario?.nome ?? usuario?.email ?? null,
    p_observacao: texto(formData, "observacao"),
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/planejamento/${planId}`);
  revalidatePath("/planejamento");
  revalidatePath("/suprimentos");
}

/**
 * 2.2 — Orçamento (de análises) aprovado → gera um planejamento já vinculado
 * ao mesmo projeto, com as análises/amostras do orçamento. Um clique.
 */
export async function gerarPlanejamentoDeOrcamento(formData: FormData) {
  const u = await usuarioAtual();
  const orcamentoId = Number(formData.get("orcamento_id"));
  if (!orcamentoId) return;
  const supabase = await createClientUntyped();

  const { data: orc, error: orcErr } = await supabase
    .from("orcamentos")
    .select("id, cliente_nome, projeto_id, orcamento_itens(codigo_analise, n_amostras)")
    .eq("id", orcamentoId)
    .single();
  if (orcErr) throw new Error(orcErr.message);

  const itens = orc.orcamento_itens ?? [];
  if (itens.length === 0)
    throw new Error("O orçamento não tem análises para gerar um planejamento.");

  let { data: plano, error: planoErr } = await supabase
    .from("planejamento")
    .insert({
      nome: `Orçamento ${orc.id} — ${orc.cliente_nome ?? "sem cliente"}`,
      projeto_id: orc.projeto_id,
      origem_planejamento: "orcamento",
      orcamento_id: orc.id,
      planejado_por: u?.nome ?? u?.email ?? null,
    })
    .select("id")
    .single();
  if (erroSchemaCache(planoErr)) {
    const retry = await supabase
      .from("planejamento")
      .insert({
        nome: `Orçamento ${orc.id} — ${orc.cliente_nome ?? "sem cliente"}`,
        projeto_id: orc.projeto_id,
      })
      .select("id")
      .single();
    plano = retry.data;
    planoErr = retry.error;
  }
  if (planoErr) throw new Error(planoErr.message);
  if (!plano) throw new Error("Não foi possível criar o planejamento do orçamento.");

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
  const u = await usuarioAtual();
  const orcamentoProjetoId = Number(formData.get("orcamento_projeto_id"));
  if (!orcamentoProjetoId) return;
  const supabase = await createClientUntyped();

  const { data: orc, error: orcErr } = await supabase
    .from("orcamento_projetos")
    .select("id, titulo, projeto_id, orcamento_projeto_analises(codigo_analise, n_amostras)")
    .eq("id", orcamentoProjetoId)
    .single();
  if (orcErr) throw new Error(orcErr.message);

  const itens = orc.orcamento_projeto_analises ?? [];
  if (itens.length === 0)
    throw new Error("O orçamento de projeto não tem análises para gerar um planejamento.");

  let { data: plano, error: planoErr } = await supabase
    .from("planejamento")
    .insert({
      nome: `Projeto: ${orc.titulo ?? `Orçamento ${orc.id}`}`,
      projeto_id: orc.projeto_id,
      origem_planejamento: "orcamento_projeto",
      orcamento_projeto_id: orc.id,
      planejado_por: u?.nome ?? u?.email ?? null,
    })
    .select("id")
    .single();
  if (erroSchemaCache(planoErr)) {
    const retry = await supabase
      .from("planejamento")
      .insert({
        nome: `Projeto: ${orc.titulo ?? `Orçamento ${orc.id}`}`,
        projeto_id: orc.projeto_id,
      })
      .select("id")
      .single();
    plano = retry.data;
    planoErr = retry.error;
  }
  if (planoErr) throw new Error(planoErr.message);
  if (!plano) throw new Error("Não foi possível criar o planejamento do orçamento de projeto.");

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
  // `.select()` é obrigatório: sob RLS uma escrita negada pode voltar sem
  // `error` e sem nenhuma linha afetada. Só a linha retornada comprova.
  const { data, error } = await supabase
    .from("planejamento_itens")
    .insert({
      planejamento_id: planId,
      codigo_analise: codigo,
      n_amostras: n,
      n_controles: controles,
      repeticoes,
      perda_percentual: perda,
    })
    .select("id");
  garantirEscrita(error, data, "Não foi possível adicionar o item ao planejamento.");
  revalidatePath(`/planejamento/${planId}`);
}

export async function removerItem(formData: FormData) {
  const id = Number(formData.get("item_id"));
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("planejamento_itens")
    .delete()
    .eq("id", id)
    .select("id");
  garantirEscrita(error, data, "Não foi possível remover o item do planejamento.");
  revalidatePath(`/planejamento/${planId}`);
}

export async function reservarPlano(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planId = Number(formData.get("planejamento_id"));
  const supabase = await createClientUntyped();
  const { error: validacaoErr } = await supabase.rpc("validar_planejamento_executivo" as never, {
    p_planejamento_id: planId,
  } as never);
  if (validacaoErr) return { ok: false, message: validacaoErr.message };

  const demanda = await computarDemandaPlano(supabase, planId);
  if (demanda.length === 0)
    return { ok: false, message: "Adicione análises ao plano antes de reservar." };

  const itens = demanda.map((d) => ({ insumo_id: d.insumo_id, quantidade: d.demanda }));
  const { data, error } = await supabase.rpc("reservar_plano", {
    p_planejamento_id: planId,
    p_itens: itens,
  });
  if (error) return { ok: false, message: error.message };

  const shortfalls = parseShortfalls((data as unknown as { shortfalls?: unknown } | null)?.shortfalls);
  const faltaPorInsumo = new Map<number, number>();
  for (const item of demanda.filter((d) => d.falta > 0)) {
    faltaPorInsumo.set(item.insumo_id, item.falta);
  }
  for (const item of shortfalls) {
    faltaPorInsumo.set(item.insumo_id, Math.max(faltaPorInsumo.get(item.insumo_id) ?? 0, item.falta));
  }
  const faltasPlano = demanda
    .filter((item) => faltaPorInsumo.has(item.insumo_id))
    .map((item) => ({ ...item, falta: faltaPorInsumo.get(item.insumo_id) ?? item.falta }));
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
  const supabase = await createClientUntyped();
  const demanda = await computarDemandaPlano(supabase, planId);
  const faltasAntesDaBaixa = demanda.filter((d) => d.falta > 0);
  if (faltasAntesDaBaixa.length > 0) {
    await notificarFaltasPlano(supabase, planId, faltasAntesDaBaixa, "baixa");
    revalidatePath(`/planejamento/${planId}`);
    revalidatePath("/notificacoes");
    return {
      ok: false,
      message: `Não é possível iniciar: ${faltasAntesDaBaixa.length} insumo(s) ainda têm falta. Gere pedido, receba/libere lote ou replaneje antes da baixa.`,
    };
  }

  const bloqueioEquipamento = await validarEquipamentosDoPlano(supabase, planId);
  if (bloqueioEquipamento) {
    revalidatePath(`/planejamento/${planId}`);
    return { ok: false, message: bloqueioEquipamento };
  }

  const { data, error } = await supabase.rpc("dar_baixa_plano", {
    p_planejamento_id: planId,
  });
  if (error) return { ok: false, message: error.message };

  const shortfalls = parseShortfalls((data as { shortfalls?: unknown } | null)?.shortfalls);
  const faltaPorInsumo = new Map<number, number>();
  for (const item of demanda.filter((d) => d.falta > 0)) {
    faltaPorInsumo.set(item.insumo_id, item.falta);
  }
  for (const item of shortfalls) {
    faltaPorInsumo.set(item.insumo_id, Math.max(faltaPorInsumo.get(item.insumo_id) ?? 0, item.falta));
  }
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

/**
 * Exclusão física de planejamento.
 *
 * Passa pela RPC `excluir_planejamento_rascunho` (0104), que exige
 * coordenador e recusa planos com reserva de insumo, reserva de
 * equipamento, conferência de lote ou pedido interno vinculado — o DELETE
 * direto apagava tudo isso por cascade, em nível técnico. Planos com
 * vínculo devem ser cancelados, não excluídos.
 *
 * O redirect só acontece depois da confirmação; antes, a tela redirecionava
 * mesmo quando a exclusão não tinha ocorrido.
 */
export async function excluirPlano(formData: FormData): Promise<void> {
  const id = Number(formData.get("planejamento_id"));
  if (!id) throw new Error("Planejamento inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("excluir_planejamento_rascunho" as never, {
    p_planejamento_id: id,
  } as never);

  if (error) throw new Error(error.message);
  if (!data) {
    throw new Error(
      "A exclusão não foi confirmada pelo banco. O planejamento foi preservado.",
    );
  }

  revalidatePath("/planejamento");
  revalidatePath(`/planejamento/${id}`);
  redirect("/planejamento");
}
