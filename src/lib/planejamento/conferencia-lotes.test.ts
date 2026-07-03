import { describe, expect, it } from "vitest";
import {
  loteSugeridoFefo,
  validarConferenciaLote,
  type LoteConferencia,
} from "./conferencia-lotes";

const lote = (overrides: Partial<LoteConferencia> = {}): LoteConferencia => ({
  id: 1,
  insumoId: 10,
  quantidadeAtual: 5,
  status: "aceito",
  validade: "2026-12-31",
  validadeAposAbertura: null,
  ...overrides,
});

describe("conferencia de lotes do planejamento", () => {
  it("sugere o lote FEFO disponivel mais antigo", () => {
    expect(loteSugeridoFefo([
      lote({ id: 2, validade: "2026-09-01" }),
      lote({ id: 1, validade: "2026-08-01" }),
    ])?.id).toBe(1);
  });

  it("ignora lote vencido, bloqueado ou sem saldo na sugestao FEFO", () => {
    expect(loteSugeridoFefo([
      lote({ id: 1, validade: "2026-01-01" }),
      lote({ id: 2, status: "bloqueado", validade: "2026-07-01" }),
      lote({ id: 3, quantidadeAtual: 0, validade: "2026-07-01" }),
      lote({ id: 4, validade: "2026-08-01" }),
    ], "2026-06-29")?.id).toBe(4);
  });

  it("bloqueia lote de outro insumo", () => {
    expect(validarConferenciaLote({
      lote: lote({ insumoId: 11 }),
      insumoEsperadoId: 10,
      loteSugeridoId: 1,
    }).ok).toBe(false);
  });

  it("exige justificativa para excecao FEFO", () => {
    const result = validarConferenciaLote({
      lote: lote({ id: 2 }),
      insumoEsperadoId: 10,
      loteSugeridoId: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("excecao_fefo");
  });

  it("aceita excecao FEFO justificada", () => {
    expect(validarConferenciaLote({
      lote: lote({ id: 2 }),
      insumoEsperadoId: 10,
      loteSugeridoId: 1,
      justificativa: "lote fisicamente separado antes da leitura",
    }).ok).toBe(true);
  });
});
