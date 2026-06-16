"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function revalidarReceita(codigo: string) {
  revalidatePath(`/analises/${codigo}`);
  revalidatePath("/analises");
  revalidatePath("/custeio");
  revalidatePath("/insumos");
}

// =====================================================================
// Análise (cabeçalho) — criar / duplicar / atualizar / excluir
// =====================================================================

export async function criarAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo");
  if (!codigo) throw new Error("Informe o código da análise.");
  const supabase = await createClient();
  const { error } = await supabase.from("analises").insert({
    codigo,
    nome: txt(formData, "nome"),
    descricao: txt(formData, "descricao"),
    ativo: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/analises");
  redirect(`/analises/${codigo}`);
}

export async function atualizarAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo");
  if (!codigo) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("analises")
    .update({
      nome: txt(formData, "nome"),
      descricao: txt(formData, "descricao"),
      ativo: bool(formData, "ativo"),
    })
    .eq("codigo", codigo);
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
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
}

export async function excluirAnalise(formData: FormData) {
  const codigo = txtReq(formData, "codigo");
  if (!codigo) return;
  const supabase = await createClient();
  // remove dependentes antes (não há cascade garantido a partir de analises)
  await supabase.from("insumo_analise").delete().eq("codigo_analise", codigo);
  await supabase.from("equipamento_analise").delete().eq("codigo_analise", codigo);
  await supabase.from("etapas").delete().eq("codigo_analise", codigo);
  const { error } = await supabase.from("analises").delete().eq("codigo", codigo);
  if (error) throw new Error(error.message);
  revalidatePath("/analises");
  redirect("/analises");
}

/** Duplica a análise inteira (cabeçalho + etapas + equipamentos + materiais). */
export async function duplicarAnalise(formData: FormData) {
  const origem = txtReq(formData, "origem");
  const novo = txtReq(formData, "novo_codigo");
  if (!origem || !novo) throw new Error("Código de origem e novo código são obrigatórios.");
  const supabase = await createClient();

  const { data: base, error: baseErr } = await supabase
    .from("analises")
    .select("nome, descricao")
    .eq("codigo", origem)
    .single();
  if (baseErr) throw new Error(baseErr.message);

  const { error: insErr } = await supabase.from("analises").insert({
    codigo: novo,
    nome: txt(formData, "novo_nome") ?? (base.nome ? `${base.nome} (cópia)` : null),
    descricao: base.descricao,
    ativo: true,
  });
  if (insErr) throw new Error(insErr.message);

  const [{ data: etapas }, { data: equip }, { data: materiais }] = await Promise.all([
    supabase
      .from("etapas")
      .select(
        "nome_etapa, nome_atividade, atividade_opcional, ordem, execucoes_por_dia, amostras_por_execucao, tempo_maquina_h, tempo_bancada_h, tipo_limitacao, dia_inicio, dia_fim_max",
      )
      .eq("codigo_analise", origem),
    supabase
      .from("equipamento_analise")
      .select("equipamento_id, peso_alocacao")
      .eq("codigo_analise", origem),
    supabase
      .from("insumo_analise")
      .select(
        "nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, unidade, modo_cobranca, base_calculo, insumo_id",
      )
      .eq("codigo_analise", origem),
  ]);

  if (etapas?.length)
    await supabase.from("etapas").insert(etapas.map((e) => ({ ...e, codigo_analise: novo })));
  if (equip?.length)
    await supabase
      .from("equipamento_analise")
      .insert(equip.map((e) => ({ ...e, codigo_analise: novo })));
  if (materiais?.length)
    await supabase
      .from("insumo_analise")
      .insert(materiais.map((m) => ({ ...m, codigo_analise: novo })));

  revalidatePath("/analises");
  redirect(`/analises/${novo}`);
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
  const { error } = await supabase.from("equipamento_analise").insert({
    codigo_analise: codigo,
    equipamento_id,
    peso_alocacao: numOrNull(formData, "peso_alocacao") ?? 1,
  });
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
  const supabase = await createClient();
  const { error } = await supabase.from("insumo_analise").insert({
    codigo_analise: codigo,
    nome_etapa: txtReq(formData, "nome_etapa") || "—",
    nome_atividade: txtReq(formData, "nome_atividade") || "—",
    especificacao_insumo: txt(formData, "especificacao_insumo"),
    insumo_id: numOrNull(formData, "insumo_id"),
    quantidade_por_amostra: numOrNull(formData, "quantidade_por_amostra"),
    unidade: txt(formData, "unidade"),
    modo_cobranca: txt(formData, "modo_cobranca"),
    grupo_escolha: txt(formData, "grupo_escolha"),
  });
  if (error) throw new Error(error.message);
  revalidarReceita(codigo);
}

export async function atualizarMaterial(formData: FormData) {
  const codigo = txtReq(formData, "codigo_analise");
  const id = Number(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("insumo_analise")
    .update({
      especificacao_insumo: txt(formData, "especificacao_insumo"),
      insumo_id: numOrNull(formData, "insumo_id"),
      quantidade_por_amostra: numOrNull(formData, "quantidade_por_amostra"),
      unidade: txt(formData, "unidade"),
      modo_cobranca: txt(formData, "modo_cobranca"),
      grupo_escolha: txt(formData, "grupo_escolha"),
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
