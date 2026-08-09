"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas, type FonteCustoInsumos } from "@/lib/costing/loader";
import { registrarVersaoParametrosEconomicos } from "@/lib/orcamento/parametros-versionamento";
import {
  montarSnapshotLaboratorio,
  statusOperacionalLaboratorio,
  type ItemLaboratorioOperacional,
} from "@/lib/orcamento/laboratorio-operacional";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import { moduloBloqueadoParaEdicao } from "@/lib/orcamento/ciclo-vida-modulo";
import { registrarEvento } from "./eventos";

// Validação defensiva de servidor: impede edição direta de módulo laboratorial
// revisado/enviado/aprovado/cancelado (Fase 5). Não confiar só no botão da UI.
async function assegurarLaboratorioEditavel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orcamentoId: number,
) {
  const { data } = await supabase
    .from("orcamentos")
    .select("status, status_operacional")
    .eq("id", orcamentoId)
    .single();
  const bloqueio = moduloBloqueadoParaEdicao({ status: data?.status, statusOperacional: data?.status_operacional });
  if (bloqueio.bloqueado) {
    throw new Error(bloqueio.motivo ?? "Edição bloqueada.");
  }
}

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
  const [{ data: orc }, { data: itens }] = await Promise.all([
    supabase.from("orcamentos").select("status").eq("id", id).single(),
    supabase
      .from("orcamento_itens")
      .select("id")
      .eq("orcamento_id", id),
  ]);
  const status = statusOperacionalLaboratorio({
    statusDocumento: statusDocumento ?? orc?.status,
    quantidadeItens: itens?.length ?? 0,
  });
  await supabase.from("orcamentos").update({
    status_operacional: status,
    status_operacional_atualizado_em: new Date().toISOString(),
  }).eq("id", id);
}

/** Cria um orçamento em rascunho e abre a tela de edição. */
export async function criarOrcamento(formData: FormData) {
  await exigirPapelOrcamento("preencher_custos");
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
    const { error } = await supabase
      .from("orcamento_projetos")
      .insert({
        demanda_id: demandaId,
        projeto_id,
        titulo,
        cliente_nome,
      });
    if (error) throw new Error(error.message);
    redirect(`/orcamento/demandas/${demandaId}?etapa=projeto`);
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
  };
  const { error } = await supabase.from("orcamentos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  if (anterior && anterior.status !== novoStatus) {
    const { error: transicaoError } = await supabase.rpc("transicionar_orcamento", {
      p_orcamento_id: id,
      p_status_destino: novoStatus,
      p_observacao: "Status alterado durante a atualização do cabeçalho.",
    });
    if (transicaoError) throw new Error(transicaoError.message);
  }
  await atualizarOperacionalLaboratorio(supabase, id, novoStatus);
  revalidatePath(`/orcamento/${id}`);
  revalidatePath("/orcamento");
}

function normalizarFonteCustoInsumos(valor: unknown): FonteCustoInsumos {
  return valor === "custo_medio_ponderado" ? "custo_medio_ponderado" : "custo_padrao";
}

export async function revisarOrcamentoLaboratorio(formData: FormData) {
  await exigirPapelOrcamento("revisar_modulo");
  const id = Number(formData.get("orcamento_id"));
  const responsavel = String(formData.get("responsavel") ?? "").trim();
  const novoStatus = String(formData.get("status") ?? "enviado");
  if (!id) return;
  if (!responsavel) {
    throw new Error("Informe o responsável técnico antes de revisar os custos laboratoriais.");
  }
  if (!["enviado", "aprovado"].includes(novoStatus)) {
    throw new Error("Status de revisão inválido.");
  }

  const supabase = await createClient();
  const [{ data: anterior }, { data: itens }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("status")
      .eq("id", id)
      .single(),
    supabase
      .from("orcamento_itens")
      .select("id")
      .eq("orcamento_id", id),
  ]);
  if ((itens ?? []).length === 0) {
    throw new Error("Adicione ao menos uma análise antes de revisar os custos laboratoriais.");
  }

  const { error } = await supabase
    .from("orcamentos")
    .update({
      responsavel,
      status_operacional: "revisado",
      status_operacional_atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (anterior && anterior.status !== novoStatus) {
    const { error: transicaoError } = await supabase.rpc("transicionar_orcamento", {
      p_orcamento_id: id,
      p_status_destino: novoStatus,
      p_observacao: "Revisão do módulo laboratorial.",
    });
    if (transicaoError) throw new Error(transicaoError.message);
  }
  await atualizarOperacionalLaboratorio(supabase, id, novoStatus);
  revalidatePath(`/orcamento/${id}`);
  revalidatePath("/orcamento");
}

/** Adiciona uma análise solicitada, gravando o snapshot de custo/preço atual. */
export async function adicionarItemOrcamento(formData: FormData) {
  await exigirPapelOrcamento("preencher_custos");
  const id = Number(formData.get("orcamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const n = Number(formData.get("n_amostras"));
  if (!id || !codigo || !(n > 0)) return;

  const supabase = await createClient();
  const { data: analise } = await supabase
    .from("analises")
    .select("ativo, ofertavel")
    .eq("codigo", codigo)
    .single();
  if (!analise?.ativo || !analise?.ofertavel) {
    throw new Error("Analise inativa ou nao oferecivel para novo orcamento.");
  }
  const { data: orcamento } = await supabase
    .from("orcamentos")
    .select("fonte_custo_insumos")
    .eq("id", id)
    .single();
  const fonteCustoInsumos = normalizarFonteCustoInsumos(orcamento?.fonte_custo_insumos);
  const { breakdowns } = await calcularTodas({}, fonteCustoInsumos);
  const b = breakdowns.find((x) => x.codigo === codigo);
  if (!b) throw new Error(`Não foi possível calcular a análise ${codigo}.`);

  await assegurarLaboratorioEditavel(supabase, id);
  const lote = b.lote > 0 ? b.lote : 1;
  const valorSnapshot = {
    lote_padrao: lote,
    numero_execucoes: Math.ceil(n / lote),
    composicao: {
      reagentes: b.reagentes,
      equipamento: b.equipamento,
      pessoal: b.pessoal,
      overhead: b.overhead,
      custo_total: b.custoTotal,
      preco: b.preco,
    },
    composicao_totais: {
      reagentes: b.reagentes * n,
      equipamento: b.equipamento * n,
      pessoal: b.pessoal * n,
      overhead: b.overhead * n,
      custo_total: b.custoTotal * n,
      preco: b.preco * n,
    },
    proveniencia_dimensional: b.provenienciaDimensional ?? [],
    fonte_custo_insumos: fonteCustoInsumos,
  };
  const payload = {
    n_amostras: n,
    custo_unitario: b.custoTotal,
    preco_unitario: b.preco,
    valor_snapshot: valorSnapshot,
  };
  const { data: existentes, error: existentesError } = await supabase
    .from("orcamento_itens")
    .select("id")
    .eq("orcamento_id", id)
    .eq("codigo_analise", codigo)
    .order("id", { ascending: true });
  if (existentesError) throw new Error(existentesError.message);

  const principal = existentes?.[0];
  if (principal) {
    const { error } = await supabase
      .from("orcamento_itens")
      .update(payload)
      .eq("id", principal.id);
    if (error) throw new Error(error.message);

    const duplicados = (existentes ?? []).slice(1).map((item) => item.id);
    if (duplicados.length > 0) {
      const { error: deleteError } = await supabase
        .from("orcamento_itens")
        .delete()
        .in("id", duplicados);
      if (deleteError) throw new Error(deleteError.message);
    }
  } else {
    const { error } = await supabase.from("orcamento_itens").insert({
      orcamento_id: id,
      codigo_analise: codigo,
      ...payload,
    });
    if (error) throw new Error(error.message);
  }
  const { data: itensPersistidos, error: itensError } = await supabase
    .from("orcamento_itens")
    .select("codigo_analise, n_amostras, custo_unitario, preco_unitario, valor_snapshot")
    .eq("orcamento_id", id);
  if (itensError) throw new Error(itensError.message);
  const itensSnapshot = [
    ...(itensPersistidos ?? []).filter((item) => item.codigo_analise !== codigo),
    { codigo_analise: codigo, ...payload },
  ];
  const custoSnapshot = {
    ...(montarSnapshotLaboratorio(
      itensSnapshot as ItemLaboratorioOperacional[],
      breakdowns,
    ) as Record<string, import("@/lib/supabase/database.types").Json>),
    fonte_custo_insumos: fonteCustoInsumos,
  };
  const { error: snapshotError } = await supabase
    .from("orcamentos")
    .update({ custo_snapshot: custoSnapshot })
    .eq("id", id);
  if (snapshotError) throw new Error(snapshotError.message);
  await atualizarOperacionalLaboratorio(supabase, id);
  revalidatePath(`/orcamento/${id}`);
}

export async function alternarAnaliseOrcamento(formData: FormData) {
  const id = Number(formData.get("orcamento_id"));
  const codigo = String(formData.get("codigo_analise") ?? "");
  const incluir = String(formData.get("incluir") ?? "") === "true";
  if (!id || !codigo) return;
  if (!incluir) {
    const supabase = await createClient();
    await assegurarLaboratorioEditavel(supabase, id);
    await supabase
      .from("orcamento_itens")
      .delete()
      .eq("orcamento_id", id)
      .eq("codigo_analise", codigo);
    await atualizarOperacionalLaboratorio(supabase, id);
    revalidatePath(`/orcamento/${id}`);
    return;
  }
  await adicionarItemOrcamento(formData);
}

export async function removerItemOrcamento(formData: FormData) {
  await exigirPapelOrcamento("preencher_custos");
  const id = Number(formData.get("orcamento_id"));
  const itemId = Number(formData.get("item_id"));
  if (!itemId) return;
  const supabase = await createClient();
  await assegurarLaboratorioEditavel(supabase, id);
  await supabase.from("orcamento_itens").delete().eq("id", itemId);
  await atualizarOperacionalLaboratorio(supabase, id);
  revalidatePath(`/orcamento/${id}`);
}

export type ResultadoRecalculoOrcamento = {
  ok: boolean;
  message: string;
};

/** Reatualiza os snapshots de custo/preço dos itens com os parâmetros atuais. */
export async function recalcularOrcamento(
  formData: FormData,
): Promise<ResultadoRecalculoOrcamento> {
  await exigirPapelOrcamento("recalcular_custos");
  const id = Number(formData.get("orcamento_id"));
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, message: "Informe um orçamento válido para recalcular." };
  }
  const operacaoId = String(formData.get("operacao_id") ?? "").trim();
  if (!z.string().uuid().safeParse(operacaoId).success) {
    return { ok: false, message: "Identidade da operação de recálculo inválida." };
  }
  const supabase = await createClient();
  const { data: atual, error: atualError } = await supabase
    .from("orcamentos")
    .select("status, fonte_custo_insumos, custo_revisao")
    .eq("id", id)
    .maybeSingle();
  if (atualError) throw new Error(atualError.message);
  if (!atual) {
    return { ok: false, message: "Orçamento não encontrado para recálculo." };
  }
  const motivoInformado = String(formData.get("motivo") ?? "").trim();
  if (atual && ["enviado", "aprovado", "cancelado"].includes(atual.status)) {
    if (!motivoInformado) {
      return {
        ok: false,
        message: "Recalcular orçamento enviado, aprovado ou cancelado exige motivo.",
      };
    }
  }
  const fonteCustoInsumos = normalizarFonteCustoInsumos(formData.get("fonte_custo_insumos") ?? atual?.fonte_custo_insumos);
  const { data: itens, error: itensError } = await supabase
    .from("orcamento_itens")
    .select("id, codigo_analise, n_amostras, custo_unitario, preco_unitario, valor_snapshot")
    .eq("orcamento_id", id);
  if (itensError) throw new Error(itensError.message);
  const { breakdowns } = await calcularTodas({}, fonteCustoInsumos);
  const itensRecalculados = (itens ?? []).map((it) => {
    const b = breakdowns.find((x) => x.codigo === it.codigo_analise);
    if (!b) {
      throw new Error(`Não foi possível recalcular a análise ${it.codigo_analise}.`);
    }
    const quantidade = Number(it.n_amostras ?? 0);
    const lote = b.lote > 0 ? b.lote : 1;
    return {
      id: it.id,
      codigo_analise: it.codigo_analise,
      n_amostras: quantidade,
      custo_unitario: b.custoTotal,
      preco_unitario: b.preco,
      valor_snapshot: {
        lote_padrao: lote,
        numero_execucoes: quantidade > 0 ? Math.ceil(quantidade / lote) : 0,
        composicao: {
          reagentes: b.reagentes,
          equipamento: b.equipamento,
          pessoal: b.pessoal,
          overhead: b.overhead,
          custo_total: b.custoTotal,
          preco: b.preco,
        },
        composicao_totais: {
          reagentes: b.reagentes * quantidade,
          equipamento: b.equipamento * quantidade,
          pessoal: b.pessoal * quantidade,
          overhead: b.overhead * quantidade,
          custo_total: b.custoTotal * quantidade,
          preco: b.preco * quantidade,
        },
        proveniencia_dimensional: b.provenienciaDimensional ?? [],
        fonte_custo_insumos: fonteCustoInsumos,
      },
    };
  });
  const snapshot = {
    ...(montarSnapshotLaboratorio(
      itensRecalculados as ItemLaboratorioOperacional[],
      breakdowns,
    ) as Record<string, import("@/lib/supabase/database.types").Json>),
    fonte_custo_insumos: fonteCustoInsumos,
  };
  const motivo =
    motivoInformado || `Recálculo de snapshots laboratoriais com ${fonteCustoInsumos}.`;
  const { error } = await supabase.rpc("recalcular_orcamento_transacional", {
    p_orcamento_id: id,
    p_motivo: motivo,
    p_revisao_esperada: Number(atual.custo_revisao ?? 0),
    p_fonte_custo_insumos: fonteCustoInsumos,
    p_itens: itensRecalculados,
    p_snapshot: snapshot,
    p_operacao_id: operacaoId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/orcamento/${id}`);
  return { ok: true, message: "Orçamento recalculado com sucesso." };
}

export async function excluirOrcamento(formData: FormData) {
  await exigirPapelOrcamento("cancelar_documento");
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

  const { error } = await supabase.rpc("transicionar_orcamento", {
    p_orcamento_id: id,
    p_status_destino: "cancelado",
    p_observacao: motivo,
  });
  if (error) throw new Error(error.message);
  await atualizarOperacionalLaboratorio(supabase, id, "cancelado");
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
