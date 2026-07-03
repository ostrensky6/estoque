import { describe, expect, it } from "vitest";
import { prepararTriagemCadastro } from "./triagem";

describe("prepararTriagemCadastro", () => {
  it("normaliza codigo desconhecido sem sugerir entidade", () => {
    expect(prepararTriagemCadastro("  abc  123  ")).toEqual({
      codigo: "abc  123",
      codigoNormalizado: "ABC 123",
      formato: "desconhecido",
      tipoSugerido: null,
      dadosExtraidos: {},
    });
  });

  it("extrai tipo sugerido de URL curta Kontrol", () => {
    expect(prepararTriagemCadastro("/s/lote/42")).toEqual({
      codigo: "/s/lote/42",
      codigoNormalizado: "/S/LOTE/42",
      formato: "url_kontrol",
      tipoSugerido: "lote",
      dadosExtraidos: {
        origem: "rota_curta",
        entidade_tipo: "lote",
        entidade_id: 42,
      },
    });
  });

  it("extrai tipo sugerido de codigo interno Kontrol", () => {
    expect(prepararTriagemCadastro("kontrol:eqpu:7")).toEqual({
      codigo: "kontrol:eqpu:7",
      codigoNormalizado: "KONTROL:EQPU:7",
      formato: "kontrol_interno",
      tipoSugerido: "equipamento_unidade",
      dadosExtraidos: {
        origem: "codigo_interno",
        entidade_tipo: "equipamento_unidade",
        entidade_id: 7,
      },
    });
  });
});
