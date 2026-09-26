import { describe, expect, it } from "vitest";
import {
  disponivelParaBaixa,
  loteBaixaDeDb,
  lotesParaBaixa,
  montarMotivoBaixa,
  situacaoBaixa,
  somarReservasPorLote,
  type LoteBaixa,
} from "./baixa";

const HOJE = "2026-09-25";

const lote = (overrides: Partial<LoteBaixa> = {}): LoteBaixa => ({
  id: 1,
  codigoLote: "L1",
  validade: "2026-12-31",
  quantidadeAtual: 5,
  reservado: 0,
  modeloQuantidade: "EMBALAGEM_FECHADA",
  status: "aceito",
  ...overrides,
});

describe("regras de baixa manual", () => {
  it("escolhe por FEFO e deixa lotes sem validade por último", () => {
    const lotes = [
      lote({ id: 3, validade: null }),
      lote({ id: 2, validade: "2027-01-10" }),
      lote({ id: 1, validade: "2026-10-01" }),
    ];
    expect(lotesParaBaixa(lotes, HOJE).map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it("vencido só com motivo Vencimento; não oferece quarentena, zerado ou todo reservado", () => {
    // vencido: sai do saldo só com o motivo Vencimento (0117)
    expect(situacaoBaixa(lote({ validade: "2026-09-24" }), HOJE)).toEqual({
      permitida: true,
      somenteVencimento: true,
    });
    expect(situacaoBaixa(lote({ validade: HOJE }), HOJE)).toEqual({ permitida: true });
    expect(situacaoBaixa(lote({ status: "quarentena" }), HOJE)).toMatchObject({ permitida: false, motivo: "Aguardando aceite." });
    expect(situacaoBaixa(lote({ quantidadeAtual: 0 }), HOJE)).toMatchObject({ permitida: false });
    expect(situacaoBaixa(lote({ reservado: 5 }), HOJE)).toMatchObject({ permitida: false });
  });

  it("embalagens fechadas só aceitam lote 'aceito'; legado aceita 'em_uso'", () => {
    expect(situacaoBaixa(lote({ status: "em_uso" }), HOJE).permitida).toBe(false);
    expect(situacaoBaixa(lote({ status: "em_uso", modeloQuantidade: "LEGADO" }), HOJE).permitida).toBe(true);
  });

  it("disponível desconta reservas e é inteiro para embalagens", () => {
    expect(disponivelParaBaixa(lote({ quantidadeAtual: 5, reservado: 1.5 }))).toBe(3);
    expect(disponivelParaBaixa(lote({ quantidadeAtual: 5, reservado: 1.5, modeloQuantidade: "LEGADO" }))).toBe(3.5);
  });

  it("soma reservas pendentes por lote", () => {
    const mapa = somarReservasPorLote([
      { lote_id: 1, quantidade: 3, quantidade_consumida: 1, status: "parcial" },
      { lote_id: 1, quantidade: 2, quantidade_consumida: 0, status: "reservado" },
      { lote_id: 1, quantidade: 9, quantidade_consumida: 0, status: "liberado" },
      { lote_id: null, quantidade: 4, status: "reservado" },
    ]);
    expect(mapa.get(1)).toBe(4);
  });

  it("converte o lote do banco usando a validade efetiva e o modelo", () => {
    expect(
      loteBaixaDeDb(
        {
          id: 7,
          codigo_lote: null,
          validade: "2027-01-01",
          validade_apos_abertura: "2026-11-01",
          quantidade_atual: "4",
          status: "em_uso",
          modelo_quantidade: null,
        },
        new Map([[7, 1]]),
      ),
    ).toEqual({
      id: 7,
      codigoLote: "LOTE-7",
      validade: "2026-11-01",
      quantidadeAtual: 4,
      reservado: 1,
      modeloQuantidade: "LEGADO",
      status: "em_uso",
    });
  });

  it("monta o motivo gravado na movimentação", () => {
    expect(montarMotivoBaixa("Perda/quebra", " frasco trincado ")).toBe("Perda/quebra: frasco trincado");
    expect(montarMotivoBaixa("Vencimento", "")).toBe("Vencimento");
  });
});
