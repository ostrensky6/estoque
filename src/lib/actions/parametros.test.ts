import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const from = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

function formulario(valores: Record<string, string>) {
  const formData = new FormData();
  formData.set("chaves", Object.keys(valores).join(","));
  for (const [chave, valor] of Object.entries(valores)) formData.set(`valor_${chave}`, valor);
  return formData;
}

describe("salvarParametros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ update });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ select });
  });

  it("confirma o salvamento quando a linha volta do banco", async () => {
    select.mockResolvedValue({ data: [{ chave: "impostos" }], error: null });
    const { salvarParametros } = await import("./parametros");

    const result = await salvarParametros({ ok: false }, formulario({ impostos: "12,5" }));

    expect(result.ok).toBe(true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ valor: 12.5 }));
    expect(select).toHaveBeenCalledWith("chave");
    expect(revalidatePath).toHaveBeenCalledWith("/custeio");
  });

  it("acusa erro quando o RLS não deixa gravar nada (0 linhas, sem error)", async () => {
    select.mockResolvedValue({ data: [], error: null });
    const { salvarParametros } = await import("./parametros");

    const result = await salvarParametros({ ok: false }, formulario({ impostos: "10" }));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Não foi possível salvar "impostos"/);
    expect(result.message).toMatch(/permissão/);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("repassa o erro do banco", async () => {
    select.mockResolvedValue({ data: null, error: { message: "permission denied" } });
    const { salvarParametros } = await import("./parametros");

    const result = await salvarParametros({ ok: false }, formulario({ taxas: "1" }));

    expect(result).toEqual({ ok: false, message: "permission denied" });
  });
});
