import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});
const signInWithPassword = vi.fn();
const signOut = vi.fn(async () => ({ error: null }));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
  })),
}));

const { entrar } = await import("./auth");

function loginForm(senha: string) {
  const formData = new FormData();
  formData.set("email", "usuario@example.com");
  formData.set("senha", senha);
  return formData;
}

describe("login com senha provisória", () => {
  beforeEach(() => {
    redirect.mockClear();
    signInWithPassword.mockReset();
    signOut.mockClear();
  });

  it("aceita GIA2026 para usuário marcado pelo administrador", async () => {
    signInWithPassword.mockResolvedValue({
      data: {
        user: {
          app_metadata: {
            cadastrado_pelo_admin: true,
            senha_provisoria: true,
          },
        },
      },
      error: null,
    });

    await expect(entrar({ ok: false }, loginForm("GIA2026"))).rejects.toThrow(
      "NEXT_REDIRECT:/",
    );
    expect(signOut).not.toHaveBeenCalled();
  });

  it("recusa GIA2026 para usuário sem autorização administrativa", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { app_metadata: {} } },
      error: null,
    });

    await expect(entrar({ ok: false }, loginForm("GIA2026"))).resolves.toEqual({
      ok: false,
      message: "A senha provisória só pode ser usada por usuários cadastrados pelo administrador.",
    });
    expect(signOut).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });
});
