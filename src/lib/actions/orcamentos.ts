"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { registrarVersaoParametrosEconomicos } from "@/lib/orcamento/parametros-versionamento";
import {
  montarSnapshotLaboratorio,
  statusOperacionalLaboratorio,
  type ItemLaboratorioOperacional,
} from "@/lib/orcamento/laboratorio-operacional";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import {
  assegurarAnaliseLiberada,
  assegurarAnalisesLiberadas,
} from "@/lib/cadastros/guard-custeio";
import { registrarEvento } from "./eventos";

export type ParametrosEconomicosState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

const parametroNumero = (opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number({ error: "Obrigatório" })
      .refine((n) => !Number.isNaN(n), "Número inválido")
      .refine((n) => opts.min == null || n >= opts.min, `Mínimo ${opts.min}`)
      .refine((n) => opts.max == null || n <= opts.max, `Máximo ${opts.max}`),
  );

const parametrosEconomicosSchema = z.object({
  dias_uteis_ano: parametroNumero({ min: 1 }),
  margem_lucro: parametroNumero({ min: 0, max: 100 }),
  impostos: parametroNumero({ min: 0, max: 100 }),
  taxas: parametroNumero({ min: 0, max: 100 }),
  fundo_reserva: parametroNumero({ min: 0, max: 100 }),
  fundo_investimento: parametroNumero({ min: 0, max: 100 }),
});

const PARAMETROS_META: Record<
  keyof z.infer<typeof parametrosEconomicosSchema>,
  { unidade: string; descricao: string }
> = {
  dias_uteis_ano: {
    unidade: "dias",
    descricao: "Dias úteis/ano para rateio de equipamentos",
  },
  margem_lucro: {
    unidade: "%",
    descricao: "Margem de lucro sobre o custo total",
  },
  impostos: {
    unidade: "%",
    descricao: "Impostos sobre a venda",
  },
  taxas: {
    unidade: "%",
    descricao: "Taxas administrativas",
  },
  fundo_reserva: {
    unidade: "%",
    descricao: "Fundo de reserva",
  },
  fundo_investimento: {
    unidade: "%",
    descricao: "Fundo de investimento",
  },
};

async function atualizarOperacionalLaboratorio(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: number,
  statusDocumento?: string | null,
) {
  const [{ data: orc }, { data: itens }, { breakdowns }] = await Promise.all([
    supabase.from("orcamentos").select("status").eq("id", id).single(),
    supabase
      .from("orcamento_itens")
      .select("codigo_analise, n_amostras, custo_unitario, preco_unitario")
      .eq("orcamento_id", id),
    calcularTodas(),
  ]);
  const status = statusOperacionalLaboratorio({
    statusDocumento: statusDocumento ?? orc?.status,
    quantidadeItens: itens?.length ?? 0,
  });
  const snapshot = montarSnapshotLaboratorio((itens ?? []) as ItemLaboratorioOperacional[], breakdowns);
  await supabase.from("orcamentos").update({
    status_operacional: status,
    status_operacional_atualizado_em: new Date().toISOString(),
    custo_snapshot: snapshot,
  }).eq("id", id);
}

/** Cria um orçamento em rascunho e abre a tela de edição. */
export async function criarOrcamento(formData: FormData) {
  const demandaId = formData.get("demanda_id") ? Number(formData.get("demanda_id")) : null;
  if (!demandaId) {
    redirect("/orcamento/demandas");
  }

  const tipo = String(formData.get("tipo") ?? "analises");
  const cliente_nome =
    String(formData.get("cliente_nome") ?? "").trim() || "Cliente sem nome";
  const projeto_id = formData.get("projeto_id") ? Number(formData.get("projeto_id")) : null;
  const supabase = await createClient();

  if (tipo === "projeto" || tipo === "analises_projeto") {
    const titulo =
      String(formData.get("titulo") ?? "").trim() ||
      (tipo === "analises_projeto" ? `Projeto com análises - ${cliente_nome}` : `Projeto - ${cliente_nome}`);
    const { data, error } = await supabase
      .from("orcamento_projetos")
      .insert({
        demanda_id: demandaId,
        projeto_id,
        titulo,
        cliente_nome,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    redirect(`/orcamento/projetos/${data.id}`);
  }

  const { data, error } = await supabase
    .from("orcamentos")
    .insert({ demanda_id: demandaId, cliente_nome, projeto_id, tipo: "analises" })
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
  const supabase = await createClient();

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

  const novoStatus = (formData.get("status") as string) || "rascunho";
  const { data: anterior } = await supabase
    .from("orcamentos")
    .select("status")
    .eq("id", id)
    .single();
  if (anterior && anterior.status !== novoStatus && ["enviado", "aprovado", "cancelado"].includes(novoStatus)) {
    await exigirPapelOrcamento("revisar_modulo");
    // Revisão do módulo laboratorial: não permite avançar com análise bloqueada
    // (cancelamento é exceção — só desativa o documento).
    if (novoStatus !== "cancelado") {
      const { data: itens } = await supabase
        .from("orcamento_itens")
        .select("codigo_analise")
        .eq("orcamento_id", id);
      await assegurarAnalisesLiberadas((itens ?? []).map((it) => it.codigo_analise));
    }
  }

  const patch = {
    cliente_id,
    projeto_id,
    cliente_nome,
    cliente_cnpj,
    cliente_endereco,
    cliente_contato,
    data_orcamento: (formData.get("data_orcamento") as string) || undefined,
    validade_dias: Number(formData.get("validade_dias")) || 30,
    responsavel: (formData.get("responsavel") as string)?.trim() || null,
    observacoes: (formData.get("observacoes") as string)?.trim() || null,
    status: novoStatus,
  };
  const { error } = await supabase.from("orcamentos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  if (anterior && anterior.status !== novoStatus) {
    await registrarEvento("orcamento", id, anterior.status, novoStatus);
  }
  await atualizarOperacionalLaboratorio(supabase, id, novoStatus);
  revalidatePath(`/orcamento/${id}`);
  revalidatePath("/orcamento");
}

/** Adiciona uma análise solicitada, gravando o snapshot de custo/preço atual. */
export async function adicionarItemOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const n = Number(formData.get("n_amostras"));
  if (!id || !codigo || !(n > 0)) return;

  // Trava de integridade: análise BLOQUEADA não entra sem override justificado.
  await assegurarAnaliseLiberada({
    codigo,
    override: { justificativa: String(formData.get("override_justificativa") ?? "") },
    auditoria: { entidade: "orcamento", entidadeId: id },
  });

  const { breakdowns } = await calcularTodas();
  const b = breakdowns.find((x) => x.codigo === codigo);

  const supabase = await createClient();
  await supabase.from("orcamento_itens").insert({
    orcamento_id: id,
    codigo_analise: codigo,
    n_amostras: n,
    custo_unitario: b?.custoTotal ?? 0,
    preco_unitario: b?.preco ?? 0,
  });
  await atualizarOperacionalLaboratorio(supabase, id);
  revalidatePath(`/orcamento/${id}`);
}

export async function removerItemOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const itemId = Number(formData.get("item_id"));
  if (!itemId) return;
  const supabase = await createClient();
  await supabase.from("orcamento_itens").delete().eq("id", itemId);
  await atualizarOperacionalLaboratorio(supabase, id);
  revalidatePath(`/orcamento/${id}`);
}

/** Reatualiza os snapshots de custo/preço dos itens com os parâmetros atuais. */
export async function recalcularOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  if (!id) return;
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("orcamentos")
    .select("status")
    .eq("id", id)
    .single();
  if (atual && ["enviado", "aprovado", "cancelado"].includes(atual.status)) {
    await exigirPapelOrcamento("recalcular_custos");
    const motivo = String(formData.get("motivo") ?? "").trim();
    if (!motivo) {
      throw new Error("Recalcular orçamento enviado, aprovado ou cancelado exige motivo.");
    }
  }
  const { data: itens } = await supabase
    .from("orcamento_itens")
    .select("id, codigo_analise")
    .eq("orcamento_id", id);
  // Recálculo é bloqueado se algum item está bloqueado (custo zero silencioso).
  await assegurarAnalisesLiberadas((itens ?? []).map((it) => it.codigo_analise));
  const { breakdowns } = await calcularTodas();
  for (const it of itens ?? []) {
    const b = breakdowns.find((x) => x.codigo === it.codigo_analise);
    if (!b) continue;
    await supabase
      .from("orcamento_itens")
      .update({ custo_unitario: b.custoTotal, preco_unitario: b.preco })
      .eq("id", it.id);
  }
  await atualizarOperacionalLaboratorio(supabase, id);
  await registrarEvento(
    "orcamento",
    id,
    atual?.status ?? null,
    atual?.status ?? "recalculado",
    String(formData.get("motivo") ?? "").trim() || "Recalculo de snapshots laboratoriais.",
  );
  revalidatePath(`/orcamento/${id}`);
}

export async function excluirOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("orcamentos")
    .select("status")
    .eq("id", id)
    .single();

  if (atual && ["enviado", "aprovado"].includes(atual.status)) {
    redirect(`/orcamento/${id}?erro_exclusao=${encodeURIComponent("Orçamento enviado ou aprovado não pode ser excluído. Use cancelamento/versionamento quando disponível.")}`);
  }

  await supabase.from("orcamentos").delete().eq("id", id);
  revalidatePath("/orcamento");
  redirect("/orcamento");
}

export async function cancelarOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  if (!id) return;
  const motivo = String(formData.get("motivo") ?? "").trim() || "Cancelamento operacional.";
  await exigirPapelOrcamento("cancelar_documento");
  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("orcamentos")
    .select("status")
    .eq("id", id)
    .single();
  if (!atual || atual.status === "cancelado") return;

  const { error } = await supabase.from("orcamentos").update({ status: "cancelado" }).eq("id", id);
  if (error) throw new Error(error.message);
  await atualizarOperacionalLaboratorio(supabase, id, "cancelado");
  await registrarEvento("orcamento", id, atual.status, "cancelado", motivo);
  revalidatePath(`/orcamento/${id}`);
  revalidatePath("/orcamento");
  redirect(`/orcamento/${id}`);
}

export async function salvarParametrosEconomicos(
  _prev: ParametrosEconomicosState,
  formData: FormData,
): Promise<ParametrosEconomicosState> {
  const parsed = parametrosEconomicosSchema.safeParse({
    dias_uteis_ano: formData.get("dias_uteis_ano"),
    margem_lucro: formData.get("margem_lucro"),
    impostos: formData.get("impostos"),
    taxas: formData.get("taxas"),
    fundo_reserva: formData.get("fundo_reserva"),
    fundo_investimento: formData.get("fundo_investimento"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = String(issue.path[0] ?? "");
      if (path && !errors[path]) errors[path] = issue.message;
    }
    return { ok: false, message: "Verifique os campos destacados.", errors };
  }
  await exigirPapelOrcamento("editar_parametros");

  const supabase = await createClient();
  const atualizado_em = new Date().toISOString();
  const rows = Object.entries(parsed.data).map(([chave, valor]) => ({
    chave,
    valor,
    unidade: PARAMETROS_META[chave as keyof typeof PARAMETROS_META].unidade,
    descricao: PARAMETROS_META[chave as keyof typeof PARAMETROS_META].descricao,
    atualizado_em,
  }));

  const { error } = await supabase.from("parametros").upsert(rows, {
    onConflict: "chave",
  });
  if (error) return { ok: false, message: error.message };

  await registrarVersaoParametrosEconomicos(supabase, {
    escopo: "laboratorio_global",
    parametros: parsed.data,
    origem: "orcamento/parametros",
  });
  await registrarEvento(
    "orcamento_parametros",
    0,
    "laboratorio_global",
    "alterado",
    "Parâmetros econômicos globais atualizados com nova versão.",
  );

  revalidatePath("/orcamento/parametros");
  revalidatePath("/orcamento");
  revalidatePath("/custeio");
  revalidatePath("/analises");
  return { ok: true, message: "Parâmetros econômicos atualizados." };
}
