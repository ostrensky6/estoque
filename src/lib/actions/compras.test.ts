import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const redirect = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const itemSingle = vi.fn();
const pedidoSingle = vi.fn();
const itensPedidoEq = vi.fn();
const updatePedido = vi.fn();
const updatePedidoIdEq = vi.fn();
const updatePedidoStatusEq = vi.fn();
const registrarEvento = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/roles", () => ({
  temPapel: vi.fn(async () => true),
  usuarioAtual: vi.fn(async () => ({ nome: "Coordenador", email: "coord@example.com", papel: "coordenador" })),
}));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/costing/demanda", () => ({ computarDemandaPlano: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, rpc })),
}));

function formRecebimento(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const base: Record<string, string> = {
    pedido_id: "20",
    item_id: "8",
    quantidade_recebida: "3",
    codigo: "L-001",
  };
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    formData.set(key, value);
  }
  return formData;
}

function configureSupabase() {
  from.mockImplementation((table: string) => {
    if (table === "pedidos_compra_itens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn((column: string) => {
            if (column === "pedido_id") return itensPedidoEq();
            return {
              eq: vi.fn(() => ({
                single: itemSingle,
              })),
            };
          }),
        })),
      };
    }
    if (table === "pedidos_compra") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: pedidoSingle,
          })),
        })),
        update: updatePedido,
      };
    }
    return {};
  });
}

describe("recebimento de pedido formal de compra", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    redirect.mockReset();
    rpc.mockReset();
    from.mockReset();
    itemSingle.mockReset();
    pedidoSingle.mockReset();
    itensPedidoEq.mockReset();
    updatePedido.mockReset();
    updatePedidoIdEq.mockReset();
    updatePedidoStatusEq.mockReset();
    registrarEvento.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-29T12:00:00.000Z"));

    configureSupabase();
    itemSingle.mockResolvedValue({
      data: { insumo_id: 12, insumos: { categoria_compra: "operacional" } },
      error: null,
    });
    pedidoSingle.mockResolvedValue({ data: { status: "aprovado" }, error: null });
    itensPedidoEq.mockResolvedValue({ data: [], error: null });
    updatePedido.mockReturnValue({ eq: updatePedidoIdEq });
    updatePedidoIdEq.mockReturnValue({ eq: updatePedidoStatusEq });
    updatePedidoStatusEq.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("bloqueia insumo critico sem validade antes da RPC", async () => {
    itemSingle.mockResolvedValue({
      data: { insumo_id: 12, insumos: { categoria_compra: "critico" } },
      error: null,
    });
    const { receberItemPedido } = await import("./compras");

    await expect(receberItemPedido(formRecebimento())).rejects.toThrow(
      "Validade é obrigatória para receber insumo crítico.",
    );

    expect(rpc).not.toHaveBeenCalled();
  });

  it("mantem recebimento formal operacional", async () => {
    const { receberItemPedido } = await import("./compras");

    await receberItemPedido(formRecebimento({ validade: "2026-12-31" }));

    expect(rpc).toHaveBeenCalledWith("receber_item_pedido_compra", expect.objectContaining({
      p_pedido_id: 20,
      p_item_id: 8,
      p_quantidade: 3,
      p_validade: "2026-12-31",
      p_codigo: "L-001",
      p_responsavel: "Coordenador",
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/compras/20");
    expect(revalidatePath).toHaveBeenCalledWith("/estoque");
  });

  it("aprovarPedido usa lead time do insumo quando presente", async () => {
    pedidoSingle.mockResolvedValue({ data: { fornecedores: { prazo_medio_dias: 20 } }, error: null });
    itensPedidoEq.mockResolvedValue({
      data: [{ insumos: { lead_time_dias: 7, fornecedores: { prazo_medio_dias: 20 } } }],
      error: null,
    });
    const { aprovarPedido } = await import("./compras");
    const formData = new FormData();
    formData.set("pedido_id", "20");

    const result = await aprovarPedido({ ok: false }, formData);

    expect(result.ok).toBe(true);
    expect(updatePedido).toHaveBeenCalledWith(expect.objectContaining({
      data_prevista_entrega: "2026-07-06",
    }));
  });

  it("aprovarPedido cai para prazo medio do fornecedor quando insumo nao tem lead time", async () => {
    pedidoSingle.mockResolvedValue({ data: { fornecedores: { prazo_medio_dias: 20 } }, error: null });
    itensPedidoEq.mockResolvedValue({
      data: [{ insumos: { lead_time_dias: 0, fornecedores: { prazo_medio_dias: 12 } } }],
      error: null,
    });
    const { aprovarPedido } = await import("./compras");
    const formData = new FormData();
    formData.set("pedido_id", "20");

    await aprovarPedido({ ok: false }, formData);

    expect(updatePedido).toHaveBeenCalledWith(expect.objectContaining({
      data_prevista_entrega: "2026-07-11",
    }));
  });

  it("aprovarPedido usa maior prazo efetivo entre multiplos itens", async () => {
    pedidoSingle.mockResolvedValue({ data: { fornecedores: { prazo_medio_dias: 5 } }, error: null });
    itensPedidoEq.mockResolvedValue({
      data: [
        { insumos: { lead_time_dias: 4, fornecedores: { prazo_medio_dias: 30 } } },
        { insumos: { lead_time_dias: null, fornecedores: { prazo_medio_dias: 15 } } },
        { insumos: { lead_time_dias: 9, fornecedores: { prazo_medio_dias: 2 } } },
      ],
      error: null,
    });
    const { aprovarPedido } = await import("./compras");
    const formData = new FormData();
    formData.set("pedido_id", "20");

    await aprovarPedido({ ok: false }, formData);

    expect(updatePedido).toHaveBeenCalledWith(expect.objectContaining({
      data_prevista_entrega: "2026-07-14",
    }));
  });

  it("aprovarPedido sem itens usa fallback pelo fornecedor do cabecalho", async () => {
    pedidoSingle.mockResolvedValue({ data: { fornecedores: { prazo_medio_dias: 6 } }, error: null });
    itensPedidoEq.mockResolvedValue({ data: [], error: null });
    const { aprovarPedido } = await import("./compras");
    const formData = new FormData();
    formData.set("pedido_id", "20");

    await aprovarPedido({ ok: false }, formData);

    expect(updatePedido).toHaveBeenCalledWith(expect.objectContaining({
      data_prevista_entrega: "2026-07-05",
    }));
  });
});
