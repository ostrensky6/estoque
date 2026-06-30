import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const insert = vi.fn();
const update = vi.fn();
const from = vi.fn(() => ({ insert, update }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClientUntyped: vi.fn(async () => ({ from })),
}));

function formInsumo(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  const base: Record<string, string> = {
    _slug: "insumos",
    especificacao: "Master mix qPCR",
    custo_total_embalagem: "500",
    quantidade_embalagem: "100",
    unidade: "frasco",
    unidade_consumo: "reacao",
    fator_conversao: "100",
  };

  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    formData.set(key, value);
  }

  return formData;
}

describe("cadastro de insumos", () => {
  beforeEach(() => {
    revalidatePath.mockReset();
    from.mockClear();
    insert.mockReset();
    update.mockReset();
    insert.mockResolvedValue({ error: null });
    update.mockResolvedValue({ error: null });
  });

  it("bloqueia fator de conversao zero ou negativo", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo({ fator_conversao: "0" }));

    expect(result.ok).toBe(false);
    expect(result.errors?.fator_conversao).toBe("Mínimo 0.000001");
    expect(from).not.toHaveBeenCalled();
  });

  it("bloqueia quantidade de embalagem zerada", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo({ quantidade_embalagem: "0" }));

    expect(result.ok).toBe(false);
    expect(result.errors?.quantidade_embalagem).toBe("Mínimo 0.000001");
    expect(from).not.toHaveBeenCalled();
  });

  it("calcula custo unitario e salva fator/unidade de consumo", async () => {
    const { salvarRegistro } = await import("./cadastros");
    const result = await salvarRegistro({ ok: false }, formInsumo());

    expect(result).toEqual({ ok: true, message: "Criado." });
    expect(from).toHaveBeenCalledWith("insumos");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        especificacao: "Master mix qPCR",
        quantidade_embalagem: 100,
        unidade: "frasco",
        unidade_consumo: "reacao",
        fator_conversao: 100,
        custo_unitario: 5,
      }),
    );
  });
});
