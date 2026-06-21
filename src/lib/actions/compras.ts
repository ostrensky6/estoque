"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { computarDemandaPlano } from "@/lib/costing/demanda";
import { registrarEvento } from "./eventos";
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
  const projeto_id = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pedidos_compra")
    .insert({ fornecedor_id, projeto, projeto_id, solicitante: u?.email ?? null, status: "solicitado" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/compras/${data.id}`);
}

export async function gerarRascunhosReposicao(_prev: FormState): Promise<FormState> {
  void _prev;
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gerar_reposicao_automatica");
  if (error) return { ok: false, message: error.message };

  const resultado = data as {
    pedidos_criados?: number;
    itens_criados?: number;
    notificacoes_criadas?: number;
  } | null;
  revalidatePath("/compras");
  revalidatePath("/estoque");
  revalidatePath("/notificacoes");
  revalidatePath("/");
  return {
    ok: true,
    message: `${resultado?.pedidos_criados ?? 0} rascunho(s), ${resultado?.itens_criados ?? 0} item(ns) de reposição e ${resultado?.notificacoes_criadas ?? 0} notificação(ões) gerados.`,
  };
}

/**
 * 2.3 — Falta do plano → pedido de compra. Gera pedido(s) pré-preenchidos com
 * os insumos em falta: quantidade sugerida = falta + estoque de segurança,
 * agrupados pelo fornecedor principal de cada insumo. Um pedido por fornecedor.
 */
export async function comprarFaltasDoPlano(formData: FormData) {
  const planId = Number(formData.get("planejamento_id"));
  if (!planId) return;
  const supabase = await createClient();
  const u = await usuarioAtual();

  const demanda = await computarDemandaPlano(supabase, planId);
  const faltas = demanda.filter((d) => d.falta > 0);
  if (faltas.length === 0)
    throw new Error("Este plano não tem faltas para comprar.");

  const [{ data: plano }, { data: insumos }] = await Promise.all([
    supabase.from("planejamento").select("projeto_id").eq("id", planId).single(),
    supabase
      .from("insumos")
      .select("id, fornecedor_id, estoque_seguranca, custo_unitario")
      .in("id", faltas.map((f) => f.insumo_id)),
  ]);
  const infoMap = new Map((insumos ?? []).map((i) => [i.id, i]));

  // agrupa as faltas pelo fornecedor principal (null = sem fornecedor definido)
  const porFornecedor = new Map<
    number | null,
    { insumo_id: number; quantidade: number; custo: number | null }[]
  >();
  for (const f of faltas) {
    const info = infoMap.get(f.insumo_id);
    const fornecedor = info?.fornecedor_id ?? null;
    const quantidade = f.falta + Number(info?.estoque_seguranca ?? 0);
    const arr = porFornecedor.get(fornecedor) ?? [];
    arr.push({ insumo_id: f.insumo_id, quantidade, custo: info?.custo_unitario ?? null });
    porFornecedor.set(fornecedor, arr);
  }

  let primeiroPedidoId: number | null = null;
  for (const [fornecedor, itens] of porFornecedor) {
    const { data: pedido, error } = await supabase
      .from("pedidos_compra")
      .insert({
        fornecedor_id: fornecedor,
        projeto_id: plano?.projeto_id ?? null,
        solicitante: u?.email ?? null,
        status: "solicitado",
        observacao: `Gerado das faltas do planejamento #${planId}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    primeiroPedidoId ??= pedido.id;

    const { error: itensErr } = await supabase.from("pedidos_compra_itens").insert(
      itens.map((it) => ({
        pedido_id: pedido.id,
        insumo_id: it.insumo_id,
        quantidade: it.quantidade,
        custo_unitario_estimado: it.custo,
      })),
    );
    if (itensErr) throw new Error(itensErr.message);
  }

  revalidatePath("/compras");
  revalidatePath(`/planejamento/${planId}`);
  redirect(porFornecedor.size === 1 && primeiroPedidoId ? `/compras/${primeiroPedidoId}` : "/compras");
}

export async function adicionarItemPedido(formData: FormData) {
  const pedido_id = Number(formData.get("pedido_id"));
  const insumo_id = Number(formData.get("insumo_id"));
  const quantidade = Number(formData.get("quantidade"));
  const custo = formData.get("custo_unitario_estimado")
    ? Number(formData.get("custo_unitario_estimado"))
    : null;
  if (!pedido_id || !insumo_id || !(quantidade > 0)) return;
  const supabase = await createClient();
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
  const supabase = await createClient();
  await supabase.from("pedidos_compra_itens").delete().eq("id", id);
  revalidatePath(`/compras/${pedido_id}`);
}

export async function aprovarPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const u = await usuarioAtual();
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClient();

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
  await registrarEvento("pedido_compra", pedido_id, "solicitado", "aprovado");
  revalidatePath(`/compras/${pedido_id}`);
  return { ok: true, message: "Pedido aprovado." };
}

export async function marcarEnviado(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos_compra")
    .update({ status: "enviado" })
    .eq("id", pedido_id)
    .in("status", ["aprovado"]);
  if (error) return { ok: false, message: error.message };
  await registrarEvento("pedido_compra", pedido_id, "aprovado", "enviado");
  revalidatePath(`/compras/${pedido_id}`);
  return { ok: true, message: "Pedido marcado como enviado." };
}

export async function cancelarPedido(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("coordenador"))) return SEM_PERMISSAO;
  const pedido_id = Number(formData.get("pedido_id"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("pedidos_compra")
    .update({ status: "cancelado" })
    .eq("id", pedido_id);
  if (error) return { ok: false, message: error.message };
  await registrarEvento("pedido_compra", pedido_id, null, "cancelado");
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
  const quantidadeRecebida = formData.get("quantidade_recebida")
    ? Number(formData.get("quantidade_recebida"))
    : null;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("pedidos_compra_itens")
    .select("insumo_id, quantidade, custo_unitario_estimado, pedido_id, lote_id, insumos(categoria_compra), pedidos_compra(projeto, fornecedores(nome))")
    .eq("id", item_id)
    .single();
  if (!item || item.lote_id) return;
  const quantidade = quantidadeRecebida && quantidadeRecebida > 0 ? quantidadeRecebida : Number(item.quantidade);
  const insumo = item.insumos as { categoria_compra: string | null } | null;
  if (insumo?.categoria_compra === "critico" && !validade) {
    throw new Error("Validade é obrigatória para receber insumo crítico.");
  }

  const ped = item.pedidos_compra as unknown as {
    projeto: string | null;
    fornecedores: { nome: string | null } | null;
  } | null;
  const fornecedor = ped?.fornecedores?.nome ?? null;
  const projeto = ped?.projeto ?? null;

  const { data: loteId, error } = await supabase.rpc("receber_lote", {
    p_insumo_id: item.insumo_id,
    p_quantidade: quantidade,
    p_validade: validade ?? undefined,
    p_custo: item.custo_unitario_estimado ?? undefined,
    p_codigo: codigo ?? undefined,
    p_fornecedor: fornecedor ?? undefined,
    p_projeto: projeto ?? undefined,
  });
  if (error) throw new Error(error.message);

  await supabase
    .from("pedidos_compra_itens")
    .update({
      lote_id: loteId,
      quantidade_recebida: quantidade,
      divergencia_recebimento:
        quantidade !== Number(item.quantidade)
          ? `Pedido: ${item.quantidade}; recebido: ${quantidade}`
          : null,
    } as never)
    .eq("id", item_id);

  // se todos os itens foram recebidos, marca o pedido como recebido
  const { data: pendentes } = await supabase
    .from("pedidos_compra_itens")
    .select("id")
    .eq("pedido_id", pedido_id)
    .is("lote_id", null);
  if (!pendentes || pendentes.length === 0) {
    await supabase.from("pedidos_compra").update({ status: "recebido" }).eq("id", pedido_id);
    await registrarEvento("pedido_compra", pedido_id, null, "recebido", "Todos os itens recebidos");
  }

  revalidatePath(`/compras/${pedido_id}`);
  revalidatePath("/estoque");
}
