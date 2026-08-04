import { describe, expect, it } from "vitest";
import { CADASTROS } from "./config";
import { projetarTotaisInsumos, type LoteInsumo } from "./insumos";
import { workbookColumns } from "./xlsx";

const lote = (overrides: Partial<LoteInsumo> = {}): LoteInsumo => ({
  insumo_id: 1, status: "aceito", quantidade_atual: 2.5,
  validade: "2026-08-04", validade_apos_abertura: null, data_abertura: null, ...overrides,
});

describe("totais de unidades de insumos", () => {
  it("separa saldos fechados e abertos, incluindo fracoes", () => {
    const [insumo] = projetarTotaisInsumos([{ id: 1 }], [
      lote(), lote({ quantidade_atual: 1.25, data_abertura: "2026-08-01" }),
    ], "2026-08-04");
    expect(insumo).toMatchObject({ unidades_fechadas: 2.5, unidades_abertas: 1.25 });
  });

  it("mantem zero sem lote elegivel", () => {
    const [insumo] = projetarTotaisInsumos([{ id: 1 }], [lote({ status: "quarentena" })], "2026-08-04");
    expect(insumo).toMatchObject({ unidades_fechadas: 0, unidades_abertas: 0 });
  });

  it("exclui vencidos pela menor validade efetiva", () => {
    const [insumo] = projetarTotaisInsumos([{ id: 1 }], [
      lote({ validade: "2026-09-01", validade_apos_abertura: "2026-08-03" }),
      lote({ validade: "2026-08-03" }),
    ], "2026-08-04");
    expect(insumo).toMatchObject({ unidades_fechadas: 0, unidades_abertas: 0 });
  });

  it("expoe os cabecalhos pedidos no XLSX sem os campos ocultos", () => {
    const headers = workbookColumns(CADASTROS.insumos, [
      {
        id: 1,
        especificacao: "Item",
        fabricante: "Marca",
        unidade: "un",
        unidades_fechadas: 2,
        unidades_abertas: 1,
        tipo_insumo_id: 3,
        codigo_interno: "INT-1",
      },
    ]).map((coluna) => coluna.header);

    expect(headers.slice(1, 6)).toEqual([
      "Item específico / SKU",
      "Marca / fabricante",
      "Unidade",
      "Unidades fechadas",
      "Unidades abertas",
    ]);
    expect(headers).not.toContain("Tipo técnico");
    expect(headers).not.toContain("Código interno");
  });
});
