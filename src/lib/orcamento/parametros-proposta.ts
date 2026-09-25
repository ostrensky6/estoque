import type { RatesProposta } from "@/lib/orcamento/engine-economica";

/**
 * De onde vêm os percentuais da proposta (DEC-ORC-001, seção 9):
 * - com orçamento de projeto: os do projeto (comportamento de sempre);
 * - sem projeto: os gravados na própria proposta (migration 0118);
 * - nada gravado: os padrões de Parâmetros de custeio.
 */
export type OrigemParametros = "projeto" | "proposta" | "padrao";

type ProjetoRates = {
  impostos_legacy?: number | string | null;
  impostos?: number | string | null;
  incubacao?: number | string | null;
  reserva?: number | string | null;
  investimentos?: number | string | null;
  lucro?: number | string | null;
  margem_lucro?: number | string | null;
};

type PropostaRates = {
  param_impostos?: number | string | null;
  param_incubacao?: number | string | null;
  param_reserva?: number | string | null;
  param_investimentos?: number | string | null;
  param_lucro?: number | string | null;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Padrões globais (tabela parametros) no vocabulário da proposta. */
export function padroesDeParametrosGlobais(
  linhas: { chave: string; valor: number | string | null }[] | null | undefined,
): Required<{ [K in keyof RatesProposta]: number }> {
  const mapa = new Map((linhas ?? []).map((l) => [l.chave, num(l.valor)]));
  return {
    impostos_legacy: mapa.get("impostos") ?? 0,
    incubacao: mapa.get("taxas") ?? 0,
    reserva: mapa.get("fundo_reserva") ?? 0,
    investimentos: mapa.get("fundo_investimento") ?? 0,
    lucro: mapa.get("margem_lucro") ?? 0,
  };
}

export function propostaTemParametrosGravados(proposta: PropostaRates | null | undefined) {
  if (!proposta) return false;
  return [
    proposta.param_impostos,
    proposta.param_incubacao,
    proposta.param_reserva,
    proposta.param_investimentos,
    proposta.param_lucro,
  ].some((v) => v != null && v !== "");
}

export function resolverParametrosProposta(args: {
  projeto: ProjetoRates | null | undefined;
  proposta: PropostaRates | null | undefined;
  padroes: Required<{ [K in keyof RatesProposta]: number }>;
}): { rates: Required<{ [K in keyof RatesProposta]: number }>; origem: OrigemParametros } {
  const { projeto, proposta, padroes } = args;
  if (projeto) {
    return {
      origem: "projeto",
      rates: {
        impostos_legacy: num(projeto.impostos_legacy ?? projeto.impostos),
        incubacao: num(projeto.incubacao),
        reserva: num(projeto.reserva),
        investimentos: num(projeto.investimentos),
        lucro: num(projeto.lucro ?? projeto.margem_lucro),
      },
    };
  }
  if (propostaTemParametrosGravados(proposta)) {
    return {
      origem: "proposta",
      rates: {
        impostos_legacy: num(proposta?.param_impostos),
        incubacao: num(proposta?.param_incubacao),
        reserva: num(proposta?.param_reserva),
        investimentos: num(proposta?.param_investimentos),
        lucro: num(proposta?.param_lucro),
      },
    };
  }
  return { origem: "padrao", rates: { ...padroes } };
}
