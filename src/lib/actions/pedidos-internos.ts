"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createClientUntyped } from "@/lib/supabase/server";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { registrarEvento } from "./eventos";
import {
  PEDIDO_INTERNO_AGUARDANDO_CHEGADA,
  type PedidoInternoStatus,
} from "@/lib/pedido/status";
import type { FormState } from "./cadastros";

const SEM_PERMISSAO: FormState = {
  ok: false,
  message: "Sem permissão — requer papel coordenador ou superior.",
};
const MSG_NOVO_INSUMO_INCOMPLETO =
  "Novo insumo no recebimento precisa de especificação, unidade, categoria, fator de conversão e custo.";
const MSG_CATEGORIA_NOVO_INSUMO =
  "Categoria de compra é obrigatória para cadastrar novo insumo no recebimento.";
const MSG_FATOR_NOVO_INSUMO = "Fator de conversão deve ser maior que zero.";
const MSG_CUSTO_NOVO_INSUMO =
  "Custo unitário é obrigatório para cadastrar novo insumo no recebimento.";
const MSG_VALIDADE_CRITICO = "Validade é obrigatória para receber insumo crítico.";

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim() || null;
}

function numero(formData: FormData, campo: string) {
  const valor = formData.get(campo);
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function comentarioObrigatorio(formData: FormData) {
  const observacao = texto(formData, "observacao");
  if (!observacao) return { ok: false as const, message: "Informe o motivo/comentário para esta decisão." };
  return { ok: true as const, observacao };
}

function hojeIso() {
  return new Date().toISOString();
}

function hojeData() {
  return new Date().toISOString().slice(0, 10);
}

function erroSchemaCache(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error &&
      (error.code === "PGRST204" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("Could not find the")),
  );
}

function normalizarCoordenadorProjeto(projeto: {
  coordenador?: string | null;
  coordenador_nome?: string | null;
  coordenador_email?: string | null;
} | null | undefined) {
  const email = projeto?.coordenador_email ?? (String(projeto?.coordenador ?? "").includes("@") ? projeto?.coordenador : null) ?? null;
  return {
    nome: projeto?.coordenador_nome ?? projeto?.coordenador ?? email ?? null,
    email,
  };
}

async function resolverCoordenadorProjeto(
  supabase: Awaited<ReturnType<typeof createClientUntyped>>,
  projetoId: number | null,
) {
  if (!projetoId) return { nome: null as string | null, email: null as string | null };

  const { data, error } = await supabase
    .from("projetos")
    .select("coordenador, coordenador_nome, coordenador_email")
    .eq("id", projetoId)
    .single();
  if (erroSchemaCache(error)) {
    const { data: legado, error: legadoError } = await supabase
      .from("projetos")
      .select("coordenador")
      .eq("id", projetoId)
      .single();
    if (legadoError) return { nome: null, email: null };
    return normalizarCoordenadorProjeto(legado);
  }

  if (error) return { nome: null, email: null };
  return normalizarCoordenadorProjeto(data);
}

async function coordenadorProjeto(pedidoId: number) {
  const supabase = await createClientUntyped();
  const { data, error } = await supabase
    .from("pedidos_internos")
    .select("projeto_id")
    .eq("id", pedidoId)
    .single();
  if (error || !data?.projeto_id) {
    return { projetoId: null, nome: null, email: null };
  }
  const coordenador = await resolverCoordenadorProjeto(supabase, Number(data.projeto_id));
  return {
    projetoId: data?.projeto_id as number | null | undefined,
    nome: coordenador.nome,
    email: coordenador.email,
  };
}

async function podeAprovarComoCoordenadorProjeto(pedidoId: number) {
  const u = await usuarioAtual();
  if (!u) return { ok: false as const, message: "Usuário não autenticado." };
  const coord = await coordenadorProjeto(pedidoId);
  const usuarioEmail = u.email?.toLowerCase() ?? null;
  const coordEmail = coord.email?.toLowerCase() ?? null;
  const emailConfere = Boolean(coordEmail && usuarioEmail && coordEmail === usuarioEmail);
  const coordenadorGlobal = await temPapel("coordenador");
  const gestorOuAdmin = await temPapel("gestor");

  if (!emailConfere && !coordenadorGlobal && !gestorOuAdmin) {
    return { ok: false as const, message: "A aprovação exige o coordenador do projeto ou papel coordenador/superior." };
  }

  return {
    ok: true as const,
    usuario: u,
    coordenadorNome: coord.nome,
    coordenadorEmail: coord.email,
    diferenteDoCoordenador: Boolean(coordEmail && !emailConfere),
  };
}

function validarNovoInsumoRecebimento(formData: FormData, especificacao: string | null, unidade: string | null) {
  const categoria = texto(formData, "categoria_compra");
  const fatorConversao = numero(formData, "fator_conversao");
  const custo = numero(formData, "custo");

  if (!especificacao || !unidade || !categoria || !(fatorConversao && fatorConversao > 0) || !(custo && custo > 0)) {
    if (!categoria) return { ok: false as const, message: MSG_CATEGORIA_NOVO_INSUMO };
    if (!(fatorConversao && fatorConversao > 0)) return { ok: false as const, message: MSG_FATOR_NOVO_INSUMO };
    if (!(custo && custo > 0)) return { ok: false as const, message: MSG_CUSTO_NOVO_INSUMO };
    return { ok: false as const, message: MSG_NOVO_INSUMO_INCOMPLETO };
  }

  if (categoria === "critico" && !texto(formData, "validade")) {
    return { ok: false as const, message: MSG_VALIDADE_CRITICO };
  }

  return {
    ok: true as const,
    categoria,
    fatorConversao,
    custo,
  };
}

const STATUS_ITENS_LIVRES = ["rascunho", "ajuste_solicitante", "ajuste_compras"];
const STATUS_ITENS_TERMINAIS = ["cancelado", "compra_concluida"];

/**
 * Itens podem ser alterados quando o pedido está em rascunho/ajuste (qualquer técnico)
 * ou em qualquer etapa não terminal, desde que o usuário seja coordenador ou superior.
 */
async function podeMexerItens(status: string) {
  if (STATUS_ITENS_TERMINAIS.includes(status)) return false;
  if (STATUS_ITENS_LIVRES.includes(status)) return true;
  return temPapel("coordenador");
}

async function mudarStatus({
  pedidoId,
  para,
  permitidoDe,
  observacao,
  etapa,
  decisao = "aprovado",
  extras = {},
}: {
  pedidoId: number;
  para: string;
  permitidoDe?: string[];
  observacao?: string | null;
  etapa?: string;
  decisao?: "aprovado" | "reprovado" | "devolvido" | "registrado";
  extras?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const u = await usuarioAtual();
  const { data: atual, error: atualErr } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (atualErr) return { ok: false, message: atualErr.message };
  if (!atual) return { ok: false, message: "Pedido interno não encontrado." };
  if (permitidoDe && !permitidoDe.includes(atual.status)) {
    return { ok: false, message: "Esta etapa não permite a ação solicitada." };
  }

  let { error } = await supabase
    .from("pedidos_internos")
    .update({ status: para, ...extras })
    .eq("id", pedidoId);
  if (erroSchemaCache(error) && Object.keys(extras).length > 0) {
    const retry = await supabase
      .from("pedidos_internos")
      .update({ status: para })
      .eq("id", pedidoId);
    error = retry.error;
  }
  if (error) return { ok: false, message: error.message };

  await supabase.from("pedidos_internos_aprovacoes").insert({
    pedido_interno_id: pedidoId,
    etapa: etapa ?? para,
    decisao,
    responsavel: u?.nome ?? u?.email ?? null,
    papel: u?.papel ?? null,
    comentario: observacao ?? null,
    status_origem: atual.status,
    status_destino: para,
  });
  await registrarEvento("pedido_interno", pedidoId, atual.status, para, observacao);
  revalidatePath("/pedido");
  revalidatePath(`/pedido/${pedidoId}`);
  return { ok: true, message: "Etapa atualizada." };
}

export async function criarPedidoInterno(formData: FormData) {
  const u = await usuarioAtual();
  const titulo = texto(formData, "titulo") ?? "Pedido interno sem título";
  const projeto_id = numero(formData, "projeto_id");
  const data_necessidade = texto(formData, "data_necessidade");
  const justificativa = texto(formData, "justificativa");
  const urgencia = texto(formData, "urgencia") ?? "normal";
  const fonte_recurso = texto(formData, "fonte_recurso");
  const tipo_demanda = texto(formData, "tipo_demanda") ?? "laboratorio";
  const supabase = await createClientUntyped();
  let coordenador_projeto_nome: string | null = null;
  let coordenador_projeto_email: string | null = null;

  if (projeto_id) {
    const coordenador = await resolverCoordenadorProjeto(supabase, projeto_id);
    coordenador_projeto_nome = coordenador.nome;
    coordenador_projeto_email = coordenador.email;
  }

  const payload = {
    titulo,
    projeto_id,
    tipo_demanda,
    coordenador_projeto_nome,
    coordenador_projeto_email,
    data_necessidade,
    justificativa,
    urgencia,
    fonte_recurso,
    solicitante: u?.email ?? null,
  };
  let { data, error } = await supabase
    .from("pedidos_internos")
    .insert(payload)
    .select("id")
    .single();
  if (erroSchemaCache(error)) {
    const legado = {
      titulo,
      projeto_id,
      data_necessidade,
      justificativa,
      urgencia,
      fonte_recurso,
      solicitante: u?.email ?? null,
    };
    const retry = await supabase.from("pedidos_internos").insert(legado).select("id").single();
    data = retry.data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Não foi possível criar o pedido interno.");
  await registrarEvento("pedido_interno", data.id, null, "rascunho", "Demanda inicial registrada.");
  redirect(`/pedido/${data.id}`);
}

export async function atualizarPedidoInterno(formData: FormData) {
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!pedidoId) return;
  const titulo = texto(formData, "titulo");
  if (!titulo) return;

  const supabase = await createClientUntyped();
  const projeto_id = numero(formData, "projeto_id");
  let coordenador_projeto_nome: string | null = null;
  let coordenador_projeto_email: string | null = null;
  if (projeto_id) {
    const coordenador = await resolverCoordenadorProjeto(supabase, projeto_id);
    coordenador_projeto_nome = coordenador.nome;
    coordenador_projeto_email = coordenador.email;
  }
  const payload = {
    titulo,
    projeto_id,
    tipo_demanda: texto(formData, "tipo_demanda") ?? "laboratorio",
    coordenador_projeto_nome,
    coordenador_projeto_email,
    data_necessidade: texto(formData, "data_necessidade"),
    urgencia: texto(formData, "urgencia") ?? "normal",
    fonte_recurso: texto(formData, "fonte_recurso"),
    justificativa: texto(formData, "justificativa"),
  };
  let { error } = await supabase
    .from("pedidos_internos")
    .update(payload)
    .eq("id", pedidoId);
  if (erroSchemaCache(error)) {
    const legado = {
      titulo,
      projeto_id,
      data_necessidade: texto(formData, "data_necessidade"),
      urgencia: texto(formData, "urgencia") ?? "normal",
      fonte_recurso: texto(formData, "fonte_recurso"),
      justificativa: texto(formData, "justificativa"),
    };
    const retry = await supabase.from("pedidos_internos").update(legado).eq("id", pedidoId);
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  revalidatePath(`/pedido/${pedidoId}`);
  revalidatePath("/pedido");
}

export async function excluirPedidoInterno(formData: FormData) {
  if (!(await temPapel("coordenador"))) return;
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!pedidoId) return;

  const supabase = await createClient();
  const { error } = await supabase.from("pedidos_internos").delete().eq("id", pedidoId);
  if (error) throw new Error(error.message);
  revalidatePath("/pedido");
  redirect("/pedido");
}

export async function adicionarItemPedidoInterno(formData: FormData) {
  const pedido_interno_id = numero(formData, "pedido_interno_id");
  const especificacao = texto(formData, "especificacao");
  const quantidade = numero(formData, "quantidade");
  if (!pedido_interno_id || !especificacao || !quantidade || quantidade <= 0) return;

  const supabase = await createClient();
  const { data: pedido } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedido_interno_id)
    .single();
  if (!pedido || !["rascunho", "ajuste_solicitante", "ajuste_compras"].includes(pedido.status)) return;

  const { error } = await supabase.from("pedidos_internos_itens").insert({
    pedido_interno_id,
    tipo: texto(formData, "tipo") ?? "material",
    insumo_id: numero(formData, "insumo_id"),
    especificacao,
    modelo: texto(formData, "modelo"),
    volume: texto(formData, "volume"),
    quantidade,
    unidade: texto(formData, "unidade"),
    orcamento_previo: numero(formData, "orcamento_previo"),
    fornecedor_sugerido: texto(formData, "fornecedor_sugerido"),
    observacao: texto(formData, "observacao"),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pedido/${pedido_interno_id}`);
}

export async function editarItemPedidoInterno(formData: FormData) {
  const itemId = numero(formData, "item_id");
  const pedido_interno_id = numero(formData, "pedido_interno_id");
  const especificacao = texto(formData, "especificacao");
  const quantidade = numero(formData, "quantidade");
  if (!itemId || !pedido_interno_id || !especificacao || !quantidade || quantidade <= 0) return;

  const supabase = await createClient();
  const { data: pedido } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedido_interno_id)
    .single();
  if (!pedido || !(await podeMexerItens(pedido.status))) return;

  const { error } = await supabase
    .from("pedidos_internos_itens")
    .update({
      tipo: texto(formData, "tipo") ?? "material",
      insumo_id: numero(formData, "insumo_id"),
      especificacao,
      modelo: texto(formData, "modelo"),
      volume: texto(formData, "volume"),
      quantidade,
      unidade: texto(formData, "unidade"),
      orcamento_previo: numero(formData, "orcamento_previo"),
      fornecedor_sugerido: texto(formData, "fornecedor_sugerido"),
      observacao: texto(formData, "observacao"),
    })
    .eq("id", itemId)
    .eq("pedido_interno_id", pedido_interno_id);
  if (error) throw new Error(error.message);
  revalidatePath(`/pedido/${pedido_interno_id}`);
}

export async function removerItemPedidoInterno(formData: FormData) {
  const itemId = numero(formData, "item_id");
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!itemId || !pedidoId) return;
  const supabase = await createClient();
  const { data: pedido } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (!pedido || !(await podeMexerItens(pedido.status))) return;
  await supabase.from("pedidos_internos_itens").delete().eq("id", itemId).eq("pedido_interno_id", pedidoId);
  revalidatePath(`/pedido/${pedidoId}`);
}

export async function enviarParaValidacao(_prev: FormState, formData: FormData): Promise<FormState> {
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const supabase = await createClient();
  const [{ data: pedido }, { data: itens }] = await Promise.all([
    supabase
      .from("pedidos_internos")
      .select("projeto_id, justificativa, fonte_recurso, urgencia")
      .eq("id", pedidoId)
      .single(),
    supabase
      .from("pedidos_internos_itens")
      .select("id, especificacao, quantidade, unidade")
      .eq("pedido_interno_id", pedidoId),
  ]);
  if (!pedido?.projeto_id) return { ok: false, message: "Vincule o pedido a um projeto antes de enviar." };
  if (!pedido.justificativa) return { ok: false, message: "Informe a justificativa antes de enviar." };
  if (!pedido.fonte_recurso) return { ok: false, message: "Informe a fonte de recurso provável antes de enviar." };
  if (!pedido.urgencia) return { ok: false, message: "Informe a urgência antes de enviar." };
  if (!itens || itens.length === 0) {
    return { ok: false, message: "Inclua ao menos um material ou serviço antes de enviar." };
  }
  if (itens.some((item) => !item.especificacao || !(Number(item.quantidade) > 0) || !item.unidade)) {
    return { ok: false, message: "Todos os itens precisam de especificação, quantidade e unidade." };
  }
  return mudarStatus({
    pedidoId,
    para: "em_validacao",
    permitidoDe: ["rascunho", "ajuste_solicitante", "ajuste_compras"],
    observacao: texto(formData, "observacao"),
    etapa: "Demanda inicial e lista de materiais",
    decisao: "registrado",
    extras: { enviado_validacao_em: new Date().toISOString() },
  });
}

export async function validarInformacoes(_prev: FormState, formData: FormData): Promise<FormState> {
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const permissao = await podeAprovarComoCoordenadorProjeto(pedidoId);
  if (!permissao.ok) return permissao;
  return mudarStatus({
    pedidoId,
    para: "validado",
    permitidoDe: ["em_validacao"],
    observacao: texto(formData, "observacao") ?? "Informações de modelo, volume e quantidade confirmadas.",
    etapa: "Validação das especificações técnicas",
    decisao: "aprovado",
    extras: {
      validado_em: hojeIso(),
      aprovado_coordenador_em: hojeIso(),
      aprovador_coordenador: permissao.usuario.nome ?? permissao.usuario.email,
      coordenador_projeto_nome: permissao.coordenadorNome,
      coordenador_projeto_email: permissao.coordenadorEmail,
      aprovador_coordenador_diferente: permissao.diferenteDoCoordenador,
    },
  });
}

export async function devolverParaSolicitante(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const comentario = comentarioObrigatorio(formData);
  if (!comentario.ok) return comentario;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "ajuste_solicitante",
    permitidoDe: ["em_validacao"],
    observacao: comentario.observacao,
    etapa: "Validação das especificações técnicas",
    decisao: "devolvido",
  });
}

export async function formalizarPedidoInterno(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const supabase = await createClient();
  const u = await usuarioAtual();

  const [{ data: pedido }, { data: itens }] = await Promise.all([
    supabase
      .from("pedidos_internos")
      .select("id, titulo, status, solicitante, projeto_id, pedido_compra_id")
      .eq("id", pedidoId)
      .single(),
    supabase
      .from("pedidos_internos_itens")
      .select("id, insumo_id, quantidade, orcamento_previo, especificacao, observacao")
      .eq("pedido_interno_id", pedidoId)
      .order("id"),
  ]);

  if (!pedido) return { ok: false, message: "Pedido interno não encontrado." };
  if (pedido.status !== "validado") return { ok: false, message: "Valide as informações antes de formalizar." };
  if (pedido.pedido_compra_id) return { ok: false, message: "Este pedido interno já possui compra formal." };

  const { data: compra, error: compraErr } = await supabase
    .from("pedidos_compra")
    .insert({
      projeto_id: pedido.projeto_id,
      solicitante: pedido.solicitante ?? u?.email ?? null,
      status: "solicitado",
      observacao: `Formalizado a partir do pedido interno #${pedido.id}: ${pedido.titulo}`,
    })
    .select("id")
    .single();
  if (compraErr) return { ok: false, message: compraErr.message };

  const itensComInsumo = (itens ?? []).filter((item) => item.insumo_id != null);
  if (itensComInsumo.length > 0) {
    const pedidosCompraItens = supabase.from("pedidos_compra_itens") as unknown as {
      insert: (values: Array<Record<string, unknown>>) => PromiseLike<{ error: { message: string } | null }>;
    };
    const { error: itensErr } = await pedidosCompraItens.insert(
      itensComInsumo.map((item) => ({
        pedido_id: compra.id,
        insumo_id: item.insumo_id as number,
        pedido_interno_item_id: item.id,
        quantidade: item.quantidade,
        custo_unitario_estimado: item.orcamento_previo,
      })),
    );
    if (itensErr) return { ok: false, message: itensErr.message };
  }

  const resultado = await mudarStatus({
    pedidoId,
    para: "formalizado",
    permitidoDe: ["validado"],
    observacao: `Compra formal #${compra.id} criada.`,
    etapa: "Formalização do pedido",
    decisao: "aprovado",
    extras: { pedido_compra_id: compra.id, formalizado_em: new Date().toISOString() },
  });
  await registrarEvento("pedido_compra", compra.id, null, "solicitado", `Criado pelo pedido interno #${pedidoId}.`);
  revalidatePath("/compras");
  return resultado;
}

export async function registrarAnaliseAdministrativa(formData: FormData) {
  if (!(await temPapel("coordenador"))) return;
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const observacao = texto(formData, "observacao");
  const fonte_recurso = texto(formData, "fonte_recurso");
  const rubrica = texto(formData, "rubrica");
  const conformidade_admin = texto(formData, "conformidade_admin");
  if (!fonte_recurso || !rubrica || !conformidade_admin) {
    throw new Error("Fonte de recurso, rubrica e conformidade administrativa são obrigatórias.");
  }
  const supabase = await createClient();
  const u = await usuarioAtual();
  const { data: atual } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (atual?.status !== "formalizado") return;

  const { error } = await supabase
    .from("pedidos_internos")
    .update({
      fonte_recurso,
      rubrica,
      conformidade_admin,
      observacao_compras: observacao,
      status: "analise_administrativa",
      analisado_em: new Date().toISOString(),
    })
    .eq("id", pedidoId)
    .eq("status", "formalizado");
  if (error) throw new Error(error.message);
  await supabase.from("pedidos_internos_aprovacoes").insert({
    pedido_interno_id: pedidoId,
    etapa: "Análise de fonte de recurso, rubrica e conformidade",
    decisao: "registrado",
    responsavel: u?.nome ?? u?.email ?? null,
    papel: u?.papel ?? null,
    comentario: observacao ?? null,
    status_origem: "formalizado",
    status_destino: "analise_administrativa",
  });
  await registrarEvento("pedido_interno", pedidoId, "formalizado", "analise_administrativa", observacao);
  revalidatePath(`/pedido/${pedidoId}`);
  revalidatePath("/pedido");
}

export async function aprovarAnaliseAdministrativa(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "aprovado_compra",
    permitidoDe: ["analise_administrativa"],
    observacao: texto(formData, "observacao") ?? "Fonte de recurso, rubrica e conformidades aprovadas.",
    etapa: "Liberação para cotação",
    decisao: "aprovado",
  });
}

export async function devolverParaCompras(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const comentario = comentarioObrigatorio(formData);
  if (!comentario.ok) return comentario;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "ajuste_compras",
    permitidoDe: ["analise_administrativa"],
    observacao: comentario.observacao,
    etapa: "Análise de fonte de recurso, rubrica e conformidade",
    decisao: "devolvido",
  });
}

export async function registrarLevantamentoOrcamentos(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "orcamentos",
    permitidoDe: ["aprovado_compra"],
    observacao: texto(formData, "observacao") ?? "Orçamentos levantados com especificações dos projetos.",
    etapa: "Levantamento de orçamentos",
    decisao: "registrado",
    extras: { orcamentos_em: new Date().toISOString() },
  });
}

export async function marcarOrcamentosRecebidos(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const supabase = await createClient();
  const { data: anexos } = await supabase
    .from("pedidos_internos_anexos")
    .select("id")
    .eq("pedido_interno_id", pedidoId)
    .in("tipo", ["orcamento_previo", "proposta", "print", "email"])
    .limit(1);
  if (!anexos || anexos.length === 0) {
    return { ok: false, message: "Anexe ao menos um orçamento, proposta, print ou e-mail antes de marcar como recebido." };
  }
  return mudarStatus({
    pedidoId,
    para: "orcamentos_recebidos",
    permitidoDe: ["orcamentos"],
    observacao: texto(formData, "observacao") ?? "Orçamentos/propostas recebidos e registrados.",
    etapa: "Orçamentos recebidos",
    decisao: "registrado",
  });
}

export async function enviarAprovacaoFinal(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "aguardando_aprovacao_final",
    permitidoDe: ["orcamentos_recebidos"],
    observacao: texto(formData, "observacao") ?? "Pedido enviado para aprovação final.",
    etapa: "Aguardando aprovação final",
    decisao: "registrado",
  });
}

export async function aprovarCompraFinal(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "aprovado_para_compra",
    permitidoDe: ["aguardando_aprovacao_final"],
    observacao: texto(formData, "observacao") ?? "Fornecedor/caminho de compra aprovado.",
    etapa: "Escolha do fornecedor ou encaminhamento institucional",
    decisao: "aprovado",
    extras: { aprovacao_final_em: new Date().toISOString() },
  });
}

export async function fecharComFornecedor(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const u = await usuarioAtual();
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "compra_fechada",
    permitidoDe: ["aprovado_para_compra"],
    observacao: texto(formData, "observacao") ?? "Compra fechada com fornecedor; documentos enviados por e-mail.",
    etapa: "Fechamento da compra",
    decisao: "aprovado",
    extras: {
      fechado_em: hojeIso(),
      modalidade_compra: "compra_direta",
      modalidade_definida_em: hojeIso(),
      modalidade_definida_por: u?.nome ?? u?.email ?? null,
      observacao_administrativa: texto(formData, "observacao"),
    },
  });
}

export async function encaminharInstituicao(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const u = await usuarioAtual();
  const modalidade = texto(formData, "modalidade_compra") ?? "fundacao";
  const instituicao = texto(formData, "instituicao_destino");
  if (!["fundacao", "universidade", "outra"].includes(modalidade)) {
    return { ok: false, message: "Selecione Fundação, Universidade ou outra instituição." };
  }
  if (!instituicao) return { ok: false, message: "Informe a instituição de destino." };
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "encaminhado_instituicao",
    permitidoDe: ["aprovado_para_compra"],
    observacao:
      texto(formData, "observacao") ??
      "Documentos, orçamentos e termos encaminhados para a instituição responsável pela compra.",
    etapa: "Envio de documentos para instituição compradora",
    decisao: "aprovado",
    extras: {
      encaminhado_em: hojeIso(),
      modalidade_compra: modalidade,
      modalidade_definida_em: hojeIso(),
      modalidade_definida_por: u?.nome ?? u?.email ?? null,
      instituicao_destino: instituicao,
      protocolo_externo: texto(formData, "protocolo_externo"),
      data_envio_instituicao: hojeData(),
      observacao_administrativa: texto(formData, "observacao"),
    },
  });
}

export async function marcarAguardandoPagamentoNf(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "aguardando_pagamento_nf",
    permitidoDe: ["compra_fechada", "encaminhado_instituicao"],
    observacao: texto(formData, "observacao") ?? "Aguardando pagamento, emissão de nota ou comprovante.",
    etapa: "Pagamento e documentos fiscais",
    decisao: "registrado",
    extras: { pagamento_nf_em: new Date().toISOString() },
  });
}

export async function concluirCompra(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const supabase = await createClient();
  const { data: anexos } = await supabase
    .from("pedidos_internos_anexos")
    .select("id")
    .eq("pedido_interno_id", pedidoId)
    .in("tipo", ["nota_fiscal", "boleto", "comprovante"])
    .limit(1);
  if (!anexos || anexos.length === 0) {
    return { ok: false, message: "Anexe nota fiscal, boleto ou comprovante antes de concluir." };
  }
  return mudarStatus({
    pedidoId,
    para: "compra_concluida",
    permitidoDe: ["aguardando_pagamento_nf"],
    observacao: texto(formData, "observacao") ?? "Compra concluída com documentos finais registrados.",
    etapa: "Compra concluída",
    decisao: "aprovado",
    extras: { concluido_em: new Date().toISOString() },
  });
}

/**
 * Sincroniza o cache de recebimento do pedido (Etapa 11). O pedido é
 * considerado recebido quando tem itens e todos estão recebidos.
 */
async function sincronizarRecebimentoPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: number,
  responsavel: string | null,
) {
  const { data: itens } = await supabase
    .from("pedidos_internos_itens")
    .select("recebido_em")
    .eq("pedido_interno_id", pedidoId);
  const lista = itens ?? [];
  const tudoRecebido = lista.length > 0 && lista.every((item) => item.recebido_em);
  await supabase
    .from("pedidos_internos")
    .update({
      recebido_em: tudoRecebido ? new Date().toISOString() : null,
      recebido_por: tudoRecebido ? responsavel : null,
    })
    .eq("id", pedidoId);
}

/**
 * Recebimento por item: lança o item em estoque (lote para o insumo
 * correspondente) e marca o item como recebido. Exige um insumo cadastrado —
 * usa o vinculado, um escolhido no recebimento, ou cria um novo pela
 * especificação. Só é permitido após a compra ser aprovada.
 */
export async function receberItemPedidoInterno(_prev: FormState, formData: FormData): Promise<FormState> {
  const itemId = numero(formData, "item_id");
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!itemId || !pedidoId) return { ok: false, message: "Item inválido." };
  const supabase = await createClient();
  const u = await usuarioAtual();

  const { data: item } = await supabase
    .from("pedidos_internos_itens")
    .select("id, insumo_id, quantidade, unidade, especificacao, fornecedor_sugerido, orcamento_previo, recebido_em, pedidos_internos(status, projetos(nome))")
    .eq("id", itemId)
    .eq("pedido_interno_id", pedidoId)
    .single();
  if (!item) return { ok: false, message: "Item não encontrado." };
  if (item.recebido_em) return { ok: true, message: "Item já recebido." };

  const pedido = item.pedidos_internos as unknown as {
    status: string;
    projetos: { nome: string | null } | null;
  } | null;
  if (!pedido || !PEDIDO_INTERNO_AGUARDANDO_CHEGADA.includes(pedido.status as PedidoInternoStatus)) {
    return { ok: false, message: "Só é possível receber itens após a compra ser aprovada." };
  }

  // Resolve o insumo: existente escolhido > novo pela especificação > já vinculado.
  let insumoId = numero(formData, "insumo_id") ?? item.insumo_id;
  const novoInsumo = texto(formData, "novo_insumo");
  const unidadeNovoInsumo = texto(formData, "unidade") ?? item.unidade;
  if (!insumoId && novoInsumo) {
    const novoValidado = validarNovoInsumoRecebimento(formData, novoInsumo, unidadeNovoInsumo);
    if (!novoValidado.ok) return novoValidado;

    const { data: criado, error: insErr } = await supabase
      .from("insumos")
      .insert({
        especificacao: novoInsumo,
        unidade: unidadeNovoInsumo,
        categoria_compra: novoValidado.categoria,
        fator_conversao: novoValidado.fatorConversao,
        custo_unitario: novoValidado.custo,
      })
      .select("id")
      .single();
    if (insErr) return { ok: false, message: `Falha ao criar insumo: ${insErr.message}` };
    insumoId = criado.id;
  }
  if (!insumoId) {
    return { ok: false, message: "Vincule o item a um insumo (ou crie um) para lançar em estoque." };
  }
  const { data: insumoRecebido } = await supabase
    .from("insumos")
    .select("categoria_compra")
    .eq("id", insumoId)
    .single();
  const validade = texto(formData, "validade");
  if (insumoRecebido?.categoria_compra === "critico" && !validade) {
    return { ok: false, message: MSG_VALIDADE_CRITICO };
  }

  const quantidade = numero(formData, "quantidade") ?? Number(item.quantidade);
  if (!(quantidade > 0)) return { ok: false, message: "Quantidade recebida deve ser maior que zero." };
  if (quantidade < Number(item.quantidade)) {
    return { ok: false, message: "Recebimento parcial ainda não é suportado para este fluxo." };
  }
  const custo = numero(formData, "custo") ?? item.orcamento_previo;
  const fornecedor = texto(formData, "fornecedor") ?? item.fornecedor_sugerido;

  const responsavel = u?.nome ?? u?.email ?? null;
  const { error } = await supabase.rpc("receber_item_pedido_interno" as never, {
    p_pedido_id: pedidoId,
    p_item_id: itemId,
    p_insumo_id: insumoId,
    p_quantidade: quantidade,
    p_validade: validade ?? undefined,
    p_custo: custo ?? undefined,
    p_codigo: texto(formData, "codigo") ?? undefined,
    p_fornecedor: fornecedor ?? undefined,
    p_projeto: pedido.projetos?.nome ?? undefined,
    p_responsavel: responsavel ?? undefined,
  } as never);
  if (error) return { ok: false, message: error.message };

  await registrarEvento(
    "pedido_interno",
    pedidoId,
    pedido.status,
    pedido.status,
    `Item recebido e lançado em estoque: ${item.especificacao}.`,
  );
  revalidatePath("/recebimento");
  revalidatePath("/estoque");
  revalidatePath("/pedido");
  revalidatePath(`/pedido/${pedidoId}`);
  return { ok: true, message: "Item recebido e lançado em estoque." };
}

/**
 * Estorna o recebimento de um item: remove o lote gerado (se ainda intacto) e
 * desmarca o item. Bloqueia se o lote já teve consumo, para não corromper o saldo.
 */
export async function estornarRecebimentoItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const itemId = numero(formData, "item_id");
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!itemId || !pedidoId) return { ok: false, message: "Item inválido." };
  const supabase = await createClient();
  const u = await usuarioAtual();

  const { data: item } = await supabase
    .from("pedidos_internos_itens")
    .select("id, lote_id, recebido_em, especificacao, pedidos_internos(status)")
    .eq("id", itemId)
    .eq("pedido_interno_id", pedidoId)
    .single();
  if (!item) return { ok: false, message: "Item não encontrado." };
  if (!item.recebido_em) return { ok: true, message: "Item não estava recebido." };
  const statusAtual = (item.pedidos_internos as unknown as { status: string } | null)?.status ?? "aprovado_para_compra";

  if (item.lote_id) {
    const { data: lote } = await supabase
      .from("lotes_estoque")
      .select("quantidade_inicial, quantidade_atual")
      .eq("id", item.lote_id)
      .single();
    if (lote && Number(lote.quantidade_atual) < Number(lote.quantidade_inicial)) {
      return { ok: false, message: "O lote já teve consumo em estoque; não é possível estornar." };
    }
    await supabase.from("estoque_movimentacoes").delete().eq("lote_id", item.lote_id);
    await supabase.from("lotes_estoque").delete().eq("id", item.lote_id);
  }

  const { error } = await supabase
    .from("pedidos_internos_itens")
    .update({ lote_id: null, recebido_em: null, recebido_por: null })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  await sincronizarRecebimentoPedido(supabase, pedidoId, u?.nome ?? u?.email ?? null);
  await registrarEvento("pedido_interno", pedidoId, statusAtual, statusAtual, `Recebimento estornado: ${item.especificacao}.`);
  revalidatePath("/recebimento");
  revalidatePath("/estoque");
  revalidatePath("/pedido");
  revalidatePath(`/pedido/${pedidoId}`);
  return { ok: true, message: "Recebimento estornado." };
}

export async function adicionarAnexoPedidoInterno(formData: FormData) {
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const titulo = texto(formData, "titulo");
  if (!pedidoId || !titulo) return;
  const u = await usuarioAtual();
  const supabase = await createClient();
  const { data: pedido } = await supabase.from("pedidos_internos").select("status").eq("id", pedidoId).single();
  let { error } = await supabase.from("pedidos_internos_anexos").insert({
    pedido_interno_id: pedidoId,
    etapa: pedido?.status ?? null,
    tipo: texto(formData, "tipo") ?? "outro",
    titulo,
    url: texto(formData, "url"),
    arquivo_nome: texto(formData, "arquivo_nome"),
    storage_bucket: texto(formData, "storage_bucket"),
    storage_path: texto(formData, "storage_path"),
    mime_type: texto(formData, "mime_type"),
    tamanho_bytes: numero(formData, "tamanho_bytes"),
    hash_sha256: texto(formData, "hash_sha256"),
    observacao: texto(formData, "observacao"),
    usuario: u?.email ?? null,
  } as never);
  if (erroSchemaCache(error)) {
    const retry = await supabase.from("pedidos_internos_anexos").insert({
      pedido_interno_id: pedidoId,
      etapa: pedido?.status ?? null,
      tipo: texto(formData, "tipo") ?? "outro",
      titulo,
      url: texto(formData, "url"),
      observacao: texto(formData, "observacao"),
      usuario: u?.email ?? null,
    });
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  revalidatePath(`/pedido/${pedidoId}`);
}

export async function removerAnexoPedidoInterno(formData: FormData) {
  const anexoId = Number(formData.get("anexo_id"));
  const pedidoId = Number(formData.get("pedido_interno_id"));
  if (!anexoId || !pedidoId) return;
  const supabase = await createClient();
  await supabase.from("pedidos_internos_anexos").delete().eq("id", anexoId);
  revalidatePath(`/pedido/${pedidoId}`);
}

export async function registrarComunicacaoPedidoInterno(formData: FormData) {
  const pedidoId = Number(formData.get("pedido_interno_id"));
  if (!pedidoId) return;
  const u = await usuarioAtual();
  const supabase = await createClient();
  const { data: pedido } = await supabase.from("pedidos_internos").select("status").eq("id", pedidoId).single();
  const { error } = await supabase.from("pedidos_internos_comunicacoes").insert({
    pedido_interno_id: pedidoId,
    etapa: pedido?.status ?? null,
    tipo: texto(formData, "tipo") ?? "email",
    remetente: texto(formData, "remetente") ?? "giacompras2025@gmail.com",
    destinatarios: texto(formData, "destinatarios"),
    assunto: texto(formData, "assunto"),
    referencia: texto(formData, "referencia"),
    observacao: texto(formData, "observacao"),
    usuario: u?.email ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/pedido/${pedidoId}`);
}

export async function cancelarPedidoInterno(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const comentario = comentarioObrigatorio(formData);
  if (!comentario.ok) return comentario;
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const u = await usuarioAtual();
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedidoId)
    .single();
  const { error } = await supabase.rpc("cancelar_pedido_interno_operacional" as never, {
    p_pedido_id: pedidoId,
    p_responsavel: u?.nome ?? u?.email ?? null,
    p_observacao: comentario.observacao,
  } as never);
  if (error) return { ok: false, message: error.message };
  await registrarEvento("pedido_interno", pedidoId, atual?.status ?? null, "cancelado", comentario.observacao);
  revalidatePath("/pedido");
  revalidatePath(`/pedido/${pedidoId}`);
  revalidatePath("/compras");
  return { ok: true, message: "Pedido cancelado com sincronização operacional." };
}
