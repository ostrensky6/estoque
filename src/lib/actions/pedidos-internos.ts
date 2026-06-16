"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { registrarEvento } from "./eventos";
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

async function mudarStatus({
  pedidoId,
  para,
  permitidoDe,
  observacao,
  extras = {},
}: {
  pedidoId: number;
  para: string;
  permitidoDe?: string[];
  observacao?: string | null;
  extras?: Record<string, unknown>;
}) {
  const supabase = await createClient();
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

  await registrarEvento("pedido_interno", pedidoId, atual.status, para, observacao);
  revalidatePath("/pedido");
  revalidatePath(`/pedido/${pedidoId}`);
  return { ok: true, message: "Etapa atualizada." };
}

export async function criarPedidoInterno(formData: FormData) {
  const u = await usuarioAtual();
  const titulo = texto(formData, "titulo") ?? "Pedido interno sem título";
  const projeto_id = numero(formData, "projeto_id");
  const planejamento_id = numero(formData, "planejamento_id");
  const data_necessidade = texto(formData, "data_necessidade");
  const justificativa = texto(formData, "justificativa");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("pedidos_internos")
    .insert({
      titulo,
      projeto_id,
      planejamento_id,
      data_necessidade,
      justificativa,
      solicitante: u?.email ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await registrarEvento("pedido_interno", data.id, null, "rascunho", "Demanda inicial registrada.");
  redirect(`/pedido/${data.id}`);
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

export async function removerItemPedidoInterno(formData: FormData) {
  const itemId = numero(formData, "item_id");
  const pedidoId = numero(formData, "pedido_interno_id");
  if (!itemId || !pedidoId) return;
  const supabase = await createClient();
  await supabase.from("pedidos_internos_itens").delete().eq("id", itemId);
  revalidatePath(`/pedido/${pedidoId}`);
}

export async function enviarParaValidacao(_prev: FormState, formData: FormData): Promise<FormState> {
  const pedidoId = Number(formData.get("pedido_interno_id"));
  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("pedidos_internos_itens")
    .select("id")
    .eq("pedido_interno_id", pedidoId)
    .limit(1);
  if (!itens || itens.length === 0) {
    return { ok: false, message: "Inclua ao menos um material ou serviço antes de enviar." };
  }
  return mudarStatus({
    pedidoId,
    para: "em_validacao",
    permitidoDe: ["rascunho", "ajuste_solicitante", "ajuste_compras"],
    observacao: texto(formData, "observacao"),
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
    extras: { validado_em: new Date().toISOString() },
  });
}

export async function devolverParaSolicitante(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "ajuste_solicitante",
    permitidoDe: ["em_validacao"],
    observacao: texto(formData, "observacao") ?? "Compra não aprovada nesta validação.",
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
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("pedidos_internos")
    .select("status")
    .eq("id", pedidoId)
    .single();
  if (atual?.status !== "formalizado") return;

  const { error } = await supabase
    .from("pedidos_internos")
    .update({
      fonte_recurso: texto(formData, "fonte_recurso"),
      rubrica: texto(formData, "rubrica"),
      conformidade_admin: texto(formData, "conformidade_admin"),
      observacao_compras: observacao,
      status: "analise_administrativa",
      analisado_em: new Date().toISOString(),
    })
    .eq("id", pedidoId)
    .eq("status", "formalizado");
  if (error) throw new Error(error.message);
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
  });
}

export async function devolverParaCompras(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "ajuste_compras",
    permitidoDe: ["analise_administrativa"],
    observacao: texto(formData, "observacao") ?? "Compra não aprovada na análise administrativa.",
  });
}

export async function registrarLevantamentoOrcamentos(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "orcamentos",
    permitidoDe: ["aprovado_compra"],
    observacao: texto(formData, "observacao") ?? "Orçamentos levantados com especificações dos projetos.",
    extras: { orcamentos_em: new Date().toISOString() },
  });
}

export async function fecharComFornecedor(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "compra_fechada",
    permitidoDe: ["orcamentos"],
    observacao: texto(formData, "observacao") ?? "Compra fechada com fornecedor; documentos enviados por e-mail.",
    extras: { fechado_em: new Date().toISOString() },
  });
}

export async function encaminharInstituicao(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "encaminhado_instituicao",
    permitidoDe: ["orcamentos"],
    observacao:
      texto(formData, "observacao") ??
      "Documentos, orçamentos e termos encaminhados para a instituição responsável pela compra.",
    extras: { encaminhado_em: new Date().toISOString() },
  });
}

export async function cancelarPedidoInterno(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  return mudarStatus({
    pedidoId: Number(formData.get("pedido_interno_id")),
    para: "cancelado",
    observacao: texto(formData, "observacao") ?? "Pedido interno cancelado.",
  });
}
