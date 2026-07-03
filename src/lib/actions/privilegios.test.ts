import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidatePath = vi.fn();
const temPapel = vi.fn();
const clientFrom = vi.fn();
const adminFrom = vi.fn();
const select = vi.fn();
const upsert = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/auth/roles", () => ({ temPapel }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: clientFrom })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: adminFrom })),
}));

describe("privilegios", () => {
  beforeEach(() => {
    vi.resetModules();
    revalidatePath.mockReset();
    temPapel.mockReset();
    clientFrom.mockReset();
    adminFrom.mockReset();
    select.mockReset();
    upsert.mockReset();

    clientFrom.mockReturnValue({ select });
    adminFrom.mockReturnValue({ upsert });
    select.mockResolvedValue({ data: [], error: null });
    upsert.mockResolvedValue({ error: null });
  });

  it("bloqueia leitura da matriz para nao-admin", async () => {
    temPapel.mockResolvedValue(false);
    const { obterMatrizPrivilegios } = await import("./privilegios");

    await expect(obterMatrizPrivilegios()).resolves.toBeNull();
    expect(clientFrom).not.toHaveBeenCalled();
  });

  it("le matriz de privilegios para admin", async () => {
    temPapel.mockResolvedValue(true);
    select.mockResolvedValue({
      data: [{ papel: "admin", permissoes: { "privilegios.gerenciar": true } }],
      error: null,
    });
    const { obterMatrizPrivilegios } = await import("./privilegios");

    const matriz = await obterMatrizPrivilegios();

    expect(matriz?.admin["privilegios.gerenciar"]).toBe(true);
    expect(clientFrom).toHaveBeenCalledWith("permissoes_categorias");
  });

  it("bloqueia salvamento de privilegios para nao-admin", async () => {
    temPapel.mockResolvedValue(false);
    const { salvarPrivilegiosPapel } = await import("./privilegios");

    const result = await salvarPrivilegiosPapel({ ok: false }, new FormData());

    expect(result.ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("salva privilegios por papel e revalida telas relacionadas", async () => {
    temPapel.mockResolvedValue(true);
    const formData = new FormData();
    formData.set("papel", "gestor");
    formData.append("permissoes", "analises.ver");
    formData.append("permissoes", "auditoria.visualizar");
    const { salvarPrivilegiosPapel } = await import("./privilegios");

    const result = await salvarPrivilegiosPapel({ ok: false }, formData);

    expect(result.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      papel: "gestor",
      permissoes: expect.objectContaining({
        "analises.ver": true,
        "auditoria.visualizar": true,
      }),
    }));
    expect(revalidatePath).toHaveBeenCalledWith("/governanca/privilegios");
    expect(revalidatePath).toHaveBeenCalledWith("/usuarios");
  });
});
