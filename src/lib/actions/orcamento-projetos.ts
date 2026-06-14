"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";

const pathLista = "/orcamento/projetos";

function texto(formData: FormData, chave: string) {
  const valor = String(formData.get(chave) ?? "").trim();
  return valor || null;
}

function numero(formData: FormData, chave: string, fallback = 0) {
  const valor = Number(formData.get(chave));
  return Number.isFinite(valor) ? valor : fallback;
}

function inteiroArray(formData: FormData, chave: string) {
  return formData
    .getAll(chave)
    .map((valor) => Number(valor))
    .filter((valor) => Number.isInteger(valor) && valor > 0);
}

function categoriaPorRubrica(rubrica: string) {
  switch (rubrica) {
    case "PE":
      return "mao_obra";
    case "MC":
      return "materiais";
    case "MP":
      return "equipamentos";
    case "ST":
      return "terceiros";
    case "VD":
      return "deslocamento";
    default:
      return "outros";
  }
}

async function carregarCliente(clienteId: number | null) {
  if (!clienteId) return null;
  const supabase = await createClientUntyped();
  const { data } = await supabase
    .from("clientes")
    .select("nome, cnpj, contato, email, telefone")
    .eq("id", clienteId)
    .single();
  return data;
}

export async function criarOrcamentoProjeto(formData: FormData) {
  const supabase = await createClientUntyped();
  const projetoId = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const titulo = texto(formData, "titulo") || "Novo orçamento de projeto";

  let projeto: { nome: string; cliente_id: number | null } | null = null;
  if (projetoId) {
    const { data } = await supabase
      .from("projetos")
      .select("nome, cliente_id")
      .eq("id", projetoId)
      .single();
    projeto = data;
  }

  const clienteId = projeto?.cliente_id ?? null;
  const cliente = await carregarCliente(clienteId);

  const { data, error } = await supabase
    .from("orcamento_projetos")
    .insert({
      projeto_id: projetoId,
      cliente_id: clienteId,
      titulo: titulo === "Novo orçamento de projeto" && projeto?.nome ? projeto.nome : titulo,
      cliente_nome: cliente?.nome ?? null,
      cliente_cnpj: cliente?.cnpj ?? null,
      cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(pathLista);
  redirect(`${pathLista}/${data.id}`);
}

export async function salvarOrcamentoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  if (!id) return;

  const supabase = await createClientUntyped();
  const projetoId = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const clienteId = formData.get("cliente_id") ? Number(formData.get("cliente_id")) : null;
  const cliente = await carregarCliente(clienteId);

  const patch = {
    projeto_id: projetoId,
    cliente_id: clienteId,
    titulo: texto(formData, "titulo") || "Orçamento de projeto",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    data_orcamento: texto(formData, "data_orcamento"),
    validade_dias: numero(formData, "validade_dias", 30),
    responsavel: texto(formData, "responsavel"),
    status: texto(formData, "status") || "rascunho",
    escopo: texto(formData, "escopo"),
    cronograma: texto(formData, "cronograma"),
    observacoes: texto(formData, "observacoes"),
    margem_lucro: numero(formData, "margem_lucro"),
    impostos: numero(formData, "impostos"),
    numero: texto(formData, "numero"),
    cliente_email: texto(formData, "cliente_email"),
    cliente_telefone: texto(formData, "cliente_telefone"),
    cliente_endereco: texto(formData, "cliente_endereco"),
    cliente_detalhes: texto(formData, "cliente_detalhes"),
    coordenador: texto(formData, "coordenador"),
    proprietario: texto(formData, "proprietario"),
    project_months: numero(formData, "project_months", 12),
    impostos_legacy: numero(formData, "impostos_legacy"),
    incubacao: numero(formData, "incubacao"),
    reserva: numero(formData, "reserva"),
    investimentos: numero(formData, "investimentos"),
    lucro: numero(formData, "lucro"),
  };

  const { error } = await supabase.from("orcamento_projetos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`${pathLista}/${id}`);
  revalidatePath(pathLista);
}

export async function adicionarAnaliseProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const codigo = texto(formData, "codigo_analise");
  const nAmostras = numero(formData, "n_amostras", 1);
  if (!id || !codigo || nAmostras <= 0) return;

  const { breakdowns } = await calcularTodas();
  const breakdown = breakdowns.find((x) => x.codigo === codigo);
  const supabase = await createClientUntyped();
  const { error } = await supabase.from("orcamento_projeto_analises").insert({
    orcamento_projeto_id: id,
    codigo_analise: codigo,
    n_amostras: nAmostras,
    custo_unitario: breakdown?.custoTotal ?? 0,
    preco_unitario: breakdown?.preco ?? 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${pathLista}/${id}`);
}

export async function adicionarCustoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const descricao = texto(formData, "descricao");
  if (!id || !descricao) return;

  const quantidade = numero(formData, "quantidade", 1);
  const custoUnitario = numero(formData, "custo_unitario");
  const precoUnitario = numero(formData, "preco_unitario", custoUnitario);

  const supabase = await createClientUntyped();
  const { error } = await supabase.from("orcamento_projeto_custos").insert({
    orcamento_projeto_id: id,
    categoria: texto(formData, "categoria") || categoriaPorRubrica(texto(formData, "rubrica") || "OU"),
    rubrica: texto(formData, "rubrica") || "OU",
    descricao,
    quantidade,
    unidade: texto(formData, "unidade"),
    custo_unitario: custoUnitario,
    preco_unitario: precoUnitario,
    meses_selecionados: inteiroArray(formData, "meses_selecionados"),
    origem: "manual",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${pathLista}/${id}`);
}

export async function adicionarCustoCatalogoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const catalogoId = texto(formData, "catalogo_item_id");
  if (!id || !catalogoId) return;

  const supabase = await createClientUntyped();
  const { data: item, error: itemError } = await supabase
    .from("orcamento_projeto_catalogo")
    .select("id, rubrica, descricao, unidade, preco_unitario, categoria")
    .eq("id", catalogoId)
    .single();
  if (itemError) throw new Error(itemError.message);
  if (!item) return;

  const quantidade = numero(formData, "quantidade", 1);
  const mesesSelecionados = inteiroArray(formData, "meses_selecionados");
  const { error } = await supabase.from("orcamento_projeto_custos").insert({
    orcamento_projeto_id: id,
    categoria: categoriaPorRubrica(item.rubrica),
    rubrica: item.rubrica,
    catalogo_item_id: item.id,
    descricao: item.descricao,
    quantidade,
    unidade: item.unidade,
    custo_unitario: Number(item.preco_unitario ?? 0),
    preco_unitario: Number(item.preco_unitario ?? 0),
    meses_selecionados: mesesSelecionados,
    origem: "catalogo",
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${pathLista}/${id}`);
}

export async function removerAnaliseProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const itemId = numero(formData, "item_id");
  if (!id || !itemId) return;
  const supabase = await createClientUntyped();
  await supabase.from("orcamento_projeto_analises").delete().eq("id", itemId);
  revalidatePath(`${pathLista}/${id}`);
}

export async function removerCustoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const itemId = numero(formData, "item_id");
  if (!id || !itemId) return;
  const supabase = await createClientUntyped();
  await supabase.from("orcamento_projeto_custos").delete().eq("id", itemId);
  revalidatePath(`${pathLista}/${id}`);
}

export async function excluirOrcamentoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  if (!id) return;
  const supabase = await createClientUntyped();
  await supabase.from("orcamento_projetos").delete().eq("id", id);
  revalidatePath(pathLista);
  redirect(pathLista);
}
