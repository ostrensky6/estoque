import { createClient } from "@/lib/supabase/server";
import {
  calcularAnalise,
  calcularAnaliseOrcamento,
  equipCustoDia,
  type Breakdown,
  type BreakdownOrcamento,
  type Cenario,
  type EquipAlloc,
  type Etapa,
  type InsumoLinha,
  type Parametros,
} from "./engine";

export type SimuladorAnalise = {
  codigo: string;
  etapas: Etapa[];
  equip: EquipAlloc[];
  insumos: InsumoLinha[];
  lotePadrao: number;
  grupos: Array<{ nome: string; opcoes: string[] }>;
};

/** Carrega tudo do banco e calcula o breakdown de todas as análises. */
export async function calcularTodas(
  cenarioPorAnalise: Record<string, Cenario> = {},
): Promise<{ breakdowns: Breakdown[]; params: Parametros; valorHoraPessoal: number; custoHoraOverhead: number }> {
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
    supabase.from("analises").select("codigo").order("codigo"),
    supabase.from("etapas").select("*"),
    supabase.from("equipamentos").select("*"),
    supabase.from("equipamento_analise").select("*"),
    supabase.from("tecnicos").select("*"),
    supabase.from("overhead").select("*"),
    supabase
      .from("insumo_analise")
      .select(
        "codigo_analise, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumos(custo_unitario)",
      ),
    supabase.from("parametros").select("chave, valor"),
  ]);

  const par = Object.fromEntries(
    (parametros ?? []).map((p) => [p.chave, Number(p.valor)]),
  );
  const params: Parametros = {
    dias_uteis_ano: par.dias_uteis_ano ?? 222,
    margem_lucro: par.margem_lucro ?? 0,
    impostos: par.impostos ?? 0,
    taxas: par.taxas ?? 0,
    fundo_reserva: par.fundo_reserva ?? 0,
    fundo_investimento: par.fundo_investimento ?? 0,
  };

  // valor-hora de pessoal = Σ valor_hh (custo_hora × %dedicado/100)
  const valorHoraPessoal = (tecnicos ?? []).reduce((acc, t) => {
    const custoHora =
      Number(t.horas_mes_base) > 0
        ? Number(t.valor_mes) / Number(t.horas_mes_base)
        : 0;
    return acc + (custoHora * Number(t.percentual_dedicado)) / 100;
  }, 0);

  // custo-hora de overhead = Σ (custo_mensal/horas_bancada_mes × %compensada/100)
  const custoHoraOverhead = (overhead ?? []).reduce((acc, o) => {
    const base =
      Number(o.horas_bancada_mes) > 0
        ? Number(o.custo_mensal) / Number(o.horas_bancada_mes)
        : 0;
    return acc + (base * Number(o.percentual_compensada)) / 100;
  }, 0);

  // custo/dia por equipamento (depreciação linear)
  const custoDiaPorEquip = new Map<number, number>();
  for (const e of equipamentos ?? []) {
    custoDiaPorEquip.set(e.id, equipCustoDia(e, params.dias_uteis_ano));
  }

  const breakdowns: Breakdown[] = (analises ?? []).map((a) => {
    const codigo = a.codigo;
    const etapasA = (etapas ?? []).filter((e) => e.codigo_analise === codigo);
    const equipA = (equipAnalise ?? [])
      .filter((ea) => ea.codigo_analise === codigo)
      .map((ea) => ({
        peso: Number(ea.peso_alocacao),
        custoDia: custoDiaPorEquip.get(ea.equipamento_id) ?? 0,
      }));
    const insumosA = (insumoAnalise ?? [])
      .filter((i) => i.codigo_analise === codigo)
      .map((i) => ({
        nome_etapa: i.nome_etapa,
        nome_atividade: i.nome_atividade,
        especificacao_insumo: i.especificacao_insumo,
        grupo_escolha: i.grupo_escolha,
        quantidade_por_amostra: i.quantidade_por_amostra,
        modo_cobranca: i.modo_cobranca,
        custo_unitario:
          (i.insumos as { custo_unitario: number | null } | null)
            ?.custo_unitario ?? null,
      }));

    return calcularAnalise({
      codigo,
      etapas: etapasA,
      equip: equipA,
      insumos: insumosA,
      valorHoraPessoal,
      custoHoraOverhead,
      params,
      cenario: cenarioPorAnalise[codigo],
    });
  });

  return { breakdowns, params, valorHoraPessoal, custoHoraOverhead };
}

export async function carregarSimuladorCusteio(): Promise<{
  analises: SimuladorAnalise[];
  params: Parametros;
  valorHoraPessoal: number;
  custoHoraOverhead: number;
}> {
  const { breakdowns, params, valorHoraPessoal, custoHoraOverhead } = await calcularTodas();
  const supabase = await createClient();
  const [
    { data: etapas },
    { data: equipamentos },
    { data: equipAnalise },
    { data: insumoAnalise },
  ] = await Promise.all([
    supabase.from("etapas").select("*"),
    supabase.from("equipamentos").select("*"),
    supabase.from("equipamento_analise").select("*"),
    supabase
      .from("insumo_analise")
      .select(
        "codigo_analise, nome_etapa, nome_atividade, especificacao_insumo, grupo_escolha, quantidade_por_amostra, modo_cobranca, insumo_id, insumos(custo_unitario)",
      ),
  ]);

  const custoDiaPorEquip = new Map<number, number>();
  for (const e of equipamentos ?? []) {
    custoDiaPorEquip.set(e.id, equipCustoDia(e, params.dias_uteis_ano));
  }

  return {
    params,
    valorHoraPessoal,
    custoHoraOverhead,
    analises: breakdowns.map((b) => {
      const linhas = (insumoAnalise ?? [])
        .filter((i) => i.codigo_analise === b.codigo)
        .map((i) => ({
          nome_etapa: i.nome_etapa,
          nome_atividade: i.nome_atividade,
          especificacao_insumo: i.especificacao_insumo,
          grupo_escolha: i.grupo_escolha,
          quantidade_por_amostra: i.quantidade_por_amostra,
          modo_cobranca: i.modo_cobranca,
          custo_unitario:
            (i.insumos as { custo_unitario: number | null } | null)?.custo_unitario ?? null,
          insumo_id: i.insumo_id,
        }));
      const grupos = [...new Set(linhas.map((l) => l.grupo_escolha).filter(Boolean) as string[])].map((grupo) => ({
        nome: grupo,
        opcoes: linhas
          .filter((l) => l.grupo_escolha === grupo)
          .map((l) => l.especificacao_insumo)
          .filter(Boolean) as string[],
      }));
      return {
        codigo: b.codigo,
        lotePadrao: b.lote,
        etapas: ((etapas ?? []) as Etapa[]).filter(
          (e) => (e as unknown as { codigo_analise: string }).codigo_analise === b.codigo,
        ),
        equip: (equipAnalise ?? [])
          .filter((ea) => ea.codigo_analise === b.codigo)
          .map((ea) => ({
            peso: Number(ea.peso_alocacao),
            custoDia: custoDiaPorEquip.get(ea.equipamento_id) ?? 0,
          })),
        insumos: linhas,
        grupos,
      };
    }),
  };
}

export async function calcularItemAnaliseOrcamento(
  codigo: string,
  numeroAmostras: number,
  cenario?: Cenario,
): Promise<BreakdownOrcamento | null> {
  const dados = await carregarSimuladorCusteio();
  const analise = dados.analises.find((item) => item.codigo === codigo);
  if (!analise) return null;

  return calcularAnaliseOrcamento({
    codigo,
    etapas: analise.etapas,
    equip: analise.equip,
    insumos: analise.insumos,
    valorHoraPessoal: dados.valorHoraPessoal,
    custoHoraOverhead: dados.custoHoraOverhead,
    params: dados.params,
    numeroAmostras,
    cenario,
  });
}
