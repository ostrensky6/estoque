"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calcularTodas } from "@/lib/costing/loader";
import { avaliarCompletudeDemanda } from "@/lib/orcamento/demanda-completude";
import { avaliarModuloOperacional } from "@/lib/orcamento/modulo-status";
import { consolidarOrcamentoFinal } from "@/lib/orcamento/orcamento-final";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import { validarParametrosProjetoGrossUp } from "@/lib/project-budget/legacy";
import { registrarVersaoParametrosEconomicos } from "@/lib/orcamento/parametros-versionamento";
import {
  modalidadeExigeLaboratorio,
  modalidadeExigeProjeto,
  normalizarModalidadeOrcamento,
} from "@/lib/orcamento/orcamento-economico";
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

const MODALIDADES_COM_ANALISES = new Set(["analises", "analises_projeto", "projeto_analises_custos", "projeto_com_analises"]);
const MODALIDADES_COM_PROJETO = new Set(["projeto", "analises_projeto", "projeto_analises_custos", "projeto_com_analises"]);

export type DemandaFormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  savedAt?: string;
};

type AnaliseSolicitadaPayload = {
  grupo_key: string;
  codigo_analise: string;
  quantidade_amostras: number;
  observacao: string | null;
  origem_quantidade: string;
  status_custeio?: string;
};

type GrupoAmostraPayload = {
  key: string;
  identificacao: string;
  tipo_matriz: string | null;
  quantidade_amostras: number;
  unidade: string;
  observacao: string | null;
};

type SincronizarAnalisesResultado = {
  message: string | null;
  pendentes: number;
  registradas: number;
};

function gruposFromForm(formData: FormData, quantidadePadrao: number | null) {
  const keys = formData.getAll("grupo_key").map((valor) => String(valor).trim()).filter(Boolean);
  const identificacoes = formData.getAll("grupo_identificacao");
  const matrizes = formData.getAll("grupo_tipo_matriz");
  const quantidades = formData.getAll("grupo_quantidade");
  const unidades = formData.getAll("grupo_unidade");
  const observacoes = formData.getAll("grupo_observacao");
  const vistos = new Set<string>();
  const grupos = keys.flatMap((key, index) => {
    if (vistos.has(key)) return [];
    vistos.add(key);
    const quantidade = Number(quantidades[index] ?? quantidadePadrao ?? 1);
    return [{
      key,
      identificacao: String(identificacoes[index] ?? key).trim() || key,
      tipo_matriz: String(matrizes[index] ?? "").trim() || null,
      quantidade_amostras: Number.isFinite(quantidade) && quantidade > 0 ? Math.floor(quantidade) : 1,
      unidade: String(unidades[index] ?? "amostras").trim() || "amostras",
      observacao: String(observacoes[index] ?? "").trim() || null,
    }];
  });
  if (grupos.length > 0) return grupos;
  return [{
    key: "grupo-a",
    identificacao: "Grupo A",
    tipo_matriz: null,
    quantidade_amostras: quantidadePadrao && quantidadePadrao > 0 ? quantidadePadrao : 1,
    unidade: "amostras",
    observacao: null,
  }];
}

function numero(formData: FormData, chave: string, fallback = 0) {
  const valor = Number(formData.get(chave));
  return Number.isFinite(valor) ? valor : fallback;
}

function analisesFromForm(formData: FormData, quantidadePadrao: number | null, grupos: GrupoAmostraPayload[]) {
  const codigos = formData.getAll("analise_codigo").map((valor) => String(valor).trim()).filter(Boolean);
  const quantidades = formData.getAll("analise_quantidade");
  const origens = formData.getAll("analise_origem_quantidade");
  const grupoKeys = formData.getAll("analise_grupo_key");
  const grupoValido = new Set(grupos.map((grupo) => grupo.key));
  const vistos = new Set<string>();
  return codigos.flatMap((codigo, index) => {
    const grupo_key = String(grupoKeys[index] ?? grupos[0]?.key ?? "grupo-a").trim();
    const chave = `${grupo_key}:${codigo}`;
    if (vistos.has(chave)) return [];
    vistos.add(chave);
    const quantidade = Number(quantidades[index] ?? quantidadePadrao ?? 1);
    return [{
      grupo_key: grupoValido.has(grupo_key) ? grupo_key : grupos[0]?.key ?? "grupo-a",
      codigo_analise: codigo,
      quantidade_amostras: Number.isFinite(quantidade) && quantidade > 0 ? Math.floor(quantidade) : 1,
      observacao: null,
      origem_quantidade: String(origens[index] ?? "padrao") === "manual" ? "manual" : "padrao",
    }];
  });
}

async function calcularPrazoTecnicoAnalises(
  supabase: Awaited<ReturnType<typeof createClient>>,
  itens: Array<{ codigo_analise: string; quantidade_amostras: number }>,
) {
  if (itens.length === 0) return null;
  const { data: etapas } = await supabase
    .from("etapas")
    .select("codigo_analise, execucoes_por_dia, amostras_por_execucao")
    .in("codigo_analise", itens.map((item) => item.codigo_analise));
  const prazos = itens.map((item) => {
    const etapasAnalise = (etapas ?? []).filter((etapa) => etapa.codigo_analise === item.codigo_analise);
    const capacidades = etapasAnalise
      .map((etapa) => Number(etapa.execucoes_por_dia ?? 0) * Number(etapa.amostras_por_execucao ?? 0))
      .filter((capacidade) => capacidade > 0);
    if (capacidades.length === 0) return 1;
    return Math.max(1, Math.ceil(item.quantidade_amostras / Math.min(...capacidades)));
  });
  return Math.max(...prazos);
}

function snapshotAnaliseDemanda(args: {
  codigo: string;
  nome?: string | null;
  metodo?: string | null;
  matriz?: string | null;
  custoUnitario: number;
  precoUnitario: number;
  nAmostras: number;
}) {
  return {
    tipo: "analise_laboratorial_demanda",
    codigo_analise: args.codigo,
    descricao: args.nome ?? args.codigo,
    metodo: args.metodo ?? null,
    matriz: args.matriz ?? null,
    rubrica: "Laboratório",
    unidade: "amostra",
    valor_unitario_utilizado: args.custoUnitario,
    preco_unitario_utilizado: args.precoUnitario,
    quantidade: args.nAmostras,
    data_snapshot: new Date().toISOString(),
    origem_valor: "breakdown.custoTotal",
  } satisfies Json;
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

async function garantirModulosDaDemanda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: number,
  options: { laboratorio?: boolean; projeto?: boolean } = {},
) {
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", id)
    .single();
  if (!demanda) return;

  const exigeLaboratorio = options.laboratorio ?? modalidadeExigeLaboratorio(demanda.modalidade);
  const exigeProjeto = options.projeto ?? modalidadeExigeProjeto(demanda.modalidade);

  if (exigeLaboratorio) {
    const { data: existente } = await supabase
      .from("orcamentos")
      .select("id")
      .eq("demanda_id", id)
      .neq("status", "cancelado")
      .limit(1)
      .maybeSingle();
    if (!existente) {
      await supabase.from("orcamentos").insert({
        demanda_id: id,
        cliente_id: demanda.cliente_id,
        projeto_id: demanda.projeto_id,
        cliente_nome: demanda.cliente_nome || demanda.titulo,
        cliente_cnpj: demanda.cliente_cnpj,
        cliente_contato: demanda.cliente_contato,
        responsavel: demanda.responsavel_interno,
        observacoes: demanda.escopo_preliminar || demanda.descricao || demanda.observacoes,
        tipo: "analises",
      });
    }
  }

  if (exigeProjeto) {
    const { data: existente } = await supabase
      .from("orcamento_projetos")
      .select("id")
      .eq("demanda_id", id)
      .neq("status", "cancelado")
      .limit(1)
      .maybeSingle();
    if (!existente) {
      await supabase.from("orcamento_projetos").insert({
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
    }
  }
}

async function garantirRegistroParametrosEconomicos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demandaId: number,
) {
  const { data: existente } = await supabase
    .from("orcamento_projetos")
    .select("id")
    .eq("demanda_id", demandaId)
    .neq("status", "cancelado")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return Number(existente.id);

  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("id, projeto_id, cliente_id, titulo, cliente_nome, cliente_cnpj, cliente_contato, responsavel_interno, escopo_preliminar, descricao, observacoes")
    .eq("id", demandaId)
    .single();
  if (!demanda) return null;

  const { data: criado, error } = await supabase
    .from("orcamento_projetos")
    .insert({
      demanda_id: demandaId,
      projeto_id: demanda.projeto_id,
      cliente_id: demanda.cliente_id,
      titulo: demanda.titulo ?? `Parâmetros do orçamento #${demandaId}`,
      cliente_nome: demanda.cliente_nome,
      cliente_cnpj: demanda.cliente_cnpj,
      cliente_contato: demanda.cliente_contato,
      responsavel: demanda.responsavel_interno,
      escopo: demanda.escopo_preliminar || demanda.descricao,
      observacoes: demanda.observacoes,
      status: "rascunho",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return Number(criado.id);
}

async function sincronizarAnalisesDaDemanda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demandaId: number,
  grupos: GrupoAmostraPayload[],
  itens: AnaliseSolicitadaPayload[],
): Promise<SincronizarAnalisesResultado> {
  const { data: demanda } = await supabase
    .from("demandas_propostas")
    .select("*")
    .eq("id", demandaId)
    .single();
  if (!demanda) return { message: "Demanda não encontrada para sincronizar análises.", pendentes: 0, registradas: 0 };

  const { breakdowns } = await calcularTodas();
  const itensComCusteio = itens.map((item) => {
    const breakdown = breakdowns.find((b) => b.codigo === item.codigo_analise);
    return {
      ...item,
      status_custeio: breakdown && Number(breakdown.custoTotal) > 0 ? "disponivel" : "pendente",
    };
  });

  const { data: analises } = await supabase
    .from("analises")
    .select("codigo, nome, nome_simplificado")
    .in("codigo", itens.map((item) => item.codigo_analise));
  const nomes = new Map((analises ?? []).map((analise) => [analise.codigo, analise.nome_simplificado ?? analise.nome]));
  const { data: etapasSnapshot } = await supabase
    .from("etapas")
    .select("codigo_analise, nome_etapa, nome_atividade, ordem")
    .in("codigo_analise", itens.map((item) => item.codigo_analise))
    .order("ordem");
  const metodos = new Map(
    (etapasSnapshot ?? []).map((etapa) => [etapa.codigo_analise, etapa.nome_etapa ?? etapa.nome_atividade ?? null]),
  );

  const itensSincronizados = itensComCusteio.map((item) => {
    const breakdown = breakdowns.find((b) => b.codigo === item.codigo_analise);
    const custeioDisponivel = item.status_custeio === "disponivel" && breakdown;
    return {
      grupo_key: item.grupo_key,
      codigo_analise: item.codigo_analise,
      quantidade_amostras: item.quantidade_amostras,
      observacao: item.observacao,
      origem_quantidade: item.origem_quantidade,
      status_custeio: item.status_custeio,
      custo_unitario: custeioDisponivel ? breakdown.custoTotal : 0,
      preco_unitario: custeioDisponivel ? breakdown.preco : 0,
      valor_snapshot: custeioDisponivel
        ? snapshotAnaliseDemanda({
            codigo: item.codigo_analise,
            nome: nomes.get(item.codigo_analise),
            metodo: metodos.get(item.codigo_analise),
            matriz: demanda.matriz_amostra,
            custoUnitario: breakdown.custoTotal,
            precoUnitario: breakdown.preco,
            nAmostras: item.quantidade_amostras,
          })
        : ({
            tipo: "analise_laboratorial_demanda",
            codigo_analise: item.codigo_analise,
            descricao: nomes.get(item.codigo_analise) ?? item.codigo_analise,
            metodo: metodos.get(item.codigo_analise) ?? null,
            matriz: demanda.matriz_amostra ?? null,
            rubrica: "Laboratório",
            unidade: "amostra",
            quantidade: item.quantidade_amostras,
            status_custeio: "pendente",
            origem_valor: "custeio_pendente",
            data_snapshot: new Date().toISOString(),
          } satisfies Json),
    };
  });

  const db = supabase as unknown as {
    from: (table: string) => {
      delete: () => { eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }> };
      insert: (payload: unknown) => { select: (columns?: string) => Promise<{ data: Array<{ id: number; identificacao?: string }> | null; error: { message: string } | null }> };
      update: (payload: unknown) => { eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }> };
    };
  };

  let orcamentoId: number | null = null;
  if (modalidadeExigeLaboratorio(demanda.modalidade)) {
    const { data: existente } = await supabase
      .from("orcamentos")
      .select("id, status")
      .eq("demanda_id", demandaId)
      .neq("status", "cancelado")
      .limit(1)
      .maybeSingle();
    if (existente && existente.status !== "rascunho") {
      return { message: "Somente orcamento laboratorial em rascunho pode ser sincronizado pela demanda.", pendentes: 0, registradas: itensComCusteio.length };
    }
    if (existente) {
      orcamentoId = Number(existente.id);
    } else {
      const { data: novoOrcamento, error: novoError } = await supabase
        .from("orcamentos")
        .insert({
          demanda_id: demandaId,
          cliente_id: demanda.cliente_id,
          projeto_id: demanda.projeto_id,
          cliente_nome: demanda.cliente_nome || demanda.titulo,
          cliente_cnpj: demanda.cliente_cnpj,
          cliente_contato: demanda.cliente_contato,
          responsavel: demanda.responsavel_interno,
          observacoes: demanda.escopo_preliminar || demanda.descricao || demanda.observacoes,
          tipo: "analises",
        })
        .select("id")
        .single();
      if (novoError) return { message: novoError.message, pendentes: 0, registradas: itensComCusteio.length };
      orcamentoId = Number(novoOrcamento.id);
    }
  }

  await db.from("demanda_analises").delete().eq("demanda_id", demandaId);
  await db.from("demanda_grupos_amostras").delete().eq("demanda_id", demandaId);

  const { data: gruposCriados, error: gruposError } = await db
    .from("demanda_grupos_amostras")
    .insert(grupos.map((grupo, index) => ({
      demanda_id: demandaId,
      identificacao: grupo.identificacao,
      tipo_matriz: grupo.tipo_matriz,
      quantidade_amostras: grupo.quantidade_amostras,
      unidade: grupo.unidade,
      observacao: grupo.observacao,
      ordem: index + 1,
    })))
    .select("id, identificacao");
  if (gruposError) return { message: gruposError.message, pendentes: 0, registradas: itensComCusteio.length };
  const grupoIdPorKey = new Map(grupos.map((grupo, index) => [grupo.key, gruposCriados?.[index]?.id]));

  if (itensSincronizados.length > 0) {
    const { error: analisesError } = await db
      .from("demanda_analises")
      .insert(itensSincronizados.map((item) => ({
        demanda_id: demandaId,
        grupo_amostra_id: grupoIdPorKey.get(item.grupo_key) ?? null,
        codigo_analise: item.codigo_analise,
        quantidade_amostras: item.quantidade_amostras,
        observacao: item.observacao,
        status_custeio: item.status_custeio,
        origem_quantidade: item.origem_quantidade,
      })))
      .select("id");
    if (analisesError) return { message: analisesError.message, pendentes: 0, registradas: itensComCusteio.length };
  }

  if (orcamentoId) {
    await db.from("orcamento_itens").delete().eq("orcamento_id", orcamentoId);
    const agregados = new Map<string, typeof itensSincronizados[number] & { quantidade_amostras: number }>();
    for (const item of itensSincronizados) {
      const atual = agregados.get(item.codigo_analise);
      if (atual) atual.quantidade_amostras += item.quantidade_amostras;
      else agregados.set(item.codigo_analise, { ...item });
    }
    const orcamentoItens = [...agregados.values()].map((item) => ({
      orcamento_id: orcamentoId,
      codigo_analise: item.codigo_analise,
      n_amostras: item.quantidade_amostras,
      custo_unitario: item.custo_unitario,
      preco_unitario: item.preco_unitario,
      valor_snapshot: item.valor_snapshot,
    }));
    if (orcamentoItens.length > 0) {
      const { error: itensError } = await db.from("orcamento_itens").insert(orcamentoItens).select("id");
      if (itensError) return { message: itensError.message, pendentes: 0, registradas: itensComCusteio.length };
    }
    await db.from("orcamentos").update({
      status_operacional: itensSincronizados.length > 0 ? "preenchido" : "pendente",
      status_operacional_atualizado_em: new Date().toISOString(),
    }).eq("id", orcamentoId);
  }

  const resultado = {
    pendentes: itensComCusteio.filter((item) => item.status_custeio === "pendente").length,
    registradas: itensComCusteio.length,
  };
  return {
    message: null,
    pendentes: Number(resultado?.pendentes ?? itensComCusteio.filter((item) => item.status_custeio === "pendente").length),
    registradas: Number(resultado?.registradas ?? itensComCusteio.length),
  };
}

async function pendenciasCusteioAtuais(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demandaId: number,
) {
  const [{ data: analises }, { breakdowns }] = await Promise.all([
    supabase
      .from("demanda_analises")
      .select("codigo_analise")
      .eq("demanda_id", demandaId),
    calcularTodas(),
  ]);
  return (analises ?? [])
    .filter((item) => {
      const breakdown = breakdowns.find((b) => b.codigo === item.codigo_analise);
      return !breakdown || Number(breakdown.custoTotal) <= 0;
    })
    .map((item) => item.codigo_analise);
}

async function avaliarCompletudePersistida(
  supabase: Awaited<ReturnType<typeof createClient>>,
  demanda: Parameters<typeof avaliarCompletudeDemanda>[0] & { id?: number | null },
) {
  if (!demanda.id) return avaliarCompletudeDemanda(demanda);
  const { data } = await supabase
    .from("demanda_analises")
    .select("id")
    .eq("demanda_id", demanda.id);
  return avaliarCompletudeDemanda({
    ...demanda,
    analises_solicitadas: data?.length ?? 0,
  });
}

export async function criarDemandaCompleta(
  _prevState: DemandaFormState,
  formData: FormData,
): Promise<DemandaFormState> {
  const supabase = await createClient();
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);
  const quantidadePadrao = numeroOuNull(formData, "quantidade_amostras_estimada");
  const gruposAmostras = gruposFromForm(formData, quantidadePadrao);
  const analisesSolicitadas = analisesFromForm(formData, quantidadePadrao, gruposAmostras);
  const prazoCalculado = await calcularPrazoTecnicoAnalises(supabase, analisesSolicitadas);
  const demanda = {
    cliente_id: clienteId,
    projeto_id: numeroOuNull(formData, "projeto_id"),
    titulo: texto(formData, "titulo") || "Nova demanda",
    cliente_nome: cliente?.nome ?? texto(formData, "cliente_nome"),
    cliente_cnpj: cliente?.cnpj ?? texto(formData, "cliente_cnpj"),
    cliente_contato: cliente?.contato || cliente?.email || cliente?.telefone || texto(formData, "cliente_contato"),
    instituicao: texto(formData, "instituicao"),
    responsavel_interno: texto(formData, "responsavel_interno"),
    data_solicitacao: texto(formData, "data_solicitacao") ?? undefined,
    prazo_esperado: texto(formData, "prazo_esperado"),
    modalidade: normalizarModalidadeOrcamento(texto(formData, "modalidade")),
    status: texto(formData, "status") || "nova",
    origem: texto(formData, "origem"),
    prioridade: texto(formData, "prioridade") || "normal",
    descricao: texto(formData, "descricao"),
    escopo_preliminar: texto(formData, "escopo_preliminar"),
    matriz_amostra: gruposAmostras.map((grupo) => grupo.tipo_matriz).filter(Boolean).join("; ") || texto(formData, "matriz_amostra"),
    quantidade_amostras_estimada: gruposAmostras.reduce((total, grupo) => total + Number(grupo.quantidade_amostras || 0), 0) || quantidadePadrao,
    prazo_tecnico_dias: prazoCalculado ?? numeroOuNull(formData, "prazo_tecnico_dias"),
    observacoes: texto(formData, "observacoes"),
  };
  const completude = snapshotCompletude({
    ...demanda,
    analises_solicitadas: analisesSolicitadas.length,
  });
  const erros: Record<string, string> = {};
  if (!demanda.descricao) {
    erros.descricao = "Preencha a descrição do orçamento.";
  }
  if (Object.keys(erros).length > 0) {
    return { ok: false, message: "Complete os campos obrigatórios antes de criar o orçamento.", errors: erros };
  }

  const { data, error } = await supabase
    .from("demandas_propostas")
    .insert({
      ...demanda,
      completude_snapshot: completude,
      completude_atualizada_em: completude.atualizado_em,
    })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  const temProjetoAssociado = modalidadeExigeProjeto(demanda.modalidade) || Boolean(demanda.projeto_id);
  await garantirModulosDaDemanda(supabase, data.id, {
    laboratorio: false,
    projeto: temProjetoAssociado,
  });
  const resultadoAnalises = await sincronizarAnalisesDaDemanda(supabase, data.id, gruposAmostras, analisesSolicitadas);
  if (resultadoAnalises.message) return { ok: false, message: resultadoAnalises.message };
  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${data.id}`);
  redirect(`${listaPath}/${data.id}?etapa=${temProjetoAssociado ? "projeto" : "final"}`);
}

export async function salvarDemanda(
  _prevState: DemandaFormState,
  formData: FormData,
): Promise<DemandaFormState> {
  const id = Number(formData.get("demanda_id"));
  if (!id) return { ok: false, message: "Demanda inválida." };

  const supabase = await createClient();
  const escopoSalvamento = texto(formData, "escopo_salvamento") ?? "completo";
  const sincronizaAnalises = escopoSalvamento !== "demanda";
  const clienteId = numeroOuNull(formData, "cliente_id");
  const cliente = await clienteSnapshot(clienteId);
  const quantidadePadrao = numeroOuNull(formData, "quantidade_amostras_estimada");
  const gruposAmostras = gruposFromForm(formData, quantidadePadrao);
  const analisesSolicitadas = analisesFromForm(formData, quantidadePadrao, gruposAmostras);
  const prazoCalculado = sincronizaAnalises ? await calcularPrazoTecnicoAnalises(supabase, analisesSolicitadas) : null;

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
    modalidade: normalizarModalidadeOrcamento(texto(formData, "modalidade")),
    status: texto(formData, "status") || "nova",
    origem: texto(formData, "origem"),
    prioridade: texto(formData, "prioridade") || "normal",
    descricao: texto(formData, "descricao"),
    escopo_preliminar: texto(formData, "escopo_preliminar"),
    matriz_amostra: texto(formData, "matriz_amostra"),
    quantidade_amostras_estimada: quantidadePadrao,
    prazo_tecnico_dias: prazoCalculado ?? numeroOuNull(formData, "prazo_tecnico_dias"),
    observacoes: texto(formData, "observacoes"),
  };
  const completude = snapshotCompletude({
    ...patch,
    analises_solicitadas: analisesSolicitadas.length,
  });
  const erros: Record<string, string> = {};
  if (!patch.descricao) {
    erros.descricao = "Preencha a descrição do orçamento.";
  }

  const { error } = await supabase
    .from("demandas_propostas")
    .update({
      ...patch,
      completude_snapshot: completude,
      completude_atualizada_em: completude.atualizado_em,
    })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };
  await garantirModulosDaDemanda(supabase, id, { laboratorio: false, projeto: modalidadeExigeProjeto(patch.modalidade) || Boolean(patch.projeto_id) });
  const resultadoAnalises = sincronizaAnalises
    ? await sincronizarAnalisesDaDemanda(supabase, id, gruposAmostras, analisesSolicitadas)
    : null;
  if (resultadoAnalises?.message) return { ok: false, message: resultadoAnalises.message };
  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${id}`);
  const savedAt = completude.atualizado_em;
  const complementoAnalises = resultadoAnalises && resultadoAnalises.registradas > 0
    ? ` ${resultadoAnalises.registradas} análise(s) registrada(s).${resultadoAnalises.pendentes > 0 ? ` ${resultadoAnalises.pendentes} análise(s) sem custeio deverão ser revisadas antes da emissão.` : ""}`
    : "";
  if (erros.descricao) {
    return {
      ok: true,
      message: `Dados salvos.${complementoAnalises} Para concluir esta etapa, preencha a descrição do orçamento.`,
      errors: erros,
      savedAt,
    };
  }
  return { ok: true, message: `Demanda salva com sucesso.${complementoAnalises}`, savedAt };
}

export async function excluirDemandasSelecionadas(formData: FormData) {
  const supabase = await createClient();
  const escopo = String(formData.get("escopo") ?? "selecionadas");
  const idsSelecionados = formData.getAll("demanda_id").map((valor) => Number(valor)).filter((valor) => Number.isFinite(valor) && valor > 0);
  const ids = escopo === "todas"
    ? ((await supabase.from("demandas_propostas").select("id")).data ?? []).map((item) => Number(item.id))
    : idsSelecionados;

  if (ids.length === 0) {
    redirect(`${listaPath}?exclusao=nenhuma`);
  }

  const { data: orcamentos } = await supabase.from("orcamentos").select("id").in("demanda_id", ids);
  const orcamentoIds = (orcamentos ?? []).map((item) => Number(item.id));
  const { data: projetos } = await supabase.from("orcamento_projetos").select("id").in("demanda_id", ids);
  const projetoIds = (projetos ?? []).map((item) => Number(item.id));
  const db = supabase as unknown as {
    from: (table: string) => {
      delete: () => {
        in: (column: string, values: unknown[]) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  if (orcamentoIds.length > 0) {
    await db.from("orcamento_itens").delete().in("orcamento_id", orcamentoIds);
    await db.from("orcamentos").delete().in("id", orcamentoIds);
  }
  if (projetoIds.length > 0) {
    await db.from("orcamento_projeto_analises").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("orcamento_projeto_custos").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("orcamento_projeto_anexos").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("orcamento_projeto_links").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("orcamento_parametros_aplicados").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("parametros_economicos_versoes").delete().in("orcamento_projeto_id", projetoIds);
    await db.from("orcamento_projetos").delete().in("id", projetoIds);
  }
  await db.from("orcamento_final_versoes").delete().in("demanda_id", ids);
  await db.from("demanda_analises").delete().in("demanda_id", ids);
  await db.from("demanda_grupos_amostras").delete().in("demanda_id", ids);
  const { error } = await db.from("demandas_propostas").delete().in("id", ids);
  if (error) {
    redirect(`${listaPath}?exclusao=erro`);
  }
  revalidatePath(listaPath);
  redirect(`${listaPath}?exclusao=ok`);
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
  if (!(await avaliarCompletudePersistida(supabase, demanda)).completa) {
    redirect(`${listaPath}/${id}`);
  }
  if (!MODALIDADES_COM_ANALISES.has(demanda.modalidade)) {
    redirect(`${listaPath}/${id}`);
  }

  const { data: existente } = await supabase
    .from("orcamentos")
    .select("id")
    .eq("demanda_id", id)
    .neq("status", "cancelado")
    .limit(1)
    .maybeSingle();
  if (existente) {
    redirect(`/orcamento/${existente.id}`);
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
  if (!(await avaliarCompletudePersistida(supabase, demanda)).completa) {
    redirect(`${listaPath}/${id}`);
  }
  if (!MODALIDADES_COM_PROJETO.has(demanda.modalidade) && !demanda.projeto_id) {
    redirect(`${listaPath}/${id}`);
  }

  const { data: existente } = await supabase
    .from("orcamento_projetos")
    .select("id")
    .eq("demanda_id", id)
    .neq("status", "cancelado")
    .limit(1)
    .maybeSingle();
  if (existente) {
    redirect(`/orcamento/projetos/${existente.id}`);
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

export async function salvarParametrosEconomicosDaDemanda(formData: FormData) {
  const demandaId = numero(formData, "demanda_id");
  if (!demandaId) return;

  const patch = {
    margem_lucro: 0,
    impostos: 0,
    project_months: 12,
    impostos_legacy: numero(formData, "impostos_legacy"),
    incubacao: numero(formData, "incubacao"),
    reserva: numero(formData, "reserva"),
    investimentos: numero(formData, "investimentos"),
    lucro: numero(formData, "lucro"),
  };

  const validacao = validarParametrosProjetoGrossUp(patch);
  if (!validacao.ok) {
    redirect(`${listaPath}/${demandaId}?etapa=final&erro_parametros=${encodeURIComponent(validacao.message)}`);
  }

  await exigirPapelOrcamento("editar_parametros");
  const supabase = await createClient();
  const orcamentoProjetoId = await garantirRegistroParametrosEconomicos(supabase, demandaId);
  if (!orcamentoProjetoId) {
    redirect(`${listaPath}/${demandaId}?etapa=final&erro_parametros=${encodeURIComponent("Não foi possível localizar o orçamento para salvar parâmetros.")}`);
  }

  const { error } = await supabase.from("orcamento_projetos").update(patch).eq("id", orcamentoProjetoId);
  if (error) throw new Error(error.message);

  await registrarVersaoParametrosEconomicos(supabase, {
    escopo: "projeto",
    orcamentoProjetoId,
    parametros: patch,
    origem: "orcamento/demandas",
  });
  await registrarEvento(
    "orcamento_parametros",
    orcamentoProjetoId,
    "demanda",
    "alterado",
    "Parâmetros econômicos do orçamento atualizados a partir do fluxo da demanda.",
  );
  revalidatePath(listaPath);
  revalidatePath(`${listaPath}/${demandaId}`);
  if (String(formData.get("proxima_etapa") ?? "") === "final") {
    redirect(`${listaPath}/${demandaId}?etapa=final`);
  }
  redirect(`${listaPath}/${demandaId}?etapa=final`);
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

  const completude = await avaliarCompletudePersistida(supabase, demanda);
  if (!completude.completa) {
    redirect(`${listaPath}/${id}?erro_emissao=${encodeURIComponent("Complete a demanda antes de emitir o orçamento final.")}`);
  }
  const analisesPendentes = await pendenciasCusteioAtuais(supabase, id);
  if (analisesPendentes.length > 0) {
    redirect(`${listaPath}/${id}?erro_emissao=${encodeURIComponent(`Complete o custeio das análises antes da emissão: ${analisesPendentes.join(", ")}.`)}`);
  }

  const [{ data: orcamentos }, { data: orcProjetos }, { data: analisesDaDemanda }, { data: ultimaVersao }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("id, status, orcamento_itens(id, codigo_analise, n_amostras, custo_unitario, preco_unitario, valor_snapshot)")
      .eq("demanda_id", id)
      .order("id"),
      supabase
        .from("orcamento_projetos")
        .select("id, status, projeto_sem_custo_justificativa, impostos, margem_lucro, impostos_legacy, incubacao, reserva, investimentos, lucro, orcamento_projeto_analises(id, codigo_analise, n_amostras, custo_unitario, preco_unitario, valor_snapshot), orcamento_projeto_custos(id, rubrica, quantidade, custo_unitario, preco_unitario, meses_selecionados, valor_snapshot)")
        .eq("demanda_id", id)
        .order("id"),
    supabase
      .from("demanda_analises")
      .select("codigo_analise, quantidade_amostras, origem_quantidade")
      .eq("demanda_id", id)
      .order("codigo_analise"),
    supabase
      .from("orcamento_final_versoes")
      .select("versao")
      .eq("demanda_id", id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const exigeAnalises = MODALIDADES_COM_ANALISES.has(demanda.modalidade);
  const exigeProjeto = MODALIDADES_COM_PROJETO.has(demanda.modalidade) || Boolean(demanda.projeto_id);
  const itensProjeto = (orcProjetos ?? []).reduce((total, orcamento) => (
    total +
    (orcamento.orcamento_projeto_custos?.length ?? 0) +
    (exigeAnalises ? 0 : (orcamento.orcamento_projeto_analises?.length ?? 0)) +
    (orcamento.projeto_sem_custo_justificativa ? 1 : 0)
  ), 0);
  const statusProjeto = (orcProjetos ?? []).some((orcamento) => orcamento.status === "aprovado")
    ? "aprovado"
    : (orcProjetos ?? []).some((orcamento) => orcamento.status === "enviado")
      ? "enviado"
      : orcProjetos?.[0]?.status;
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
    laboratorioRevisado: true,
    projetoRevisado: moduloProjeto.status === "revisado" || moduloProjeto.status === "nao_exigido",
    itensLaboratorio: (orcamentos ?? []).flatMap((orcamento) => orcamento.orcamento_itens ?? []),
    itensProjeto: [
      ...(orcProjetos ?? []).flatMap((orcamento) => orcamento.orcamento_projeto_custos ?? []),
      ...(exigeAnalises ? [] : (orcProjetos ?? []).flatMap((orcamento) => orcamento.orcamento_projeto_analises ?? []).map((item) => ({
        rubrica: "MC",
        quantidade: Number(item.n_amostras),
        custo_unitario: Number(item.custo_unitario),
        preco_unitario: Number(item.preco_unitario),
        meses_selecionados: [],
      }))),
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
    analises_solicitadas: analisesDaDemanda ?? [],
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
