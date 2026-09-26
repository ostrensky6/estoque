"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ---- helpers ---------------------------------------------------------
const txt = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
};
const txtReq = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const numOrNull = (fd: FormData, k: string) => {
  const v = fd.get(k);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
const MATERIAL_SEM_INSUMO_MSG =
  "Material com consumo informado precisa estar vinculado a um insumo de estoque.";

function revalidarReceita(codigo: string) {
  revalidatePath(`/analises/${codigo}`);
  revalidatePath("/analises");
  revalidatePath("/custeio");
  revalidatePath("/insumos");
}

function validarVinculoMaterial(quantidade_por_amostra: number | null, insumo_id: number | null) {
  if (Number(quantidade_por_amostra ?? 0) > 0 && !insumo_id) {
    throw new Error(MATERIAL_SEM_INSUMO_MSG);
  }
}

/** Atualiza só os campos do catálogo simplificado (módulo Análises): nome simplificado, descrição e status. Não toca em `nome` nem `ativo`. */
export async function atualizarCatalogoAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo");
  if (!codigo) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("analises")
    .update({
      nome_simplificado: txt(formData, "nome_simplificado"),
      descricao: txt(formData, "descricao"),
      status: txt(formData, "status"),
    })
    .eq("codigo", codigo);
  if (error) throw new Error(error.message);
  revalidatePath("/analises");
  revalidatePath(`/analises/${codigo}`);
}

export async function inativarAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo");
  if (!codigo) return;
  const supabase = await createClient();
  const { error } = await supabase.from("analises").update({ ativo: false }).eq("codigo", codigo);
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

// =====================================================================
// Etapas
// =====================================================================

export async function adicionarEtapa(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const supabase = await createClient();
  const { error } = await supabase.from("etapas").insert({
    codigo_analise: codigo,
    nome_etapa: txtReq(formData, "nome_etapa") || "Etapa",
    nome_atividade: txtReq(formData, "nome_atividade") || "Atividade",
    execucoes_por_dia: numOrNull(formData, "execucoes_por_dia"),
    amostras_por_execucao: numOrNull(formData, "amostras_por_execucao"),
    tempo_maquina_h: numOrNull(formData, "tempo_maquina_h"),
    tempo_bancada_h: numOrNull(formData, "tempo_bancada_h"),
    tipo_limitacao: txt(formData, "tipo_limitacao"),
    ordem: numOrNull(formData, "ordem"),
    dia_fim_max: numOrNull(formData, "dia_fim_max"),
    atividade_opcional: bool(formData, "atividade_opcional"),
  });
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function atualizarEtapa(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("etapas")
    .update({
      nome_etapa: txtReq(formData, "nome_etapa") || "Etapa",
      nome_atividade: txtReq(formData, "nome_atividade") || "Atividade",
      execucoes_por_dia: numOrNull(formData, "execucoes_por_dia"),
      amostras_por_execucao: numOrNull(formData, "amostras_por_execucao"),
      tempo_maquina_h: numOrNull(formData, "tempo_maquina_h"),
      tempo_bancada_h: numOrNull(formData, "tempo_bancada_h"),
      tipo_limitacao: txt(formData, "tipo_limitacao"),
      atividade_opcional: bool(formData, "atividade_opcional"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function removerEtapa(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("etapas").delete().eq("id", id);
  revalidarReceita(codigo);
}

// =====================================================================
// Equipamentos (alocação)
// =====================================================================

export async function adicionarEquipamento(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const equipamento_id = Number(formData.get("equipamento_id"));
  if (!equipamento_id) throw new Error("Selecione um equipamento.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipamento_analise")
    .upsert(
      {
        codigo_analise: codigo,
        equipamento_id,
        peso_alocacao: numOrNull(formData, "peso_alocacao") ?? 1,
      },
      { onConflict: "equipamento_id,codigo_analise" },
    );
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function atualizarEquipamentoAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("equipamento_analise")
    .update({ peso_alocacao: numOrNull(formData, "peso_alocacao") ?? 0 })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function removerEquipamento(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("equipamento_analise").delete().eq("id", id);
  revalidarReceita(codigo);
}

// =====================================================================
// Materiais (insumo_analise)
// =====================================================================

export async function adicionarMaterial(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const insumo_id = numOrNull(formData, "insumo_id");
  const quantidade_por_amostra = numOrNull(formData, "quantidade_por_amostra");
  validarVinculoMaterial(quantidade_por_amostra, insumo_id);
  const grupo_escolha = txt(formData, "grupo_escolha");
  const supabase = await createClient();
  const { error } = await supabase.from("insumo_analise").insert({
    codigo_analise: codigo,
    nome_etapa: txtReq(formData, "nome_etapa") || "—",
    nome_atividade: txtReq(formData, "nome_atividade") || "—",
    especificacao_insumo: txt(formData, "especificacao_insumo"),
    insumo_id,
    quantidade_por_amostra,
    unidade: txt(formData, "unidade"),
    modo_cobranca: txt(formData, "modo_cobranca"),
    grupo_escolha,
    preferencial: Boolean(grupo_escolha) && bool(formData, "preferencial"),
  });
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function atualizarMaterial(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const insumo_id = numOrNull(formData, "insumo_id");
  const quantidade_por_amostra = numOrNull(formData, "quantidade_por_amostra");
  validarVinculoMaterial(quantidade_por_amostra, insumo_id);
  const grupo_escolha = txt(formData, "grupo_escolha");
  const supabase = await createClient();
  const { error } = await supabase
    .from("insumo_analise")
    .update({
      especificacao_insumo: txt(formData, "especificacao_insumo"),
      insumo_id,
      quantidade_por_amostra,
      unidade: txt(formData, "unidade"),
      modo_cobranca: txt(formData, "modo_cobranca"),
      grupo_escolha,
      preferencial: Boolean(grupo_escolha) && bool(formData, "preferencial"),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function removerMaterial(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("insumo_analise").delete().eq("id", id);
  revalidarReceita(codigo);
}
