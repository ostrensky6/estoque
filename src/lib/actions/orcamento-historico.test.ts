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
const rpc = vi.fn();
const exigirPapelOrcamento = vi.fn();
const registrarEvento = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/orcamento/governanca", () => ({ exigirPapelOrcamento }));
vi.mock("./eventos", () => ({ registrarEvento }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
    rpc,
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
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { alterado: true }, error: null });
    exigirPapelOrcamento.mockReset();
    registrarEvento.mockReset();
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ lt, eq, single });
    lt.mockResolvedValue({ data: [{ id: 91 }], error: null });
    select.mockReturnValue({ eq });
    single.mockResolvedValue({ data: null, error: null });
    insert.mockReturnValue({ select });
    from.mockReturnValue({ update, select, insert });
  });

  it("marca versoes emitidas vencidas", async () => {
    const { atualizarOrcamentosFinaisVencidos } = await import("./orcamento-historico");

    await atualizarOrcamentosFinaisVencidos();

    expect(eq).toHaveBeenCalledWith("status", "emitido");
    expect(lt).toHaveBeenCalledWith("valido_ate", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(rpc).toHaveBeenCalledWith("transicionar_orcamento_final", {
      p_versao_id: 91,
      p_status_destino: "vencido",
      p_motivo: "Validade expirada.",
    });
  });

  it("cancela versao final preservando snapshot", async () => {
    const { cancelarVersaoFinal } = await import("./orcamento-historico");
    const formData = new FormData();
    formData.set("versao_id", "55");
    formData.set("motivo", "Cliente cancelou");

    await cancelarVersaoFinal(formData);

    expect(rpc).toHaveBeenCalledWith("transicionar_orcamento_final", {
      p_versao_id: 55,
      p_status_destino: "cancelado",
      p_motivo: "Cliente cancelou",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/historico");
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento");
  });

  it("classifica versao final e revalida fundos quando aprovado", async () => {
    const { classificarVersaoFinal } = await import("./orcamento-historico");
    const formData = new FormData();
    formData.set("versao_id", "77");
    formData.set("status", "aprovado");
    formData.set("motivo", "Cliente aprovou a proposta");

    await classificarVersaoFinal(formData);

    expect(exigirPapelOrcamento).toHaveBeenCalledWith("classificar_final");
    expect(rpc).toHaveBeenCalledWith("transicionar_orcamento_final", {
      p_versao_id: 77,
      p_status_destino: "aprovado",
      p_motivo: "Cliente aprovou a proposta",
    });
    expect(update).not.toHaveBeenCalled();
    expect(registrarEvento).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/orcamento/fundos");
  });

  it("delega cancelamento e evento à mesma RPC atômica", async () => {
    const { cancelarVersaoFinal } = await import("./orcamento-historico");
    const formData = new FormData();
    formData.set("versao_id", "55");
    formData.set("motivo", "Cliente cancelou");

    await cancelarVersaoFinal(formData);

    expect(rpc).toHaveBeenCalledWith("transicionar_orcamento_final", {
      p_versao_id: 55,
      p_status_destino: "cancelado",
      p_motivo: "Cliente cancelou",
    });
    expect(update).not.toHaveBeenCalled();
    expect(registrarEvento).not.toHaveBeenCalled();
  });

  it("duplica com a identidade de operacao fornecida antes da action", async () => {
    const operacaoId = "44444444-4444-4444-8444-444444444444";
    rpc.mockResolvedValueOnce({ data: { id: 88, repetido: false }, error: null });
    redirect.mockImplementationOnce((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    });
    const { duplicarVersaoFinal } = await import("./orcamento-historico");
    const formData = new FormData();
    formData.set("versao_id", "55");
    formData.set("validade_dias", "30");
    formData.set("operacao_id", operacaoId);

    await expect(duplicarVersaoFinal(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/final/88",
    );

    expect(rpc).toHaveBeenCalledWith("duplicar_orcamento_final_transacional", {
      p_versao_id: 55,
      p_validade_dias: 30,
      p_operacao_id: operacaoId,
    });
  });
});
