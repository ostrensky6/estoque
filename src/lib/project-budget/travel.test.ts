import { describe, expect, it } from "vitest";
import {
  calcularQuantidadeViagem,
  classificarDespesaViagem,
  normalizarViagemInputs,
} from "./travel";

describe("classificarDespesaViagem", () => {
  it("classifica por descrição/categoria, ignorando acentos e caixa", () => {
    expect(classificarDespesaViagem("Diárias de alimentação")).toBe("diaria");
    expect(classificarDespesaViagem("Hospedagem em hotel")).toBe("hospedagem");
    expect(classificarDespesaViagem("Combustível (gasolina)")).toBe("combustivel");
    expect(classificarDespesaViagem("Pedágio")).toBe("pedagio");
    expect(classificarDespesaViagem("Passagens aéreas")).toBe("passagem");
    expect(classificarDespesaViagem("Locação de veículo")).toBe("aluguel_veiculo");
    expect(classificarDespesaViagem("Seguro viagem")).toBe("seguro");
    expect(classificarDespesaViagem("Item qualquer")).toBe("outro");
  });
});

describe("calcularQuantidadeViagem", () => {
  const inputs = normalizarViagemInputs({
    pessoas: 3,
    dias_campo: 4,
    fator_risco_dias: 1,
    diarias_hospedagem: 3,
    quartos: 2,
    veiculos: 2,
    distancia_km: 600,
    consumo_km_l: 10,
    pedagios: 5,
    passagens_aereas: 6,
  });

  it("diária = pessoas × (dias_campo + risco)", () => {
    expect(calcularQuantidadeViagem("diaria", inputs)).toBe(3 * 5);
  });
  it("hospedagem = quartos × (diárias + risco)", () => {
    expect(calcularQuantidadeViagem("hospedagem", inputs)).toBe(2 * 4);
  });
  it("combustível = ceil(distância × max(veículos,1) / consumo)", () => {
    expect(calcularQuantidadeViagem("combustivel", inputs)).toBe(Math.ceil((600 * 2) / 10));
  });
  it("locação de veículo = veículos × (dias_campo + risco)", () => {
    expect(calcularQuantidadeViagem("aluguel_veiculo", inputs)).toBe(2 * 5);
  });
  it("pedágio e passagem repassam o valor informado", () => {
    expect(calcularQuantidadeViagem("pedagio", inputs)).toBe(5);
    expect(calcularQuantidadeViagem("passagem", inputs)).toBe(6);
  });
  it("despesa não automatizável retorna null (preserva quantidade manual)", () => {
    expect(calcularQuantidadeViagem("outro", inputs)).toBeNull();
  });
});
