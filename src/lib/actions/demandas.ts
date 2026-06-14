"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";

const listaPath = "/orcamento/demandas";

function texto(formData: FormData, chave: string) {
  const valor = String(formData.get(chave) ?? "").trim();
  return valor || null;
}

function numeroOuNull(formData: FormData, chave: string) {
  const valor = formData.get(chave);
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

async function clienteSnapshot(clienteId: number | null) {
  if (!clienteId) return null;
  const supabase = await createClientUntyped();
  const { data } = await supabase
    .from("clientes")
    .select("nome, cnpj, contato, email, telefone")
    .eq("id", clienteId)
    .single();
  return data;
}

export async function criarDemanda(formData: FormData) {
  const supabase = await createClientUntyped();
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);

  const { data, error } = await supabase
    .from("demandas_propostas")
    .insert({
      cliente_id: clienteId,
      projeto_id: numeroOuNull(formData, "projeto_id"),
      titulo: texto(formData, "titulo") || "Nova demanda",
      cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
      cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
      cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
      modalidade: texto(formData, "modalidade") || "analises",
      origem: texto(formData, "origem"),
      prioridade: texto(formData, "prioridade") || "normal",
      descricao: texto(formData, "descricao"),
      escopo_preliminar: texto(formData, "escopo_preliminar"),
      observacoes: texto(formData, "observacoes"),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(listaPath);
  redirect(`${listaPath}/${data.id}`);
}

export async function salvarDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClientUntyped();
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);

  const patch = {
    cliente_id: clienteId,
    projeto_id: numeroOuNull(formData, "projeto_id"),
    titulo: texto(formData, "titulo") || "Demanda sem titulo",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    instituicao: texto(formData, "instituicao"),
    responsavel_interno: texto(formData, "responsavel_interno"),
    data_solicitacao: texto(formData, "data_solicitacao"),
    prazo_esperado: texto(formData, "prazo_esperado"),
    modalidade: texto(formData, "modalidade") || "analises",
    status: texto(formData, "status") || "nova",
    origem: texto(formData, "origem"),
    prioridade: texto(formData, "prioridade") || "normal",
    descricao: texto(formData, "descricao"),
    escopo_preliminar: texto(formData, "escopo_preliminar"),
    observacoes: texto(formData, "observacoes"),
  };

  const { error } = await supabase.from("demandas_propostas").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${id}`);
}

export async function gerarOrcamentoAnalisesDaDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClientUntyped();
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;

  const { data, error } = await supabase
    .from("orcamentos")
    .insert({
      demanda_id: id,
      cliente_id: demanda.cliente_id,
      projeto_id: demanda.projeto_id,
      cliente_nome: demanda.cliente_nome || demanda.titulo,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      observacoes: demanda.escopo_preliminar || demanda.descricao || demanda.observacoes,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await supabase.from("demandas_propostas").update({ status: "orcada" }).eq("id", id);
  revalidatePath(listaPath);
  redirect(`/orcamento/${data.id}`);
}

export async function gerarOrcamentoProjetoDaDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClientUntyped();
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;

  const { data, error } = await supabase
    .from("orcamento_projetos")
    .insert({
      demanda_id: id,
      projeto_id: demanda.projeto_id,
      cliente_id: demanda.cliente_id,
      titulo: demanda.titulo,
      cliente_nome: demanda.cliente_nome,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      escopo: demanda.escopo_preliminar || demanda.descricao,
      observacoes: demanda.observacoes,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await supabase.from("demandas_propostas").update({ status: "orcada" }).eq("id", id);
  revalidatePath(listaPath);
  redirect(`/orcamento/projetos/${data.id}`);
}
