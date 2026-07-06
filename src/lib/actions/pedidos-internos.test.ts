import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const redirect = vi.fn();
const rpc = vi.fn();
const from = vi.fn();
const itemSingle = vi.fn();
const insumoInsert = vi.fn();
const insumoInsertSingle = vi.fn();
const insumoCategorySingle = vi.fn();
const pedidoFormalSingle = vi.fn();
const itensFormalOrder = vi.fn();
const compraFormalSingle = vi.fn();
const itensCompraInsert = vi.fn();
const pedidoStatusSingle = vi.fn();
const pedidoUpdate = vi.fn();
const pedidoUpdateEq = vi.fn();
const aprovacaoInsert = vi.fn();
const registrarEvento = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/roles", () => ({
  temPapel: vi.fn(async () => true),
  usuarioAtual: vi.fn(async () => ({ nome: "Coordenador", email: "coord@example.com", papel: "coordenador" })),
}));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, rpc })),
}));

function itemRecebimento() {
  return {
    id: 5,
    insumo_id: null,
    quantidade: 2,
    unidade: "frasco",
    especificacao: "Kit extração DNA",
    fornecedor_sugerido: "Fornecedor A",
    orcamento_previo: 150,
    recebido_em: null,
    pedidos_internos: {
      status: "aprovado_para_compra",
      projetos: { nome: "Projeto A" },
    },
  };
}

function formRecebimento(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const base: Record<string, string> = {
    item_id: "5",
    pedido_interno_id: "10",
    quantidade: "2",
    unidade: "frasco",
    novo_insumo: "Kit extração DNA",
    categoria_compra: "operacional",
    fator_conversao: "1",
    custo: "150",
  };
  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    formData.set(key, value);
  }
  return formData;
}

function configureSupabase() {
  from.mockImplementation((table: string) => {
    if (table === "pedidos_internos_itens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: itemSingle,
            })),
          })),
        })),
      };
    }
    if (table === "insumos") {
      return {
        insert: insumoInsert,
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: insumoCategorySingle,
          })),
        })),
      };
    }
    return {};
  });
  insumoInsert.mockReturnValue({
    select: vi.fn(() => ({
      single: insumoInsertSingle,
    })),
  });
}

function configureFormalizacaoSupabase() {
  let pedidosInternosSelectCount = 0;
  from.mockImplementation((table: string) => {
    if (table === "pedidos_internos") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => {
            pedidosInternosSelectCount += 1;
            return {
              single: pedidosInternosSelectCount === 1 ? pedidoFormalSingle : pedidoStatusSingle,
            };
          }),
        })),
        update: pedidoUpdate,
      };
    }
    if (table === "pedidos_internos_itens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: itensFormalOrder,
          })),
        })),
      };
    }
    if (table === "pedidos_compra") {
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: compraFormalSingle,
          })),
        })),
      };
    }
    if (table === "pedidos_compra_itens") {
      return { insert: itensCompraInsert };
    }
    if (table === "pedidos_internos_aprovacoes") {
      return { insert: aprovacaoInsert };
    }
    return {};
  });
  pedidoUpdate.mockReturnValue({ eq: pedidoUpdateEq });
  pedidoUpdateEq.mockResolvedValue({ error: null });
  aprovacaoInsert.mockResolvedValue({ error: null });
}

describe("recebimento de pedido interno", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    redirect.mockReset();
    rpc.mockReset();
    from.mockReset();
    itemSingle.mockReset();
    insumoInsert.mockReset();
    insumoInsertSingle.mockReset();
    insumoCategorySingle.mockReset();
    pedidoFormalSingle.mockReset();
    itensFormalOrder.mockReset();
    compraFormalSingle.mockReset();
    itensCompraInsert.mockReset();
    pedidoStatusSingle.mockReset();
    pedidoUpdate.mockReset();
    pedidoUpdateEq.mockReset();
    aprovacaoInsert.mockReset();
    registrarEvento.mockReset();

    configureSupabase();
    itemSingle.mockResolvedValue({ data: itemRecebimento(), error: null });
    insumoInsertSingle.mockResolvedValue({ data: { id: 77 }, error: null });
    insumoCategorySingle.mockResolvedValue({ data: { categoria_compra: "operacional" }, error: null });
    rpc.mockResolvedValue({ error: null });
  });

  it("bloqueia novo insumo sem categoria", async () => {
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const formData = formRecebimento({ categoria_compra: "" });

    const result = await receberItemPedidoInterno({ ok: false }, formData);

    expect(result).toEqual({
      ok: false,
      message: "Categoria de compra é obrigatória para cadastrar novo insumo no recebimento.",
    });
    expect(insumoInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloqueia novo insumo com fator_conversao invalido", async () => {
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const result = await receberItemPedidoInterno(
      { ok: false },
      formRecebimento({ fator_conversao: "0" }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Fator de conversão deve ser maior que zero.",
    });
    expect(insumoInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloqueia novo insumo sem custo", async () => {
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const result = await receberItemPedidoInterno(
      { ok: false },
      formRecebimento({ custo: "" }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Custo unitário é obrigatório para cadastrar novo insumo no recebimento.",
    });
    expect(insumoInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bloqueia novo insumo critico sem validade", async () => {
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const result = await receberItemPedidoInterno(
      { ok: false },
      formRecebimento({ categoria_compra: "critico" }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Validade é obrigatória para receber insumo crítico.",
    });
    expect(insumoInsert).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("permite novo insumo completo e chama a RPC de recebimento", async () => {
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const result = await receberItemPedidoInterno({ ok: false }, formRecebimento());

    expect(result).toEqual({ ok: true, message: "Item recebido e lançado em estoque." });
    expect(insumoInsert).toHaveBeenCalledWith({
      especificacao: "Kit extração DNA",
      unidade: "frasco",
      categoria_compra: "operacional",
      fator_conversao: 1,
      custo_unitario: 150,
    });
    expect(rpc).toHaveBeenCalledWith("receber_item_pedido_interno", expect.objectContaining({
      p_pedido_id: 10,
      p_item_id: 5,
      p_insumo_id: 77,
      p_quantidade: 2,
      p_custo: 150,
    }));
  });

  it("mantem fluxo com insumo existente operacional", async () => {
    itemSingle.mockResolvedValue({
      data: { ...itemRecebimento(), insumo_id: 88 },
      error: null,
    });
    const { receberItemPedidoInterno } = await import("./pedidos-internos");
    const result = await receberItemPedidoInterno(
      { ok: false },
      formRecebimento({ novo_insumo: "", insumo_id: "88" }),
    );

    expect(result.ok).toBe(true);
    expect(insumoInsert).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("receber_item_pedido_interno", expect.objectContaining({
      p_insumo_id: 88,
    }));
  });

  it("formaliza pedido interno mantendo vinculo entre item interno e item da compra formal", async () => {
    configureFormalizacaoSupabase();
    pedidoFormalSingle.mockResolvedValue({
      data: {
        id: 10,
        titulo: "Reagentes do projeto",
        status: "validado",
        solicitante: "solicitante@example.com",
        projeto_id: 3,
        pedido_compra_id: null,
      },
      error: null,
    });
    itensFormalOrder.mockResolvedValue({
      data: [
        { id: 5, insumo_id: 88, quantidade: 2, orcamento_previo: 150, especificacao: "Kit extração", observacao: null },
        { id: 6, insumo_id: null, quantidade: 1, orcamento_previo: 80, especificacao: "Serviço externo", observacao: null },
      ],
      error: null,
    });
    compraFormalSingle.mockResolvedValue({ data: { id: 20 }, error: null });
    itensCompraInsert.mockResolvedValue({ error: null });
    pedidoStatusSingle.mockResolvedValue({ data: { status: "validado" }, error: null });

    const { formalizarPedidoInterno } = await import("./pedidos-internos");
    const formData = new FormData();
    formData.set("pedido_interno_id", "10");

    const result = await formalizarPedidoInterno({ ok: false }, formData);

    expect(result.ok).toBe(true);
    expect(itensCompraInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        pedido_id: 20,
        insumo_id: 88,
        pedido_interno_item_id: 5,
        quantidade: 2,
        custo_unitario_estimado: 150,
      }),
    ]);
    expect(pedidoUpdate).toHaveBeenCalledWith(expect.objectContaining({
      pedido_compra_id: 20,
      status: "formalizado",
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/compras");
  });

  it("bloqueia recebimento interno quando o item tem compra formal pendente", async () => {
    itemSingle.mockResolvedValue({
      data: {
        ...itemRecebimento(),
        pedidos_internos: {
          status: "aprovado_para_compra",
          projetos: { nome: "Projeto A" },
        },
      },
      error: null,
    });
    rpc.mockResolvedValue({
      error: { message: "Item vinculado a compra formal deve ser recebido pelo pedido de compra." },
    });
    const { receberItemPedidoInterno } = await import("./pedidos-internos");

    const result = await receberItemPedidoInterno({ ok: false }, formRecebimento());

    expect(result).toEqual({
      ok: false,
      message: "Item vinculado a compra formal deve ser recebido pelo pedido de compra.",
    });
  });
});
