import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const from = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const lt = vi.fn();
const select = vi.fn();
const single = vi.fn();
const insert = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
  })),
}));

describe("actions de historico de orcamentos", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    redirect.mockReset();
    from.mockReset();
    update.mockReset();
    eq.mockReset();
    lt.mockReset();
    select.mockReset();
    single.mockReset();
    insert.mockReset();
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ lt, eq, single });
    lt.mockResolvedValue({ error: null });
    select.mockReturnValue({ eq });
    single.mockResolvedValue({ data: null, error: null });
    insert.mockReturnValue({ select });
    from.mockReturnValue({ update, select, insert });
  });

  it("marca versoes emitidas vencidas", async () => {
    const { atualizarOrcamentosFinaisVencidos } = await import("./orcamento-historico");

    await atualizarOrcamentosFinaisVencidos();

    expect(update).toHaveBeenCalledWith({ status: "vencido" });
    expect(eq).toHaveBeenCalledWith("status", "emitido");
    expect(lt).toHaveBeenCalledWith("valido_ate", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });

  it("cancela versao final preservando snapshot", async () => {
    const { cancelarVersaoFinal } = await import("./orcamento-historico");
    const formData = new FormData();
    formData.set("versao_id", "55");
    formData.set("motivo", "Cliente cancelou");

    await cancelarVersaoFinal(formData);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: "cancelado",
      cancelado_motivo: "Cliente cancelou",
    }));
    expect(eq).toHaveBeenCalledWith("id", 55);
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/historico");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento");
  });
});
