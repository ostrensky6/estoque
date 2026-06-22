import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  validarCadastros,
  type AnaliseIntegridade,
  type AnaliseParaValidar,
  type ContextoCusteio,
  type EquipamentoAnaliseInput,
  type EtapaInput,
  type InsumoAnaliseInput,
  type ResumoIntegridade,
} from "./validar-integridade";

type EquipRow = {
  id: number;
  nome: string;
  possui: boolean;
  quantidade: number | null;
  custo_unitario: number | null;
  vida_util_anos: number | null;
};

/**
 * Carrega todos os cadastros do custeio e roda o validador de integridade.
 * Mantém a leitura crua (sem recalcular preço) — a fonte autoritativa de
 * cálculo continua sendo a engine.
 */
export async function carregarIntegridadeCadastros(): Promise<ResumoIntegridade> {
  const supabase = await createClient();

  const [
    { data: analises },
    { data: etapas },
    { data: equipamentos },
    { data: equipAnalise },
    { data: tecnicos },
    { data: overhead },
    { data: insumoAnalise },
    { data: parametros },
  ] = await Promise.all([
    supabase.from("analises").select("codigo, nome, ativo, status").order("codigo"),
    supabase
      .from("etapas")
      .select(
        "id, codigo_analise, nome_etapa, nome_atividade, execucoes_por_dia, amostras_por_execucao, tempo_maquina_h, tempo_bancada_h, atividade_opcional, tipo_limitacao",
      ),
    supabase
      .from("equipamentos")
      .select("id, nome, possui, quantidade, custo_unitario, vida_util_anos"),
    supabase.from("equipamento_analise").select("id, equipamento_id, codigo_analise, peso_alocacao"),
    supabase.from("tecnicos").select("valor_mes, horas_mes_base, percentual_dedicado"),
    supabase.from("overhead").select("custo_mensal, percentual_compensada, horas_bancada_mes"),
    supabase
      .from("insumo_analise")
      .select(
        "id, codigo_analise, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumo_id, insumos(custo_unitario)",
      ),
    supabase.from("parametros").select("chave, valor"),
  ]);

  const par = Object.fromEntries((parametros ?? []).map((p) => [p.chave, Number(p.valor)]));
  const parametrosPresentes =
    typeof par.dias_uteis_ano === "number" && Number.isFinite(par.dias_uteis_ano) && par.dias_uteis_ano > 0;

  const valorHoraPessoal = (tecnicos ?? []).reduce((acc, t) => {
    const custoHora =
      Number(t.horas_mes_base) > 0 ? Number(t.valor_mes) / Number(t.horas_mes_base) : 0;
    return acc + (custoHora * Number(t.percentual_dedicado)) / 100;
  }, 0);

  const custoHoraOverhead = (overhead ?? []).reduce((acc, o) => {
    const base =
      Number(o.horas_bancada_mes) > 0 ? Number(o.custo_mensal) / Number(o.horas_bancada_mes) : 0;
    return acc + (base * Number(o.percentual_compensada)) / 100;
  }, 0);

  const ctx: ContextoCusteio = { valorHoraPessoal, custoHoraOverhead, parametrosPresentes };

  const equipPorId = new Map<number, EquipRow>();
  for (const e of (equipamentos ?? []) as EquipRow[]) equipPorId.set(e.id, e);

  const dados: AnaliseParaValidar[] = (analises ?? []).map((a) => {
    const codigo = a.codigo;

    const etapasA: EtapaInput[] = (etapas ?? [])
      .filter((e) => e.codigo_analise === codigo)
      .map((e) => ({
        id: e.id,
        nome_etapa: e.nome_etapa,
        nome_atividade: e.nome_atividade,
        execucoes_por_dia: e.execucoes_por_dia,
        amostras_por_execucao: e.amostras_por_execucao,
        tempo_maquina_h: e.tempo_maquina_h,
        tempo_bancada_h: e.tempo_bancada_h,
        atividade_opcional: e.atividade_opcional ?? false,
        tipo_limitacao: e.tipo_limitacao,
      }));

    const insumosA: InsumoAnaliseInput[] = (insumoAnalise ?? [])
      .filter((i) => i.codigo_analise === codigo)
      .map((i) => ({
        id: i.id,
        nome_etapa: i.nome_etapa,
        nome_atividade: i.nome_atividade,
        especificacao_insumo: i.especificacao_insumo,
        grupo_escolha: i.grupo_escolha,
        quantidade_por_amostra: i.quantidade_por_amostra,
        modo_cobranca: i.modo_cobranca,
        insumo_id: i.insumo_id,
        custo_unitario:
          (i.insumos as { custo_unitario: number | null } | null)?.custo_unitario ?? null,
      }));

    const equipamentosA: EquipamentoAnaliseInput[] = (equipAnalise ?? [])
      .filter((ea) => ea.codigo_analise === codigo)
      .map((ea) => {
        const eq = equipPorId.get(ea.equipamento_id);
        return {
          id: ea.id,
          equipamento_id: ea.equipamento_id,
          peso_alocacao: ea.peso_alocacao,
          equipamento: eq
            ? {
                nome: eq.nome,
                possui: eq.possui,
                quantidade: eq.quantidade,
                custo_unitario: eq.custo_unitario,
                vida_util_anos: eq.vida_util_anos,
              }
            : null,
        };
      });

    return {
      analise: { codigo: a.codigo, nome: a.nome, ativo: a.ativo, status: a.status },
      etapas: etapasA,
      insumos: insumosA,
      equipamentos: equipamentosA,
    };
  });

  return validarCadastros(dados, ctx);
}

/**
 * Mapa código→integridade, reutilizando o mesmo carregamento da tela. Usado pela
 * engine (`calcularTodas`) para anexar o status a cada breakdown e pelo guard de
 * custeio para decidir inclusão/bloqueio sem recalcular a validação em cada call
 * site.
 */
export async function carregarMapaIntegridade(): Promise<Map<string, AnaliseIntegridade>> {
  const resumo = await carregarIntegridadeCadastros();
  return new Map(resumo.analises.map((a) => [a.codigo, a]));
}

/** Integridade de uma única análise (ou null se o código não existe no catálogo). */
export async function carregarIntegridadeAnalise(
  codigo: string,
): Promise<AnaliseIntegridade | null> {
  const mapa = await carregarMapaIntegridade();
  return mapa.get(codigo) ?? null;
}
