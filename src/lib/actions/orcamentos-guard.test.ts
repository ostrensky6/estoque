import { beforeEach, describe, expect, it, vi } from "vitest";

// Verifica a INTEGRACAO do guard de integridade na action de inclusao de item:
// analise bloqueada nao pode ser adicionada (insert nao acontece).

const revalidatePath = vi.fn();
const from = vi.fn();
const insert = vi.fn();
const assegurarAnaliseLiberada = vi.fn();
const assegurarAnalisesLiberadas = vi.fn();
const gravarSnapshotItem = vi.fn();
const calcularTodas = vi.fn(async () => ({ breakdowns: [] }));

class AnaliseBloqueadaError extends Error {}

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/costing/loader", () => ({ calcularTodas }));
vi.mock("./eventos", () => ({ registrarEvento: vi.fn() }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento: vi.fn() }));
vi.mock("@/lib/orcamento/snapshot-item", () => ({ gravarSnapshotItem }));
vi.mock("@/lib/cadastros/guard-custeio", () => ({
  assegurarAnaliseLiberada: (...a: unknown[]) => assegurarAnaliseLiberada(...a),
  assegurarAnalisesLiberadas: (...a: unknown[]) => assegurarAnalisesLiberadas(...a),
  AnaliseBloqueadaError,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

describe("adicionarItemOrcamento — trava de integridade", () => {
  beforeEach(() => {
    revalidatePath.mockClear();
    from.mockReset();
    insert.mockReset();
    assegurarAnaliseLiberada.mockReset();
    gravarSnapshotItem.mockReset();

    // Cadeia Supabase flexível: cada método encadeia; awaitable resolve {data:[]};
    // single() resolve um registro. insert() é rastreado separadamente.
    const chain: Record<string, unknown> = {};
    chain.insert = insert.mockReturnValue(chain);
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.update = vi.fn(() => chain);
    chain.single = vi.fn(async () => ({ data: { id: 99, status: "rascunho" }, error: null }));
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    from.mockReturnValue(chain);
  });

  it("nao insere quando a analise esta BLOQUEADA (sem override)", async () => {
    assegurarAnaliseLiberada.mockRejectedValue(new AnaliseBloqueadaError("BLOQUEADA: sem custo"));
    const { adicionarItemOrcamento } = await import("./orcamentos");
    const fd = new FormData();
    fd.set("orcamento_id", "1");
    fd.set("codigo_analise", "X1");
    fd.set("n_amostras", "5");

    await expect(adicionarItemOrcamento(fd)).rejects.toBeInstanceOf(AnaliseBloqueadaError);
    expect(insert).not.toHaveBeenCalled();
    expect(gravarSnapshotItem).not.toHaveBeenCalled();
  });

  it("insere e grava snapshot quando a analise esta liberada", async () => {
    assegurarAnaliseLiberada.mockResolvedValue({ codigo: "X1", status: "PRONTA", override: null });
    const { adicionarItemOrcamento } = await import("./orcamentos");
    const fd = new FormData();
    fd.set("orcamento_id", "1");
    fd.set("codigo_analise", "X1");
    fd.set("n_amostras", "5");

    await adicionarItemOrcamento(fd);
    expect(assegurarAnaliseLiberada).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(gravarSnapshotItem).toHaveBeenCalled();
  });
});
