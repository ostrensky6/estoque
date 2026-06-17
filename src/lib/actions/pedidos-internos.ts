"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  const { error } = await supabase
    .from("pedidos_internos")
    .update({ status: para, ...extras })
    .eq("id", pedidoId);
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pedidos_internos")
    .insert({
      titulo,
      projeto_id,
      data_necessidade,
      justificativa,
      urgencia,
      fonte_recurso,
      solicitante: u?.email ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await registrarEvento("pedido_interno", data.id, null, "rascunho", "Demanda inicial registrada.");
  redirect(`/pedido/${data.id}`);
}

export async function atualizarPedidoInterno(formData: FormData) {
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!pedidoId) return;
  const titulo = texto(formData, "titulo");
  if (!titulo) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos_internos")
    .update({
      titulo,
      projeto_id: numero(formData, "projeto_id"),
      data_necessidade: texto(formData, "data_necessidade"),
      urgencia: texto(formData, "urgencia") ?? "normal",
      fonte_recurso: texto(formData, "fonte_recurso"),
      justificativa: texto(formData, "justificativa"),
    })
    .eq("id", pedidoId);
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
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "validado",
    permitidoDe: ["em_validacao"],
    observacao: texto(formData, "observacao") ?? "Informações de modelo, volume e quantidade confirmadas.",
    etapa: "Validação das especificações técnicas",
    decisao: "aprovado",
    extras: { validado_em: new Date().toISOString() },
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
      .select("insumo_id, quantidade, orcamento_previo, especificacao, observacao")
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
    const { error: itensErr } = await supabase.from("pedidos_compra_itens").insert(
      itensComInsumo.map((item) => ({
        pedido_id: compra.id,
        insumo_id: item.insumo_id as number,
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
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "compra_fechada",
    permitidoDe: ["aprovado_para_compra"],
    observacao: texto(formData, "observacao") ?? "Compra fechada com fornecedor; documentos enviados por e-mail.",
    etapa: "Fechamento da compra",
    decisao: "aprovado",
    extras: { fechado_em: new Date().toISOString() },
  });
}

export async function encaminharInstituicao(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "encaminhado_instituicao",
    permitidoDe: ["aprovado_para_compra"],
    observacao:
      texto(formData, "observacao") ??
      "Documentos, orçamentos e termos encaminhados para a instituição responsável pela compra.",
    etapa: "Envio de documentos para instituição compradora",
    decisao: "aprovado",
    extras: { encaminhado_em: new Date().toISOString() },
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
  if (!insumoId && novoInsumo) {
    const { data: criado, error: insErr } = await supabase
      .from("insumos")
      .insert({ especificacao: novoInsumo, unidade: texto(formData, "unidade") ?? item.unidade })
      .select("id")
      .single();
    if (insErr) return { ok: false, message: `Falha ao criar insumo: ${insErr.message}` };
    insumoId = criado.id;
  }
  if (!insumoId) {
    return { ok: false, message: "Vincule o item a um insumo (ou crie um) para lançar em estoque." };
  }

  const quantidade = numero(formData, "quantidade") ?? Number(item.quantidade);
  if (!(quantidade > 0)) return { ok: false, message: "Quantidade recebida deve ser maior que zero." };
  const custo = numero(formData, "custo") ?? item.orcamento_previo;
  const fornecedor = texto(formData, "fornecedor") ?? item.fornecedor_sugerido;

  const { data: loteId, error: loteErr } = await supabase.rpc("receber_lote", {
    p_insumo_id: insumoId,
    p_quantidade: quantidade,
    p_validade: texto(formData, "validade") ?? undefined,
    p_custo: custo ?? undefined,
    p_codigo: texto(formData, "codigo") ?? undefined,
    p_fornecedor: fornecedor ?? undefined,
    p_projeto: pedido.projetos?.nome ?? undefined,
  });
  if (loteErr) return { ok: false, message: loteErr.message };

  const responsavel = u?.nome ?? u?.email ?? null;
  const { error } = await supabase
    .from("pedidos_internos_itens")
    .update({
      insumo_id: insumoId,
      lote_id: loteId as number,
      recebido_em: new Date().toISOString(),
      recebido_por: responsavel,
    })
    .eq("id", itemId);
  if (error) return { ok: false, message: error.message };

  await sincronizarRecebimentoPedido(supabase, pedidoId, responsavel);
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
  const { error } = await supabase.from("pedidos_internos_anexos").insert({
    pedido_interno_id: pedidoId,
    etapa: pedido?.status ?? null,
    tipo: texto(formData, "tipo") ?? "outro",
    titulo,
    url: texto(formData, "url"),
    observacao: texto(formData, "observacao"),
    usuario: u?.email ?? null,
  });
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
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "cancelado",
    observacao: comentario.observacao,
    etapa: "Cancelamento",
    decisao: "reprovado",
  });
}
