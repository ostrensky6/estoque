import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const single = vi.fn();
const revalidatePath = vi.fn();
let origemLote: Record<string, { data: Array<{ id: number }>; error: { message: string } | null }>;
const from = vi.fn((table: string) => {
  if (table === "insumos") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ single })),
      })),
    };
  }
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        limit: vi.fn(async () => origemLote[table]),
      })),
    })),
  };
});

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/roles", () => ({
  usuarioAtual: vi.fn(async () => ({ nome: "Coordenador", email: "coord@example.com" })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc,
    from,
  })),
}));

describe("actions de estoque", () => {
  beforeEach(() => {
    rpc.mockReset();
    single.mockReset();
    single.mockResolvedValue({ data: { categoria_compra: "operacional" }, error: null });
    from.mockClear();
    origemLote = {
      pedidos_compra_item_recebimentos: { data: [], error: null },
      pedidos_internos_item_recebimentos: { data: [], error: null },
    };
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
    expect(rpc).toHaveBeenNthCalledWith(1, "aceitar_lote", {
      p_lote_id: 9,
      p_responsavel: "Coordenador",
      p_criterio: null,
    });
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

  it("estorna uma entrada pela RPC auditavel e revalida o estoque", async () => {
    rpc.mockResolvedValue({ error: null });
    const { estornarRecebimentoLote } = await import("./estoque");
    const formData = new FormData();
    formData.set("lote_id", "9");
    formData.set("motivo", "quantidade digitada incorretamente");

    const result = await estornarRecebimentoLote({ ok: false }, formData);

    expect(result).toEqual({ ok: true, message: "Entrada estornada." });
    expect(rpc).toHaveBeenCalledWith("estornar_recebimento_lote", {
      p_lote_id: 9,
      p_motivo: "quantidade digitada incorretamente",
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("pedidos_compra_item_recebimentos");
    expect(from).toHaveBeenCalledWith("pedidos_internos_item_recebimentos");
    expect(revalidatePath).toHaveBeenCalledWith("/estoque");
    expect(revalidatePath).toHaveBeenCalledWith("/estoque/lotes/9");
  });

  it.each([
    "pedidos_compra_item_recebimentos",
    "pedidos_internos_item_recebimentos",
  ])("recusa no servidor lote vinculado em %s", async (table) => {
    rpc.mockResolvedValue({ error: null });
    origemLote[table] = { data: [{ id: 41 }], error: null };
    const { estornarRecebimentoLote } = await import("./estoque");
    const formData = new FormData();
    formData.set("lote_id", "9");
    formData.set("motivo", "quantidade digitada incorretamente");

    const result = await estornarRecebimentoLote({ ok: false }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Este lote pertence a um recebimento vinculado. Faça o estorno pelo fluxo de Recebimento para reconciliar pedidos e histórico.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("repete a recusa de lote vinculado sem chamar a primitiva", async () => {
    rpc.mockResolvedValue({ error: null });
    origemLote.pedidos_internos_item_recebimentos = { data: [{ id: 42 }], error: null };
    const { estornarRecebimentoLote } = await import("./estoque");
    const formData = new FormData();
    formData.set("lote_id", "9");
    formData.set("motivo", "quantidade digitada incorretamente");

    const primeira = await estornarRecebimentoLote({ ok: false }, formData);
    const segunda = await estornarRecebimentoLote({ ok: false }, formData);

    expect(primeira).toEqual(segunda);
    expect(primeira.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("nao inicia estorno sem motivo auditavel", async () => {
    const { estornarRecebimentoLote } = await import("./estoque");
    const formData = new FormData();
    formData.set("lote_id", "9");

    const result = await estornarRecebimentoLote({ ok: false }, formData);

    expect(result.ok).toBe(false);
    expect(result.errors?.motivo).toBe("Obrigatório");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("nao mascara a negativa de autorizacao ao estornar", async () => {
    rpc.mockResolvedValue({ error: { message: "Acesso negado." } });
    const { estornarRecebimentoLote } = await import("./estoque");
    const formData = new FormData();
    formData.set("lote_id", "9");
    formData.set("motivo", "quantidade digitada incorretamente");

    const result = await estornarRecebimentoLote({ ok: false }, formData);

    expect(result).toEqual({ ok: false, message: "Acesso negado." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  describe("corrigirQuantidadeEmbalagens", () => {
    it("exige motivo e quantidade alvo inteira antes de chamar a RPC", async () => {
      const { corrigirQuantidadeEmbalagens } = await import("./estoque");
      const formData = new FormData();
      formData.set("insumo_id", "5");
      formData.set("quantidade_alvo", "2.5");

      const result = await corrigirQuantidadeEmbalagens({ ok: false }, formData);

      expect(result.ok).toBe(false);
      expect(result.errors?.quantidade_alvo).toBe("Use um número inteiro de embalagens");
      expect(result.errors?.motivo).toBe("Obrigatório");
      expect(rpc).not.toHaveBeenCalled();
    });

    it("envia a correcao pela RPC transacional com operacao_id gerado", async () => {
      rpc.mockResolvedValue({ error: null });
      const { corrigirQuantidadeEmbalagens } = await import("./estoque");
      const formData = new FormData();
      formData.set("insumo_id", "5");
      formData.set("quantidade_alvo", "2");
      formData.set("motivo", "contagem física divergente");

      const result = await corrigirQuantidadeEmbalagens({ ok: false }, formData);

      expect(result).toEqual({ ok: true, message: "Quantidade corrigida." });
      expect(rpc).toHaveBeenCalledOnce();
      const [fn, args] = rpc.mock.calls[0];
      expect(fn).toBe("corrigir_quantidade_embalagens_fechadas");
      expect(args).toMatchObject({
        p_insumo_id: 5,
        p_quantidade_alvo: 2,
        p_motivo: "contagem física divergente",
      });
      expect(typeof args.p_operacao_id).toBe("string");
      expect(revalidatePath).toHaveBeenCalledWith("/estoque");
      expect(revalidatePath).toHaveBeenCalledWith("/cadastros/insumos");
    });

    it("reutiliza o operacao_id enviado (reenvio idempotente sem duplicar)", async () => {
      rpc.mockResolvedValue({ error: null });
      const { corrigirQuantidadeEmbalagens } = await import("./estoque");
      const formData = new FormData();
      formData.set("insumo_id", "5");
      formData.set("quantidade_alvo", "2");
      formData.set("motivo", "contagem física divergente");
      formData.set("operacao_id", "22222222-2222-2222-2222-222222222222");

      await corrigirQuantidadeEmbalagens({ ok: false }, formData);

      expect(rpc).toHaveBeenCalledWith(
        "corrigir_quantidade_embalagens_fechadas",
        expect.objectContaining({ p_operacao_id: "22222222-2222-2222-2222-222222222222" }),
      );
    });

    it("propaga a negativa de autorizacao (papel insuficiente) sem revalidar", async () => {
      rpc.mockResolvedValue({ error: { message: "Sem permissão: requer papel coordenador ou superior." } });
      const { corrigirQuantidadeEmbalagens } = await import("./estoque");
      const formData = new FormData();
      formData.set("insumo_id", "5");
      formData.set("quantidade_alvo", "2");
      formData.set("motivo", "contagem física divergente");

      const result = await corrigirQuantidadeEmbalagens({ ok: false }, formData);

      expect(result).toEqual({
        ok: false,
        message: "Sem permissão: requer papel coordenador ou superior.",
      });
      expect(revalidatePath).not.toHaveBeenCalled();
    });
  });
});
