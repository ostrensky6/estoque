"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import { assegurarAnalisesLiberadas, AnaliseBloqueadaError } from "@/lib/cadastros/guard-custeio";
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

const MODALIDADES_COM_ANALISES = new Set(["analises", "analises_projeto", "projeto_analises_custos"]);
const MODALIDADES_COM_PROJETO = new Set(["projeto", "analises_projeto", "projeto_analises_custos"]);

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
  if (!MODALIDADES_COM_ANALISES.has(demanda.modalidade)) {
    redirect(`${listaPath}/${id}`);
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
  await supabase.from("demandas_propostas").update({ status: "orcada" }).eq("id", id);
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
  if (!MODALIDADES_COM_PROJETO.has(demanda.modalidade)) {
    redirect(`${listaPath}/${id}`);
  }

  const { data, error } = await supabase
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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  await supabase.from("demandas_propostas").update({ status: "orcada" }).eq("id", id);
  revalidatePath(listaPath);
  redirect(`/orcamento/projetos/${data.id}`);
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
    redirect(`${listaPath}/${id}?erro_emissao=${encodeURIComponent("Complete a demanda antes de emitir o orçamento final.")}`);
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

  // Emissão final é bloqueada se qualquer análise consolidada está bloqueada.
  const idsOrcamentos = (orcamentos ?? []).map((o) => o.id);
  const idsProjetos = (orcProjetos ?? []).map((o) => o.id);
  const [{ data: codsLab }, { data: codsProjeto }] = await Promise.all([
    idsOrcamentos.length
      ? supabase.from("orcamento_itens").select("codigo_analise").in("orcamento_id", idsOrcamentos)
      : Promise.resolve({ data: [] as { codigo_analise: string }[] }),
    idsProjetos.length
      ? supabase
          .from("orcamento_projeto_analises")
          .select("codigo_analise")
          .in("orcamento_projeto_id", idsProjetos)
      : Promise.resolve({ data: [] as { codigo_analise: string }[] }),
  ]);
  try {
    await assegurarAnalisesLiberadas([
      ...(codsLab ?? []).map((r) => r.codigo_analise),
      ...(codsProjeto ?? []).map((r) => r.codigo_analise),
    ]);
  } catch (e) {
    if (e instanceof AnaliseBloqueadaError) {
      redirect(`${listaPath}/${id}?erro_emissao=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }

  const exigeAnalises = MODALIDADES_COM_ANALISES.has(demanda.modalidade);
  const exigeProjeto = MODALIDADES_COM_PROJETO.has(demanda.modalidade);
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
    redirect(`${listaPath}/${id}?erro_emissao=${encodeURIComponent(consolidado.pendencias.join("; "))}`);
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

  if (consolidado.parametrosAplicados) {
    const { error: parametrosError } = await supabase
      .from("orcamento_parametros_aplicados")
      .insert({
        demanda_id: id,
        orcamento_laboratorial_id: orcamentos?.at(-1)?.id ?? null,
        orcamento_projeto_id: projetoReferencia?.id ?? null,
        orcamento_final_versao_id: versaoFinal.id,
        versao,
        metodo_calculo: consolidado.parametrosAplicados.metodo,
        laboratorio_modo: consolidado.parametrosAplicados.laboratorio.modo,
        subtotal_laboratorio: consolidado.parametrosAplicados.laboratorio.total,
        subtotal_projeto: consolidado.parametrosAplicados.projeto.total,
        subtotal_custos: consolidado.parametrosAplicados.subtotalCustos,
        total_parametros: consolidado.parametrosAplicados.totalParametros,
        total_final: consolidado.parametrosAplicados.totalFinal,
        parametros_snapshot: consolidado.parametrosAplicados.parametros,
        formula_snapshot: {
          entrada: consolidado.entradaParametros,
          origens: consolidado.origens,
        } satisfies Json,
        alertas_snapshot: consolidado.parametrosAplicados.alertas,
        criado_por: user?.id ?? null,
      });
    if (parametrosError) throw new Error(parametrosError.message);
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
  redirect(`${listaPath}/${id}`);
}
