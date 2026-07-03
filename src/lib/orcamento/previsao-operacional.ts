import { gargalo } from "@/lib/costing/engine";

export type AnaliseSolicitadaOperacao = {
  codigo_analise: string;
  quantidade_amostras: number | string | null;
};

export type EtapaOperacao = {
  codigo_analise: string;
  nome_etapa: string | null;
  nome_atividade: string | null;
  execucoes_por_dia: number | string | null;
  amostras_por_execucao: number | string | null;
  tempo_maquina_h?: number | string | null;
  tempo_bancada_h?: number | string | null;
};

export type InsumoOperacao = {
  codigo_analise: string;
  especificacao_insumo: string | null;
  unidade: string | null;
  quantidade_por_amostra: number | string | null;
  modo_cobranca: string | null;
  nome_etapa?: string | null;
  nome_atividade?: string | null;
};

export type PrevisaoOperacionalAnalise = {
  codigo_analise: string;
  quantidade_amostras: number;
  lote_padrao: number;
  lotes: number;
  capacidade_dia: number;
  prazo_dias: number | null;
  reagentes: Array<{
    especificacao: string;
    unidade: string;
    modo_cobranca: "por_amostra" | "por_execucao";
    consumo_total: number;
  }>;
};

const numero = (valor: number | string | null | undefined) => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function calcularPrevisaoOperacionalDemanda(args: {
  analises: AnaliseSolicitadaOperacao[];
  etapas: EtapaOperacao[];
  insumos: InsumoOperacao[];
}): PrevisaoOperacionalAnalise[] {
  return args.analises.map((analise) => {
    const quantidade = Math.max(1, Math.floor(numero(analise.quantidade_amostras) || 1));
    const etapas = args.etapas
      .filter((etapa) => etapa.codigo_analise === analise.codigo_analise)
      .map((etapa) => ({
        nome_etapa: etapa.nome_etapa ?? "",
        nome_atividade: etapa.nome_atividade ?? "",
        execucoes_por_dia: numero(etapa.execucoes_por_dia),
        amostras_por_execucao: numero(etapa.amostras_por_execucao),
        tempo_maquina_h: numero(etapa.tempo_maquina_h),
        tempo_bancada_h: numero(etapa.tempo_bancada_h),
      }));
    const capacidade = gargalo(etapas);
    const lotePadrao = Math.max(1, Math.floor(capacidade.amostrasPorExecucao || quantidade));
    const capacidadeDia = capacidade.amostrasDia > 0 ? capacidade.amostrasDia : lotePadrao;
    const lotes = Math.max(1, Math.ceil(quantidade / lotePadrao));
    const prazoDias = capacidadeDia > 0 ? Math.max(1, Math.ceil(quantidade / capacidadeDia)) : null;
    const reagentes = args.insumos
      .filter((insumo) => insumo.codigo_analise === analise.codigo_analise)
      .map((insumo) => {
        const porExecucao = insumo.modo_cobranca === "por_execucao";
        return {
          especificacao: insumo.especificacao_insumo ?? "Insumo sem especificação",
          unidade: insumo.unidade ?? "un",
          modo_cobranca: porExecucao ? "por_execucao" as const : "por_amostra" as const,
          consumo_total: numero(insumo.quantidade_por_amostra) * (porExecucao ? lotes : quantidade),
        };
      })
      .filter((insumo) => insumo.consumo_total > 0);

    return {
      codigo_analise: analise.codigo_analise,
      quantidade_amostras: quantidade,
      lote_padrao: lotePadrao,
      lotes,
      capacidade_dia: capacidadeDia,
      prazo_dias: prazoDias,
      reagentes,
    };
  });
}
