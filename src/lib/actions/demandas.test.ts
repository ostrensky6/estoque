import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const demandaSingle = vi.fn();
const insert = vi.fn();
const demandaAnalisesSelect = vi.fn(() => ({
  eq: vi.fn(async () => ({ data: [], error: null })),
}));
const from = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
  })),
}));

function mockDemanda(demanda: Record<string, unknown>) {
  demandaSingle.mockResolvedValue({ data: demanda, error: null });
  from.mockImplementation((table: string) => {
    if (table === "demandas_propostas") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: demandaSingle,
          })),
        })),
      };
    }
    if (table === "demanda_analises") {
      return { select: demandaAnalisesSelect };
    }
    return { insert };
  });
}

describe("actions de demandas/propostas", () => {
  beforeEach(() => {
    redirect.mockClear();
    demandaSingle.mockReset();
    insert.mockReset();
    demandaAnalisesSelect.mockClear();
    from.mockReset();
  });

  it("bloqueia modulo laboratorial quando a modalidade e somente projeto", async () => {
    mockDemanda({
      id: 11,
      titulo: "Projeto",
      cliente_nome: "Cliente",
      modalidade: "projeto",
      projeto_id: 3,
      escopo_preliminar: "Escopo",
    });
    const { gerarOrcamentoAnalisesDaDemanda } = await import("./demandas");
    const formData = new FormData();
    formData.set("demanda_id", "11");

    await expect(gerarOrcamentoAnalisesDaDemanda(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/demandas/11",
    );

    expect(insert).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/orcamento/demandas/11");
  });

  it("bloqueia modulo de projeto quando a modalidade e somente analises", async () => {
    mockDemanda({
      id: 12,
      titulo: "Analises",
      cliente_nome: "Cliente",
      modalidade: "analises",
      escopo_preliminar: "Escopo",
      matriz_amostra: "Água",
      quantidade_amostras_estimada: 3,
    });
    const { gerarOrcamentoProjetoDaDemanda } = await import("./demandas");
    const formData = new FormData();
    formData.set("demanda_id", "12");

    await expect(gerarOrcamentoProjetoDaDemanda(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/demandas/12",
    );

    expect(insert).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/orcamento/demandas/12");
  });

  it("bloqueia geracao de modulo quando a demanda esta incompleta", async () => {
    mockDemanda({ id: 13, modalidade: "analises" });
    const { gerarOrcamentoAnalisesDaDemanda } = await import("./demandas");
    const formData = new FormData();
    formData.set("demanda_id", "13");

    await expect(gerarOrcamentoAnalisesDaDemanda(formData)).rejects.toThrow(
      "NEXT_REDIRECT:/orcamento/demandas/13",
    );

    expect(insert).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/orcamento/demandas/13");
  });
});
