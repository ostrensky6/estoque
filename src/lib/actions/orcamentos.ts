"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClientUntyped } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";

/** Cria um orçamento em rascunho e abre a tela de edição. */
export async function criarOrcamento(formData: FormData) {
  const cliente_nome =
    String(formData.get("cliente_nome") ?? "").trim() || "Cliente sem nome";
  const supabase = await createClientUntyped();
  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ cliente_nome })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/orcamento/${data.id}`);
}

/** Salva o cabeçalho (cliente/projeto + dados) do orçamento. Se um cliente
 *  cadastrado for vinculado, os dados do documento são preenchidos a partir dele. */
export async function salvarCabecalho(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  if (!id) return;
  const supabase = await createClientUntyped();

  const cliente_id = formData.get("cliente_id") ? Number(formData.get("cliente_id")) : null;
  const projeto_id = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;

  // dados do documento — por padrão vêm dos campos de texto
  let cliente_nome = String(formData.get("cliente_nome") ?? "").trim() || "Cliente sem nome";
  let cliente_cnpj = (formData.get("cliente_cnpj") as string)?.trim() || null;
  let cliente_endereco = (formData.get("cliente_endereco") as string)?.trim() || null;
  let cliente_contato = (formData.get("cliente_contato") as string)?.trim() || null;

  // se vinculado a um cliente cadastrado, o documento reflete o cadastro
  if (cliente_id) {
    const { data: c } = await supabase
      .from("clientes")
      .select("nome, cnpj, endereco, contato, email, telefone")
      .eq("id", cliente_id)
      .single();
    if (c) {
      cliente_nome = c.nome;
      cliente_cnpj = c.cnpj;
      cliente_endereco = c.endereco;
      cliente_contato = c.contato || c.email || c.telefone;
    }
  }

  const patch = {
    cliente_id,
    projeto_id,
    cliente_nome,
    cliente_cnpj,
    cliente_endereco,
    cliente_contato,
    data_orcamento: (formData.get("data_orcamento") as string) || null,
    validade_dias: Number(formData.get("validade_dias")) || 30,
    responsavel: (formData.get("responsavel") as string)?.trim() || null,
    observacoes: (formData.get("observacoes") as string)?.trim() || null,
    status: (formData.get("status") as string) || "rascunho",
  };
  const { error } = await supabase.from("orcamentos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamento/${id}`);
  revalidatePath("/orcamento");
}

/** Adiciona uma análise solicitada, gravando o snapshot de custo/preço atual. */
export async function adicionarItemOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const n = Number(formData.get("n_amostras"));
  if (!id || !codigo || !(n > 0)) return;

  const { breakdowns } = await calcularTodas();
  const b = breakdowns.find((x) => x.codigo === codigo);

  const supabase = await createClientUntyped();
  await supabase.from("orcamento_itens").insert({
    orcamento_id: id,
    codigo_analise: codigo,
    n_amostras: n,
    custo_unitario: b?.custoTotal ?? 0,
    preco_unitario: b?.preco ?? 0,
  });
  revalidatePath(`/orcamento/${id}`);
}

export async function removerItemOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const itemId = Number(formData.get("item_id"));
  if (!itemId) return;
  const supabase = await createClientUntyped();
  await supabase.from("orcamento_itens").delete().eq("id", itemId);
  revalidatePath(`/orcamento/${id}`);
}

/** Reatualiza os snapshots de custo/preço dos itens com os parâmetros atuais. */
export async function recalcularOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  if (!id) return;
  const supabase = await createClientUntyped();
  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("id, codigo_analise")
    .eq("orcamento_id", id);
  const { breakdowns } = await calcularTodas();
  for (const it of itens ?? []) {
    const b = breakdowns.find((x) => x.codigo === it.codigo_analise);
    if (!b) continue;
    await supabase
      .from("orcamento_itens")
      .update({ custo_unitario: b.custoTotal, preco_unitario: b.preco })
      .eq("id", it.id);
  }
  revalidatePath(`/orcamento/${id}`);
}

export async function excluirOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const supabase = await createClientUntyped();
  await supabase.from("orcamentos").delete().eq("id", id);
  revalidatePath("/orcamento");
  redirect("/orcamento");
}
