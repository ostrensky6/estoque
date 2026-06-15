"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { calcularTodas } from "@/lib/costing/loader";
import {
  calcularQuantidadeViagem,
  classificarDespesaViagem,
  normalizarViagemInputs,
  type ViagemInputs,
} from "@/lib/project-budget/travel";

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
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("nome, cnpj, contato, email, telefone")
    .eq("id", clienteId)
    .single();
  return data;
}

export async function criarOrcamentoProjeto(formData: FormData) {
  const supabase = await createClient();
  const projetoId = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const titulo = texto(formData, "titulo") || "Novo custo de projeto";

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
      titulo: titulo === "Novo custo de projeto" && projeto?.nome ? projeto.nome : titulo,
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

  const supabase = await createClient();
  const projetoId = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const clienteId = formData.get("cliente_id") ? Number(formData.get("cliente_id")) : null;
  const cliente = await carregarCliente(clienteId);

  const patch = {
    projeto_id: projetoId,
    cliente_id: clienteId,
    titulo: texto(formData, "titulo") || "Custos de projeto",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    data_orcamento: texto(formData, "data_orcamento") ?? undefined,
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
  const supabase = await createClient();
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

  const supabase = await createClient();
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

  const supabase = await createClient();
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

export async function salvarViagensProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  if (!id) return;

  const inputs: ViagemInputs = normalizarViagemInputs({
    pessoas: numero(formData, "pessoas"),
    dias_campo: numero(formData, "dias_campo"),
    fator_risco_dias: numero(formData, "fator_risco_dias"),
    diarias_hospedagem: numero(formData, "diarias_hospedagem"),
    quartos: numero(formData, "quartos"),
    veiculos: numero(formData, "veiculos"),
    distancia_km: numero(formData, "distancia_km"),
    consumo_km_l: numero(formData, "consumo_km_l", 10),
    pedagios: numero(formData, "pedagios"),
    passagens_aereas: numero(formData, "passagens_aereas"),
  });

  const supabase = await createClient();
  await supabase.from("orcamento_projetos").update({ travel_inputs: inputs }).eq("id", id);

  // Recalcula a quantidade das linhas VD automatizáveis a partir dos parâmetros.
  const { data: vdItens } = await supabase
    .from("orcamento_projeto_custos")
    .select("id, descricao, categoria")
    .eq("orcamento_projeto_id", id)
    .eq("rubrica", "VD");
  for (const item of vdItens ?? []) {
    const despesa = classificarDespesaViagem(item.descricao, item.categoria);
    const quantidade = calcularQuantidadeViagem(despesa, inputs);
    if (quantidade != null && quantidade > 0) {
      await supabase
        .from("orcamento_projeto_custos")
        .update({ quantidade })
        .eq("id", item.id);
    }
  }
  revalidatePath(`${pathLista}/${id}`);
}

export async function removerAnaliseProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const itemId = numero(formData, "item_id");
  if (!id || !itemId) return;
  const supabase = await createClient();
  await supabase.from("orcamento_projeto_analises").delete().eq("id", itemId);
  revalidatePath(`${pathLista}/${id}`);
}

export async function removerCustoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const itemId = numero(formData, "item_id");
  if (!id || !itemId) return;
  const supabase = await createClient();
  await supabase.from("orcamento_projeto_custos").delete().eq("id", itemId);
  revalidatePath(`${pathLista}/${id}`);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Gera um link público read-only de aprovação. O token bruto é mostrado uma
 *  única vez (via query param); o banco guarda só o hash SHA-256. */
export async function criarLinkPublico(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  if (!id) return;

  const token = randomBytes(24).toString("base64url");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("orcamento_projeto_links").insert({
    orcamento_projeto_id: id,
    token_hash: hashToken(token),
    criado_por: user?.id ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`${pathLista}/${id}`);
  redirect(`${pathLista}/${id}?novo_link=${token}`);
}

export async function revogarLinkPublico(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const linkId = numero(formData, "link_id");
  if (!id || !linkId) return;
  const supabase = await createClient();
  await supabase.from("orcamento_projeto_links").update({ revogado: true }).eq("id", linkId);
  revalidatePath(`${pathLista}/${id}`);
}

/** Aprovação pública (sem login) via RPC SECURITY DEFINER validando o token. */
export async function aprovarOrcamentoPublico(formData: FormData) {
  const token = texto(formData, "token");
  const nome = texto(formData, "nome");
  if (!token) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("aprovar_orcamento_publico", {
    p_token: token,
    p_nome: nome ?? "",
  });
  if (error) throw new Error(error.message);
  if (data === false) throw new Error("Link inválido, expirado ou já aprovado.");
  revalidatePath(`/aprovar/${token}`);
}

type CustoTemplate = {
  categoria: string;
  rubrica: string | null;
  descricao: string;
  quantidade: number;
  unidade: string | null;
  custo_unitario: number;
  preco_unitario: number;
  meses_selecionados: number[] | null;
};

type ParametrosTemplate = {
  project_months?: number;
  impostos_legacy?: number;
  incubacao?: number;
  reserva?: number;
  investimentos?: number;
  lucro?: number;
  travel_inputs?: unknown;
};

/** Salva o orçamento atual como template reutilizável (parâmetros + rubricas).
 *  Análises de laboratório não entram (são específicas de cada cotação).
 *  Usa o schema existente (0012): parâmetros e itens em colunas jsonb. */
export async function salvarComoTemplate(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const nome = texto(formData, "nome");
  if (!id || !nome) return;

  const supabase = await createClient();

  const { data: orc } = await supabase
    .from("orcamento_projetos")
    .select(
      "project_months, impostos_legacy, incubacao, reserva, investimentos, lucro, margem_lucro, impostos, travel_inputs",
    )
    .eq("id", id)
    .single();
  if (!orc) return;

  const { data: custos } = await supabase
    .from("orcamento_projeto_custos")
    .select("categoria, rubrica, descricao, quantidade, unidade, custo_unitario, preco_unitario, meses_selecionados")
    .eq("orcamento_projeto_id", id);

  const parametros: ParametrosTemplate = {
    project_months: Number(orc.project_months ?? 12),
    impostos_legacy: Number(orc.impostos_legacy ?? orc.impostos ?? 0),
    incubacao: Number(orc.incubacao ?? 0),
    reserva: Number(orc.reserva ?? 0),
    investimentos: Number(orc.investimentos ?? 0),
    lucro: Number(orc.lucro ?? orc.margem_lucro ?? 0),
    travel_inputs: orc.travel_inputs ?? {},
  };

  const { error } = await supabase.from("orcamento_projeto_templates").insert({
    nome,
    descricao: texto(formData, "descricao"),
    origem: "kontrol",
    itens: (custos ?? []) as unknown as Json,
    parametros: parametros as unknown as Json,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`${pathLista}/${id}`);
  revalidatePath(pathLista);
}

/** Cria um novo orçamento de projeto a partir de um template. */
export async function criarProjetoDeTemplate(formData: FormData) {
  const templateId = numero(formData, "template_id");
  if (!templateId) return;

  const supabase = await createClient();
  const { data: tpl } = await supabase
    .from("orcamento_projeto_templates")
    .select("*")
    .eq("id", templateId)
    .single();
  if (!tpl) return;

  const params = (tpl.parametros ?? {}) as ParametrosTemplate;

  const projetoId = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  let projeto: { nome: string; cliente_id: number | null } | null = null;
  if (projetoId) {
    const { data } = await supabase
      .from("projetos")
      .select("nome, cliente_id")
      .eq("id", projetoId)
      .single();
    projeto = data;
  }
  const cliente = await carregarCliente(projeto?.cliente_id ?? null);

  const { data: novo, error } = await supabase
    .from("orcamento_projetos")
    .insert({
      projeto_id: projetoId,
      cliente_id: projeto?.cliente_id ?? null,
      titulo: projeto?.nome ?? `Projeto de ${tpl.nome}`,
      cliente_nome: cliente?.nome ?? null,
      cliente_cnpj: cliente?.cnpj ?? null,
      cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || null,
      project_months: Number(params.project_months ?? 12),
      impostos_legacy: Number(params.impostos_legacy ?? 0),
      incubacao: Number(params.incubacao ?? 0),
      reserva: Number(params.reserva ?? 0),
      investimentos: Number(params.investimentos ?? 0),
      lucro: Number(params.lucro ?? 0),
      travel_inputs: (params.travel_inputs ?? {}) as Json,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const itens = ((tpl.itens ?? []) as unknown as CustoTemplate[]) ?? [];
  if (itens.length > 0) {
    const linhas = itens.map((it) => ({
      orcamento_projeto_id: novo.id,
      categoria: it.categoria || categoriaPorRubrica(it.rubrica || "OU"),
      rubrica: it.rubrica || "OU",
      descricao: it.descricao,
      quantidade: Number(it.quantidade) || 1,
      unidade: it.unidade,
      custo_unitario: Number(it.custo_unitario) || 0,
      preco_unitario: Number(it.preco_unitario) || 0,
      meses_selecionados: it.meses_selecionados ?? [],
      origem: "template",
    }));
    const { error: itemError } = await supabase.from("orcamento_projeto_custos").insert(linhas);
    if (itemError) throw new Error(itemError.message);
  }

  revalidatePath(pathLista);
  redirect(`${pathLista}/${novo.id}`);
}

export async function excluirTemplate(formData: FormData) {
  const templateId = numero(formData, "template_id");
  if (!templateId) return;
  const supabase = await createClient();
  await supabase.from("orcamento_projeto_templates").delete().eq("id", templateId);
  revalidatePath(pathLista);
}

const BUCKET_ANEXOS = "orcamento-anexos";

/** Faz upload de um anexo do orçamento de projeto para o bucket privado. */
export async function adicionarAnexoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const arquivo = formData.get("arquivo");
  if (!id || !(arquivo instanceof File) || arquivo.size === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const seguro = arquivo.name.replace(/[^\w.\-]+/g, "_").slice(-80) || "arquivo";
  const path = `${id}/${randomBytes(8).toString("hex")}-${seguro}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET_ANEXOS)
    .upload(path, arquivo, { contentType: arquivo.type || undefined, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { error } = await supabase.from("orcamento_projeto_anexos").insert({
    orcamento_projeto_id: id,
    path,
    nome_arquivo: arquivo.name,
    content_type: arquivo.type || null,
    tamanho: arquivo.size,
    criado_por: user?.id ?? null,
  });
  if (error) {
    // rollback do objeto se o metadado falhar
    await supabase.storage.from(BUCKET_ANEXOS).remove([path]);
    throw new Error(error.message);
  }
  revalidatePath(`${pathLista}/${id}`);
}

export async function removerAnexoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  const anexoId = numero(formData, "anexo_id");
  if (!id || !anexoId) return;

  const supabase = await createClient();
  const { data: anexo } = await supabase
    .from("orcamento_projeto_anexos")
    .select("path")
    .eq("id", anexoId)
    .single();
  if (anexo?.path) {
    await supabase.storage.from(BUCKET_ANEXOS).remove([anexo.path]);
  }
  await supabase.from("orcamento_projeto_anexos").delete().eq("id", anexoId);
  revalidatePath(`${pathLista}/${id}`);
}

export async function excluirOrcamentoProjeto(formData: FormData) {
  const id = numero(formData, "orcamento_projeto_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("orcamento_projetos").delete().eq("id", id);
  revalidatePath(pathLista);
  redirect(pathLista);
}
