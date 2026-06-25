// Engine econômica AUTORITATIVA de Orçamentos — Política A (DEC-ORC-001, aprovada).
//
// Regra única para NOVAS propostas:
//   subtotal     = custo_laboratorial_tecnico + custo_direto_projeto
//   taxa_total   = soma_percentual_parametros / 100
//   se taxa_total >= 1 → BLOQUEIO (valido = false)
//   total_final  = subtotal / (1 - taxa_total)              (gross-up único)
//   valor_param  = total_final × (percentual_param / 100)
//
// Interpretação aprovada:
//   - laboratório entra como CUSTO TÉCNICO (não preço já formado);
//   - projeto entra como CUSTO DIRETO;
//   - os parâmetros (impostos, incubação, reserva, investimentos, lucro) incidem
//     sobre a proposta inteira, como percentuais "por dentro" (gross-up único);
//   - NÃO há gross-up separado por projeto e outro por proposta.
//
// Pura e determinística → o objeto retornado é um snapshot reproduzível.
import { roundMoney } from "@/lib/costing/pricing";

export const POLITICA_ECONOMICA = "A_GROSS_UP_TOTAL" as const;

export const FORMULA_ECONOMICA =
  "total_final = (custo_laboratorial_tecnico + custo_direto_projeto) / (1 - Σparametros/100)";

/** Parâmetros econômicos da proposta, na ordem canônica. */
export const PARAMETROS_PROPOSTA = [
  { chave: "impostos_legacy", label: "Impostos" },
  { chave: "incubacao", label: "Incubação" },
  { chave: "reserva", label: "Reserva" },
  { chave: "investimentos", label: "Investimentos" },
  { chave: "lucro", label: "Lucro" },
] as const;

export type ParametroEconomicoEntrada = { chave: string; label: string; percentual: number };
export type ParametroEconomicoCalculado = ParametroEconomicoEntrada & { valorNominal: number };

export type RatesProposta = {
  impostos_legacy?: number | null;
  incubacao?: number | null;
  reserva?: number | null;
  investimentos?: number | null;
  lucro?: number | null;
};

export type SnapshotEconomicoProposta = {
  politica: typeof POLITICA_ECONOMICA;
  custoLaboratorioTecnico: number;
  custoDiretoProjeto: number;
  subtotal: number;
  somaPercentual: number; // soma dos percentuais (ex.: 20)
  taxaTotal: number; // soma/100 (ex.: 0,20)
  fatorGrossUp: number; // 1/(1 - taxaTotal); 0 se bloqueado
  parametros: ParametroEconomicoCalculado[];
  totalParametros: number;
  totalFinal: number;
  valido: boolean;
  alertas: string[];
  formula: string;
};

function pctSeguro(value: number | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** Converte as taxas legadas do projeto nos parâmetros canônicos da proposta. */
export function parametrosDeRates(rates: RatesProposta | null | undefined): ParametroEconomicoEntrada[] {
  return PARAMETROS_PROPOSTA.map((p) => ({
    chave: p.chave,
    label: p.label,
    percentual: pctSeguro(rates?.[p.chave]),
  }));
}

/** Engine autoritativa (Política A). Recebe subtotais técnicos já calculados. */
export function calcularPropostaEconomica(args: {
  custoLaboratorioTecnico: number;
  custoDiretoProjeto: number;
  parametros: ParametroEconomicoEntrada[];
}): SnapshotEconomicoProposta {
  const lab = Math.max(0, Number(args.custoLaboratorioTecnico) || 0);
  const proj = Math.max(0, Number(args.custoDiretoProjeto) || 0);
  const subtotal = roundMoney(lab + proj);

  const entrada = (args.parametros ?? []).map((p) => ({
    chave: p.chave,
    label: p.label,
    percentual: pctSeguro(p.percentual),
  }));
  const somaPercentual = entrada.reduce((acc, p) => acc + p.percentual, 0);
  const taxaTotal = somaPercentual / 100;
  const valido = taxaTotal < 1;
  const fatorGrossUp = valido ? (taxaTotal > 0 ? 1 / (1 - taxaTotal) : 1) : 0;
  const totalFinal = valido ? roundMoney(subtotal * fatorGrossUp) : 0;

  const parametros: ParametroEconomicoCalculado[] = entrada.map((p) => ({
    ...p,
    valorNominal: valido ? roundMoney(totalFinal * (p.percentual / 100)) : 0,
  }));
  const totalParametros = valido ? roundMoney(Math.max(0, totalFinal - subtotal)) : 0;
  const alertas = valido ? [] : ["A soma dos parâmetros econômicos deve ser menor que 100%."];

  return {
    politica: POLITICA_ECONOMICA,
    custoLaboratorioTecnico: roundMoney(lab),
    custoDiretoProjeto: roundMoney(proj),
    subtotal,
    somaPercentual,
    taxaTotal,
    fatorGrossUp,
    parametros,
    totalParametros,
    totalFinal,
    valido,
    alertas,
    formula: FORMULA_ECONOMICA,
  };
}
