import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const redirect = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const single = vi.fn();
const from = vi.fn();
const rpc = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from, rpc })),
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
    rpc.mockReset();

    insert.mockResolvedValue({ error: null });
    // update/delete conferem as linhas afetadas com .select("id")
    eq.mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [{ id: 1 }], error: null }) });
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

  it("duplicarAnalise copia a análise inteira numa transação do banco (preserva preferencial)", async () => {
    rpc.mockResolvedValue({ data: { codigo: "PCR-002" }, error: null });
    const { duplicarAnalise } = await import("./receita");
    const formData = new FormData();
    formData.set("origem", "PCR-001");
    formData.set("novo_codigo", "PCR-002");

    await duplicarAnalise(formData);

    expect(rpc).toHaveBeenCalledWith("duplicar_analise", {
      p_origem: "PCR-001",
      p_novo: "PCR-002",
      p_nome: null,
    });
    expect(from).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/analises/PCR-002");

    // a cópia no banco usa todas as colunas das tabelas filhas (inclui preferencial)
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(process.cwd(), "supabase", "migrations", "0114_catalogo_analises_transacional.sql"),
      "utf8",
    );
    expect(sql).toContain("from information_schema.columns");
    expect(sql).toContain("array['etapas', 'equipamento_analise', 'insumo_analise'");
  });
});
