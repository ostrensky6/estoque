"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import { modalidadeExigeLaboratorio, modalidadeExigeProjeto } from "@/lib/orcamento/orcamento-economico";
import { detectarCustosZero } from "@/lib/orcamento/proposta-final";
import { planejarModulosProposta, type PlanoModulos } from "@/lib/orcamento/garantir-modulos";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import type { Json } from "@/lib/supabase/database.types";
import { registrarEvento } from "./eventos";

const listaPath = "/orcamento/demandas";

function texto(formData: FormData, chave: string) {
  const valor = String(formData.get(chave) ?? "").trim();
  return valor || null;
}

function numeroOuNull(formData: FormData, chave: string) {
  const valor = formData.get(chave);
  if (valor == null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function snapshotCompletude(demanda: Parameters<typeof avaliarCompletudeDemanda>[0]) {
  const completude = avaliarCompletudeDemanda(demanda);
  return {
    ...completude,
    atualizado_em: new Date().toISOString(),
  };
}

// Carrega os IDs de módulos ATIVOS (não cancelados) de uma demanda e devolve o
// plano idempotente (criar/abrir/bloquear).
async function planoModulos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demanda: { id: number; modalidade?: string | null; projeto_id?: number | null },
): Promise<PlanoModulos> {
  const [{ data: labs }, { data: projs }] = await Promise.all([
    supabase.from("orcamentos").select("id, status, status_operacional").eq("demanda_id", demanda.id),
    supabase.from("orcamento_projetos").select("id, status").eq("demanda_id", demanda.id),
  ]);
  const laboratorioAtivos = (labs ?? [])
    .filter((o) => o.status !== "cancelado" && o.status_operacional !== "cancelado")
    .map((o) => o.id);
  const projetoAtivos = (projs ?? []).filter((o) => o.status !== "cancelado").map((o) => o.id);
  return planejarModulosProposta({
    modalidade: demanda.modalidade,
    projetoAssociado: Boolean(demanda.projeto_id),
    laboratorioAtivos,
    projetoAtivos,
  });
}

// Criar módulo NÃO torna a proposta "orcada". Apenas tira de "nova" para o estado
// transitório "em_analise" (status já existente no banco). "orcada" só após emissão.
async function marcarEmAnalise(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demanda: { id: number; status?: string | null },
) {
  if (demanda.status === "nova") {
    await supabase.from("demandas_propostas").update({ status: "em_analise" }).eq("id", demanda.id);
  }
}

async function clienteSnapshot(clienteId: number | null) {
  if (!clienteId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clientes")
    .select("nome, cnpj, contato, email, telefone")
    .eq("id", clienteId)
    .single();
  return data;
}

export async function criarDemanda(formData: FormData) {
  const supabase = await createClient();
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);
  const demanda = {
    cliente_id: clienteId,
    projeto_id: numeroOuNull(formData, "projeto_id"),
    titulo: texto(formData, "titulo") || "Nova demanda",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    modalidade: texto(formData, "modalidade") || "analises",
    origem: texto(formData, "origem"),
    prioridade: texto(formData, "prioridade") || "normal",
    descricao: texto(formData, "descricao"),
    escopo_preliminar: texto(formData, "escopo_preliminar"),
    matriz_amostra: texto(formData, "matriz_amostra"),
    quantidade_amostras_estimada: numeroOuNull(formData, "quantidade_amostras_estimada"),
    prazo_tecnico_dias: numeroOuNull(formData, "prazo_tecnico_dias"),
    observacoes: texto(formData, "observacoes"),
  };
  const completude = snapshotCompletude(demanda);

  const { data, error } = await supabase
    .from("demandas_propostas")
    .insert({
      ...demanda,
      completude_snapshot: completude,
      completude_atualizada_em: completude.atualizado_em,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(listaPath);
  redirect(`${listaPath}/${data.id}`);
}

export async function salvarDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClient();
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);

  const patch = {
    cliente_id: clienteId,
    projeto_id: numeroOuNull(formData, "projeto_id"),
    titulo: texto(formData, "titulo") || "Demanda sem titulo",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    instituicao: texto(formData, "instituicao"),
    responsavel_interno: texto(formData, "responsavel_interno"),
    data_solicitacao: texto(formData, "data_solicitacao") ?? undefined,
    prazo_esperado: texto(formData, "prazo_esperado"),
    modalidade: texto(formData, "modalidade") || "analises",
    status: texto(formData, "status") || "nova",
    origem: texto(formData, "origem"),
    prioridade: texto(formData, "prioridade") || "normal",
    descricao: texto(formData, "descricao"),
    escopo_preliminar: texto(formData, "escopo_preliminar"),
    matriz_amostra: texto(formData, "matriz_amostra"),
    quantidade_amostras_estimada: numeroOuNull(formData, "quantidade_amostras_estimada"),
    prazo_tecnico_dias: numeroOuNull(formData, "prazo_tecnico_dias"),
    observacoes: texto(formData, "observacoes"),
  };
  const completude = snapshotCompletude(patch);

  const { error } = await supabase
    .from("demandas_propostas")
    .update({
      ...patch,
      completude_snapshot: completude,
      completude_atualizada_em: completude.atualizado_em,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${id}`);
}

export async function gerarOrcamentoAnalisesDaDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClient();
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;
  if (!avaliarCompletudeDemanda(demanda).completa) {
    redirect(`${listaPath}/${id}`);
  }
  if (!modalidadeExigeLaboratorio(demanda.modalidade)) {
    redirect(`${listaPath}/${id}`);
  }

  // Idempotência: nunca duplicar; abrir o existente; bloquear se houver >1 ativo.
  const plano = await planoModulos(supabase, demanda);
  const lab = plano.laboratorio;
  if (lab.acao === "bloqueado") {
    redirect(`${listaPath}/${id}?etapa=demanda&erro_integridade=${encodeURIComponent(plano.erros.join("; "))}`);
  }
  if (lab.acao === "abrir" && lab.moduloId) {
    redirect(`/orcamento/${lab.moduloId}`);
  }

  const { data, error } = await supabase
    .from("orcamentos")
    .insert({
      demanda_id: id,
      cliente_id: demanda.cliente_id,
      projeto_id: demanda.projeto_id,
      cliente_nome: demanda.cliente_nome || demanda.titulo,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      observacoes: demanda.escopo_preliminar || demanda.descricao || demanda.observacoes,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await marcarEmAnalise(supabase, demanda);
  revalidatePath(listaPath);
  redirect(`/orcamento/${data.id}`);
}

export async function gerarOrcamentoProjetoDaDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;

  const supabase = await createClient();
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;
  if (!avaliarCompletudeDemanda(demanda).completa) {
    redirect(`${listaPath}/${id}`);
  }
  if (!modalidadeExigeProjeto(demanda.modalidade)) {
    redirect(`${listaPath}/${id}`);
  }

  // Idempotência: nunca duplicar; abrir o existente; bloquear se houver >1 ativo.
  const plano = await planoModulos(supabase, demanda);
  const projeto = plano.projeto;
  if (projeto.acao === "bloqueado") {
    redirect(`${listaPath}/${id}?etapa=demanda&erro_integridade=${encodeURIComponent(plano.erros.join("; "))}`);
  }
  if (projeto.acao === "abrir" && projeto.moduloId) {
    redirect(`/orcamento/projetos/${projeto.moduloId}`);
  }

  const { error } = await supabase
    .from("orcamento_projetos")
    .insert({
      demanda_id: id,
      projeto_id: demanda.projeto_id,
      cliente_id: demanda.cliente_id,
      titulo: demanda.titulo,
      cliente_nome: demanda.cliente_nome,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      escopo: demanda.escopo_preliminar || demanda.descricao,
      observacoes: demanda.observacoes,
    });

  if (error) throw new Error(error.message);
  await marcarEmAnalise(supabase, demanda);
  revalidatePath(listaPath);
  redirect(`/orcamento/demandas/${id}?etapa=projeto`);
}

/**
 * Rotina ÚNICA e idempotente: garante os módulos aplicáveis da proposta.
 * Cria somente o que falta, abre o existente, bloqueia se houver duplicidade
 * histórica. Tolera cliques/chamadas repetidas (re-consulta os ativos a cada
 * execução). Não marca a demanda como "orcada".
 */
export async function garantirModulosDaProposta(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;
  const supabase = await createClient();
  const { data: demanda } = await supabase.from("demandas_propostas").select("*").eq("id", id).single();
  if (!demanda) return;
  if (!avaliarCompletudeDemanda(demanda).completa) {
    redirect(`${listaPath}/${id}`);
  }

  const plano = await planoModulos(supabase, demanda);
  if (plano.bloqueadoPorDuplicidade) {
    redirect(`${listaPath}/${id}?etapa=demanda&erro_integridade=${encodeURIComponent(plano.erros.join("; "))}`);
  }

  let criou = false;
  if (plano.laboratorio.acao === "criar") {
    const { error } = await supabase.from("orcamentos").insert({
      demanda_id: id,
      cliente_id: demanda.cliente_id,
      projeto_id: demanda.projeto_id,
      cliente_nome: demanda.cliente_nome || demanda.titulo,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      observacoes: demanda.escopo_preliminar || demanda.descricao || demanda.observacoes,
    });
    if (error) throw new Error(error.message);
    criou = true;
  }
  if (plano.projeto.acao === "criar") {
    const { error } = await supabase.from("orcamento_projetos").insert({
      demanda_id: id,
      projeto_id: demanda.projeto_id,
      cliente_id: demanda.cliente_id,
      titulo: demanda.titulo,
      cliente_nome: demanda.cliente_nome,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      escopo: demanda.escopo_preliminar || demanda.descricao,
      observacoes: demanda.observacoes,
    });
    if (error) throw new Error(error.message);
    criou = true;
  }
  if (criou) await marcarEmAnalise(supabase, demanda);
  revalidatePath(listaPath);
  redirect(`${listaPath}/${id}?etapa=demanda`);
}

export async function emitirOrcamentoFinalDaDemanda(formData: FormData) {
  const id = Number(formData.get("demanda_id"));
  if (!id) return;
  await exigirPapelOrcamento("emitir_final");

  const validadeDias = Number(formData.get("validade_dias")) || 30;
  const supabase = await createClient();

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;

  const completude = avaliarCompletudeDemanda(demanda);
  if (!completude.completa) {
    redirect(`${listaPath}/${id}?etapa=final&erro_emissao=${encodeURIComponent("Complete a demanda antes de emitir o orçamento final.")}`);
  }

  const [{ data: orcamentos }, { data: orcProjetos }, { data: ultimaVersao }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, status, orcamento_itens(id, n_amostras, custo_unitario, preco_unitario)")
      .eq("demanda_id", id)
      .order("id"),
      supabase
        .from("orcamento_projetos")
        .select("id, status, projeto_sem_custo_justificativa, impostos, margem_lucro, impostos_legacy, incubacao, reserva, investimentos, lucro, orcamento_projeto_analises(id, n_amostras, custo_unitario, preco_unitario), orcamento_projeto_custos(id, rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados)")
        .eq("demanda_id", id)
        .order("id"),
    supabase
      .from("orcamento_final_versoes")
      .select("versao")
      .eq("demanda_id", id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const exigeAnalises = modalidadeExigeLaboratorio(demanda.modalidade);
  const exigeProjeto = modalidadeExigeProjeto(demanda.modalidade);
  const itensAnalises = (orcamentos ?? []).reduce((total, orcamento) => (
    total + (orcamento.orcamento_itens?.length ?? 0)
  ), 0);
  const itensProjeto = (orcProjetos ?? []).reduce((total, orcamento) => (
    total +
    (orcamento.orcamento_projeto_custos?.length ?? 0) +
    (orcamento.orcamento_projeto_analises?.length ?? 0) +
    (orcamento.projeto_sem_custo_justificativa ? 1 : 0)
  ), 0);
  const statusAnalises = (orcamentos ?? []).some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : (orcamentos ?? []).some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcamentos?.[0]?.status;
  const statusProjeto = (orcProjetos ?? []).some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : (orcProjetos ?? []).some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcProjetos?.[0]?.status;
  const moduloAnalises = avaliarModuloOperacional({
    exigido: exigeAnalises,
    quantidadeItens: itensAnalises,
    statusDocumento: statusAnalises,
    pendenciaSemItens: "adicionar ao menos uma análise com custo",
  });
  const moduloProjeto = avaliarModuloOperacional({
    exigido: exigeProjeto,
    quantidadeItens: itensProjeto,
    statusDocumento: statusProjeto,
    pendenciaSemItens: "adicionar ao menos um custo, análise de projeto ou justificativa",
  });
  const projetoReferencia = orcProjetos?.at(-1);
  const consolidado = consolidarOrcamentoFinal({
    laboratorioExigido: exigeAnalises,
    projetoExigido: exigeProjeto,
    laboratorioRevisado: moduloAnalises.status === "revisado" || moduloAnalises.status === "nao_exigido",
    projetoRevisado: moduloProjeto.status === "revisado" || moduloProjeto.status === "nao_exigido",
    itensLaboratorio: (orcamentos ?? []).flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    itensProjeto: [
      ...(orcProjetos ?? []).flatMap((orcamento) => orcamento.orcamento_projeto_custos ?? []),
      ...(orcProjetos ?? []).flatMap((orcamento) => orcamento.orcamento_projeto_analises ?? []).map((item) => ({
        rubrica: "MC",
        quantidade: Number(item.n_amostras),
        custo_unitario: Number(item.custo_unitario),
        preco_unitario: Number(item.preco_unitario),
        meses_selecionados: [],
      })),
    ],
    parametrosProjeto: {
      impostos_legacy: Number(projetoReferencia?.impostos_legacy ?? projetoReferencia?.impostos ?? 0),
      incubacao: Number(projetoReferencia?.incubacao ?? 0),
      reserva: Number(projetoReferencia?.reserva ?? 0),
      investimentos: Number(projetoReferencia?.investimentos ?? 0),
      lucro: Number(projetoReferencia?.lucro ?? projetoReferencia?.margem_lucro ?? 0),
    },
  });

  if (!consolidado.pronto) {
    redirect(`${listaPath}/${id}?etapa=final&erro_emissao=${encodeURIComponent(consolidado.pendencias.join("; "))}`);
  }

  // Validação defensiva (Fase 10): bloqueia emissão com custo técnico <= 0 sem
  // justificativa de isenção. Não altera dados — apenas impede a emissão.
  const custosZero = detectarCustosZero({
    itensLaboratorio: (orcamentos ?? []).flatMap((o) => o.orcamento_itens ?? []),
    custosProjeto: (orcProjetos ?? []).flatMap((o) => o.orcamento_projeto_custos ?? []),
    analisesProjeto: (orcProjetos ?? []).flatMap((o) => o.orcamento_projeto_analises ?? []),
    projetoTemJustificativa: (orcProjetos ?? []).some((o) => Boolean(o.projeto_sem_custo_justificativa)),
  });
  if (custosZero.length > 0) {
    const msg = `Itens com custo técnico zero sem justificativa: ${custosZero.map((c) => c.descricao).join(", ")}.`;
    redirect(`${listaPath}/${id}?etapa=final&erro_emissao=${encodeURIComponent(msg)}`);
  }

  const versao = Number(ultimaVersao?.versao ?? 0) + 1;
  const numero = `OF-${new Date().getFullYear()}-${String(id).padStart(4, "0")}-v${versao}`;
  const validoAte = new Date(Date.now() + validadeDias * 86400000).toISOString().slice(0, 10);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("orcamento_final_versoes")
    .update({ status: "substituido" })
    .eq("demanda_id", id)
    .eq("status", "emitido");

  const snapshot = {
    demanda,
    orcamentos_analises: orcamentos ?? [],
    orcamentos_projeto: orcProjetos ?? [],
    consolidado,
  } satisfies Json;

  const { data: versaoFinal, error } = await supabase
    .from("orcamento_final_versoes")
    .insert({
      demanda_id: id,
      versao,
      numero,
      validade_dias: validadeDias,
      valido_ate: validoAte,
      total_laboratorio_custo: consolidado.totalLaboratorioCusto,
      total_laboratorio_preco: consolidado.totalLaboratorioPreco,
      total_projeto_custo: consolidado.totalProjetoCusto,
      total_projeto_final: consolidado.totalProjetoFinal,
      total_final: consolidado.totalFinal,
      snapshot,
      criado_por: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (consolidado.economia.valido) {
    const economia = consolidado.economia;
    const { error: parametrosError } = await supabase
      .from("orcamento_parametros_aplicados")
      .insert({
        demanda_id: id,
        orcamento_laboratorial_id: orcamentos?.at(-1)?.id ?? null,
        orcamento_projeto_id: projetoReferencia?.id ?? null,
        orcamento_final_versao_id: versaoFinal.id,
        versao,
        // Política A (DEC-ORC-001): gross-up único sobre o subtotal técnico.
        metodo_calculo: "GROSS_UP",
        laboratorio_modo: "CUSTO_TECNICO",
        subtotal_laboratorio: economia.custoLaboratorioTecnico,
        subtotal_projeto: economia.custoDiretoProjeto,
        subtotal_custos: economia.subtotal,
        total_parametros: economia.totalParametros,
        total_final: economia.totalFinal,
        parametros_snapshot: economia.parametros satisfies Json,
        formula_snapshot: {
          politica: economia.politica,
          formula: economia.formula,
          somaPercentual: economia.somaPercentual,
          fatorGrossUp: economia.fatorGrossUp,
          origens: consolidado.origens,
        } satisfies Json,
        alertas_snapshot: economia.alertas,
        criado_por: user?.id ?? null,
      });
    if (parametrosError) throw new Error(parametrosError.message);
  }
  // "orcada" só é aplicado APÓS a emissão bem-sucedida de uma versão final
  // (regra Fase 5). Não sobrescreve estados decididos (aprovada/recusada/cancelada).
  if (["nova", "em_analise"].includes(demanda.status)) {
    await supabase.from("demandas_propostas").update({ status: "orcada" }).eq("id", id);
  }

  await registrarEvento(
    "orcamento_final",
    id,
    ultimaVersao?.versao ? `v${ultimaVersao.versao}` : null,
    `v${versao}`,
    `Orçamento final ${numero} emitido para demanda #${id}.`,
  );

  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${id}`);
  revalidatePath("/orcamento");
  redirect(`${listaPath}/${id}?etapa=final`);
}
