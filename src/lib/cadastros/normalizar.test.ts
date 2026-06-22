import { describe, it, expect } from "vitest";
import {
  chaveComparacao,
  chaveComparacaoCodigo,
  codigoCanonico,
  normalizarModoCobranca,
  normalizarTexto,
  normalizarUnidade,
  unidadesEquivalentes,
} from "./normalizar";

describe("normalizarTexto", () => {
  it("faz trim e colapsa espaços internos", () => {
    expect(normalizarTexto("  qPCR   sem   filtro  ")).toBe("qPCR sem filtro");
  });
  it("trata null/undefined como string vazia", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });
});

describe("chaveComparacao", () => {
  it("ignora caixa, acento e espaços externos", () => {
    expect(chaveComparacao("  Eletroforése ")).toBe(chaveComparacao("eletroforese"));
  });
  it("distingue textos realmente diferentes", () => {
    expect(chaveComparacao("kit A")).not.toBe(chaveComparacao("kit B"));
  });
});

describe("codigoCanonico / chaveComparacaoCodigo", () => {
  // teste 8 do plano: códigos em caixa diferente são normalizados
  it("normaliza variações de caixa para a mesma chave", () => {
    expect(chaveComparacaoCodigo("Illumina_Sh")).toBe(chaveComparacaoCodigo("illumina_sh"));
    expect(chaveComparacaoCodigo("qPCR_F")).toBe(chaveComparacaoCodigo("qpcr_f"));
    expect(chaveComparacaoCodigo("Sanger")).toBe(chaveComparacaoCodigo("sanger"));
  });
  it("converte espaços em underscore e remove caracteres inválidos", () => {
    expect(codigoCanonico(" qPCR F! ")).toBe("qPCR_F");
  });
  it("não colide códigos distintos", () => {
    expect(chaveComparacaoCodigo("qPCR_F")).not.toBe(chaveComparacaoCodigo("qPCR_SF"));
  });
});

describe("normalizarUnidade", () => {
  // teste 9 do plano: unidade equivalente é normalizada
  it("reconhece variações de microlitro", () => {
    expect(normalizarUnidade("uL")).toBe("uL");
    expect(normalizarUnidade("ul")).toBe("uL");
    expect(normalizarUnidade("µL")).toBe("uL"); // µ micro sign
    expect(normalizarUnidade("μL")).toBe("uL"); // μ greek mu
  });
  it("reconhece variações de unidade discreta", () => {
    expect(normalizarUnidade("un")).toBe("un");
    expect(normalizarUnidade("unid")).toBe("un");
    expect(normalizarUnidade("unidade")).toBe("un");
    expect(normalizarUnidade("un.")).toBe("un");
  });
  it("retorna null para unidade desconhecida (não inventa)", () => {
    expect(normalizarUnidade("xyz")).toBeNull();
    expect(normalizarUnidade("")).toBeNull();
    expect(normalizarUnidade(null)).toBeNull();
  });
  it("unidadesEquivalentes compara pela forma canônica", () => {
    expect(unidadesEquivalentes("uL", "ul")).toBe(true);
    expect(unidadesEquivalentes("mL", "L")).toBe(false);
  });
});

describe("normalizarModoCobranca", () => {
  it("aceita os dois modos válidos", () => {
    expect(normalizarModoCobranca("por_amostra")).toBe("por_amostra");
    expect(normalizarModoCobranca("Por Execucao")).toBe("por_execucao");
  });
  it("não trata null como por_amostra", () => {
    expect(normalizarModoCobranca(null)).toBeNull();
    expect(normalizarModoCobranca("")).toBeNull();
    expect(normalizarModoCobranca("kit")).toBeNull();
  });
});
