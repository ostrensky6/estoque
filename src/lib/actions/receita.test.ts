import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const redirect = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const single = vi.fn();
const from = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

function materialForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const base: Record<string, string> = {
    codigo_analise: "PCR-001",
    nome_etapa: "Preparo",
    nome_atividade: "PCR",
    especificacao_insumo: "Master mix",
    unidade: "uL",
    modo_cobranca: "por_amostra",
  };

  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    formData.set(key, value);
  }

  return formData;
}

describe("actions de receita - vinculo de materiais", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    redirect.mockReset();
    insert.mockReset();
    update.mockReset();
    eq.mockReset();
    select.mockReset();
    single.mockReset();
    from.mockReset();

    insert.mockResolvedValue({ error: null });
    eq.mockResolvedValue({ error: null });
    single.mockResolvedValue({ data: null, error: null });
    select.mockReturnValue({ eq });
    update.mockReturnValue({ eq });
    from.mockReturnValue({ insert, update, select });
  });

  it("adicionarMaterial bloqueia consumo sem insumo_id", async () => {
    const { adicionarMaterial } = await import("./receita");

    await expect(
      adicionarMaterial(materialForm({ quantidade_por_amostra: "2" })),
    ).rejects.toThrow("Material com consumo informado precisa estar vinculado a um insumo de estoque.");

    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("atualizarMaterial bloqueia consumo sem insumo_id", async () => {
    const { atualizarMaterial } = await import("./receita");

    await expect(
      atualizarMaterial(materialForm({ id: "10", quantidade_por_amostra: "2" })),
    ).rejects.toThrow("Material com consumo informado precisa estar vinculado a um insumo de estoque.");

    expect(from).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("permite material sem consumo e sem vinculo", async () => {
    const { adicionarMaterial } = await import("./receita");

    await adicionarMaterial(materialForm());

    expect(from).toHaveBeenCalledWith("insumo_analise");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        insumo_id: null,
        quantidade_por_amostra: null,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/analises/PCR-001");
  });

  it("permite material com consumo quando ha insumo_id", async () => {
    const { adicionarMaterial } = await import("./receita");

    await adicionarMaterial(materialForm({ insumo_id: "7", quantidade_por_amostra: "2.5" }));

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        insumo_id: 7,
        quantidade_por_amostra: 2.5,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/custeio");
  });

  it("salva preferencial tecnico somente quando ha grupo de escolha", async () => {
    const { adicionarMaterial } = await import("./receita");

    await adicionarMaterial(
      materialForm({
        grupo_escolha: "kit",
        preferencial: "on",
        insumo_id: "7",
        quantidade_por_amostra: "1",
      }),
    );

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        grupo_escolha: "kit",
        preferencial: true,
      }),
    );
  });
});
