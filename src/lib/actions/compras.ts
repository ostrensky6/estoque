"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import type { FormState } from "./cadastros";

const SEM_PERMISSAO: FormState = {
  ok: false,
  message: "Sem permissão — requer papel coordenador ou superior.",
};

export async function criarPedido(formData: FormData) {
  const u = await usuarioAtual();
  const fornecedor_id = formData.get("fornecedor_id")
    ? Number(formData.get("fornecedor_id"))
    : null;
  const projeto = (formData.get("projeto") as string)?.trim() || null;
  const supabase = await createClientUntyped();
  const { data, error } = await supabase
    .from("pedidos_compra")
    .insert({ fornecedor_id, projeto, solicitante: u?.email ?? null, status: "solicitado" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/compras/${data.id}`);
}

export async function adicionarItemPedido(formData: FormData) {
  const pedido_id = Number(formData.get("pedido_id"));
  const insumo_id = Number(formData.get("insumo_id"));
  const quantidade = Number(formData.get("quantidade"));
  const custo = formData.get("custo_unitario_estimado")
    ? Number(formData.get("custo_unitario_estimado"))
    : null;
  if (!pedido_id || !insumo_id || !(quantidade > 0)) return;
  const supabase = await createClientUntyped();
  await supabase.from("pedidos_compra_itens").insert({
    pedido_id,
    insumo_id,
    quantidade,
    custo_unitario_estimado: custo,
  });
  revalidatePath(`/compras/${pedido_id}`);
}

export async function removerItemPedido(formData: FormData) {
  const id = Number(formData.get("item_id"));
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClientUntyped();
  await supabase.from("pedidos_compra_itens").delete().eq("id", id);
  revalidatePath(`/compras/${pedido_id}`);
}

export async function aprovarPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const u = await usuarioAtual();
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClientUntyped();

  // prazo previsto a partir do fornecedor
  const { data: ped } = await supabase
    .from("pedidos_compra")
    .select("fornecedor_id, fornecedores(prazo_medio_dias)")
    .eq("id", pedido_id)
    .single();
  const prazo = (ped?.fornecedores as unknown as { prazo_medio_dias: number | null } | null)
    ?.prazo_medio_dias;
  const prevista = prazo
    ? new Date(Date.now() + prazo * 86400000).toISOString().slice(0, 10)
    : null;

  const { error } = await supabase
    .from("pedidos_compra")
    .update({
      status: "aprovado",
      aprovador: u?.email ?? null,
      data_aprovacao: new Date().toISOString().slice(0, 10),
      data_prevista_entrega: prevista,
    })
    .eq("id", pedido_id)
    .eq("status", "solicitado");
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/compras/${pedido_id}`);
  return { ok: true, message: "Pedido aprovado." };
}

export async function marcarEnviado(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClientUntyped();
  const { error } = await supabase
    .from("pedidos_compra")
    .update({ status: "enviado" })
    .eq("id", pedido_id)
    .in("status", ["aprovado"]);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/compras/${pedido_id}`);
  return { ok: true, message: "Pedido marcado como enviado." };
}

export async function cancelarPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClientUntyped();
  const { error } = await supabase
    .from("pedidos_compra")
    .update({ status: "cancelado" })
    .eq("id", pedido_id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/compras/${pedido_id}`);
  return { ok: true, message: "Pedido cancelado." };
}

/** Recebe um item do pedido: cria lote em quarentena (FEFO) e vincula. */
export async function receberItemPedido(formData: FormData) {
  if (!(await temPapel("coordenador"))) return;
  const pedido_id = Number(formData.get("pedido_id"));
  const item_id = Number(formData.get("item_id"));
  const validade = (formData.get("validade") as string) || null;
  const codigo = (formData.get("codigo") as string) || null;
  const supabase = await createClientUntyped();

  const { data: item } = await supabase
    .from("pedidos_compra_itens")
    .select("insumo_id, quantidade, custo_unitario_estimado, pedido_id, lote_id, pedidos_compra(projeto, fornecedores(nome))")
    .eq("id", item_id)
    .single();
  if (!item || item.lote_id) return;

  const ped = item.pedidos_compra as unknown as {
    projeto: string | null;
    fornecedores: { nome: string | null } | null;
  } | null;
  const fornecedor = ped?.fornecedores?.nome ?? null;
  const projeto = ped?.projeto ?? null;

  const { data: loteId, error } = await supabase.rpc("receber_lote", {
    p_insumo_id: item.insumo_id,
    p_quantidade: item.quantidade,
    p_validade: validade ?? undefined,
    p_custo: item.custo_unitario_estimado ?? undefined,
    p_codigo: codigo ?? undefined,
    p_fornecedor: fornecedor ?? undefined,
    p_projeto: projeto ?? undefined,
  });
  if (error) throw new Error(error.message);

  await supabase.from("pedidos_compra_itens").update({ lote_id: loteId }).eq("id", item_id);

  // se todos os itens foram recebidos, marca o pedido como recebido
  const { data: pendentes } = await supabase
    .from("pedidos_compra_itens")
    .select("id")
    .eq("pedido_id", pedido_id)
    .is("lote_id", null);
  if (!pendentes || pendentes.length === 0) {
    await supabase.from("pedidos_compra").update({ status: "recebido" }).eq("id", pedido_id);
  }

  revalidatePath(`/compras/${pedido_id}`);
  revalidatePath("/estoque");
}
