/**
 * Viagens e diárias (rubrica VD) — cálculo automático de quantidades.
 * Portado do app ATGC Orçamentos e adaptado ao modelo do Kontrol: as linhas
 * de VD vivem em `orcamento_projeto_custos`; o tipo de despesa é inferido da
 * descrição/categoria e a quantidade é derivada dos parâmetros de viagem.
 */

export type ViagemInputs = {
  pessoas: number;
  dias_campo: number;
  fator_risco_dias: number;
  diarias_hospedagem: number;
  quartos: number;
  veiculos: number;
  distancia_km: number;
  consumo_km_l: number;
  pedagios: number;
  passagens_aereas: number;
};

export const viagemInputsPadrao: ViagemInputs = {
  pessoas: 0,
  dias_campo: 0,
  fator_risco_dias: 0,
  diarias_hospedagem: 0,
  quartos: 0,
  veiculos: 0,
  distancia_km: 0,
  consumo_km_l: 10,
  pedagios: 0,
  passagens_aereas: 0,
};

export function normalizarViagemInputs(parcial?: Partial<ViagemInputs> | null): ViagemInputs {
  return { ...viagemInputsPadrao, ...(parcial ?? {}) };
}

export type DespesaViagem =
  | "diaria"
  | "hospedagem"
  | "combustivel"
  | "pedagio"
  | "passagem"
  | "aluguel_veiculo"
  | "seguro"
  | "outro";

/** Infere o tipo estrutural da despesa de viagem a partir do texto. */
export function classificarDespesaViagem(descricao: string, categoria?: string | null): DespesaViagem {
  const texto = `${categoria ?? ""} ${descricao ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (texto.includes("aliment") || texto.includes("diaria")) return "diaria";
  if (texto.includes("hosped") || texto.includes("hotel") || texto.includes("pernoite")) return "hospedagem";
  if (texto.includes("combust") || texto.includes("gasolina") || texto.includes("diesel") || texto.includes("etanol")) return "combustivel";
  if (texto.includes("pedagio")) return "pedagio";
  if (texto.includes("passagem") || texto.includes("passagens") || texto.includes("aerea")) return "passagem";
  if (texto.includes("aluguel") || texto.includes("alugueis") || texto.includes("locacao")) return "aluguel_veiculo";
  if (texto.includes("seguro")) return "seguro";
  return "outro";
}

/**
 * Calcula a quantidade de uma linha de viagem a partir dos parâmetros.
 * Retorna `null` quando a despesa não é automatizável (tipo "outro"), para
 * que a quantidade informada manualmente seja preservada.
 */
export function calcularQuantidadeViagem(
  despesa: DespesaViagem,
  inputs: ViagemInputs,
): number | null {
  const risco = Math.max(0, Number(inputs.fator_risco_dias) || 0);
  const diasCampo = Math.max(0, Number(inputs.dias_campo) || 0) + risco;
  const diasHospedagem = Math.max(0, Number(inputs.diarias_hospedagem) || 0) + risco;

  switch (despesa) {
    case "diaria":
      return inputs.pessoas * diasCampo;
    case "seguro":
      return inputs.pessoas * diasCampo;
    case "hospedagem":
      return inputs.quartos * diasHospedagem;
    case "aluguel_veiculo":
      return inputs.veiculos * diasCampo;
    case "combustivel":
      return inputs.consumo_km_l > 0
        ? Math.ceil((inputs.distancia_km * Math.max(inputs.veiculos, 1)) / inputs.consumo_km_l)
        : 0;
    case "pedagio":
      return inputs.pedagios;
    case "passagem":
      return inputs.passagens_aereas;
    default:
      return null;
  }
}
