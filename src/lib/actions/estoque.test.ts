import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const single = vi.fn();
const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single,
        })),
      })),
    })),
  })),
}));

describe("actions de estoque", () => {
  beforeEach(() => {
    rpc.mockReset();
    single.mockReset();
    single.mockResolvedValue({ data: { categoria_compra: "operacional" }, error: null });
    revalidatePath.mockReset();
  });

  it("valida entrada de inventário antes de chamar a RPC", async () => {
    const { entradaInventario } = await import("./estoque");
    const formData = new FormData();
    formData.set("insumo_id", "1");
    formData.set("quantidade", "0");

    const result = await entradaInventario({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.errors?.quantidade).toBe("Deve ser > 0");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("exige validade para entrada de inventário de insumo crítico", async () => {
    single.mockResolvedValue({ data: { categoria_compra: "critico" }, error: null });
    const { entradaInventario } = await import("./estoque");
    const formData = new FormData();
    formData.set("insumo_id", "7");
    formData.set("quantidade", "12.5");

    const result = await entradaInventario({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.errors?.validade).toBe("Obrigatório para crítico");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("registra entrada de inventário por RPC e revalida a tela de estoque", async () => {
    rpc.mockResolvedValue({ error: null });
    const { entradaInventario } = await import("./estoque");
    const formData = new FormData();
    formData.set("insumo_id", "7");
    formData.set("quantidade", "12.5");
    formData.set("validade", "2026-12-31");
    formData.set("custo", "3.25");
    formData.set("codigo", "L-123");
    formData.set("fornecedor", "Fornecedor A");
    formData.set("motivo", "contagem cíclica");

    const result = await entradaInventario({ ok: false }, formData);

    expect(result).toEqual({
      ok: true,
      message: "Entrada de inventário registrada (lote em quarentena).",
    });
    expect(rpc).toHaveBeenCalledWith("entrada_inventario", {
      p_insumo_id: 7,
      p_quantidade: 12.5,
      p_validade: "2026-12-31",
      p_custo: 3.25,
      p_codigo: "L-123",
      p_fornecedor: "Fornecedor A",
      p_motivo: "contagem cíclica",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/estoque");
  });

  it("mantem transicoes de lote restritas a RPCs nomeadas", async () => {
    rpc.mockResolvedValue({ error: null });
    const { aceitarLote, bloquearLote, desbloquearLote, descartarLote } = await import("./estoque");
    const base = new FormData();
    base.set("lote_id", "9");

    await aceitarLote(base);
    const bloquear = new FormData();
    bloquear.set("lote_id", "9");
    bloquear.set("motivo", "Investigacao");
    await bloquearLote(bloquear);
    await desbloquearLote(base);
    const descartar = new FormData();
    descartar.set("lote_id", "9");
    descartar.set("justificativa", "Vencido");
    await descartarLote(descartar);

    expect(rpc.mock.calls.map(([fn]) => fn)).toEqual([
      "aceitar_lote",
      "bloquear_lote",
      "desbloquear_lote",
      "descartar_lote",
    ]);
  });

  it("registra baixa manual e ajuste de saldo por RPCs transacionais", async () => {
    rpc.mockResolvedValue({ error: null });
    const { baixarManualLote, ajustarSaldoLote } = await import("./estoque");
    const baixa = new FormData();
    baixa.set("lote_id", "9");
    baixa.set("quantidade", "2.5");
    baixa.set("motivo", "consumo extra");
    const ajuste = new FormData();
    ajuste.set("lote_id", "9");
    ajuste.set("quantidade_nova", "8");
    ajuste.set("motivo", "contagem cíclica");

    await baixarManualLote({ ok: false }, baixa);
    await ajustarSaldoLote({ ok: false }, ajuste);

    expect(rpc).toHaveBeenNthCalledWith(1, "baixa_manual_lote", {
      p_lote_id: 9,
      p_quantidade: 2.5,
      p_motivo: "consumo extra",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "ajustar_saldo_lote", {
      p_lote_id: 9,
      p_quantidade_nova: 8,
      p_motivo: "contagem cíclica",
    });
  });
});
