import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/roles", () => ({
  usuarioAtual: vi.fn(),
}));

import { usuarioAtual } from "@/lib/auth/roles";
import { temPermissao } from "./permissoes";

const mockUsuario = vi.mocked(usuarioAtual);

beforeEach(() => {
  process.env.PLAYWRIGHT_MOCK_SUPABASE = "1";
  const g = globalThis as typeof globalThis & {
    __kontrolMockStore?: Record<string, unknown[]>;
  };
  if (g.__kontrolMockStore) {
    g.__kontrolMockStore.permissoes_papel = [
      { papel: "gerente", chave: "compras.aprovar", permitido: true },
      { papel: "usuário", chave: "compras.aprovar", permitido: false },
    ];
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("temPermissao", () => {
  it("administrador sempre true (sem consultar tabela)", async () => {
    mockUsuario.mockResolvedValue({
      id: "1",
      email: null,
      nome: null,
      papel: "administrador",
    } as never);
    expect(await temPermissao("usuarios.gerir")).toBe(true);
  });

  it("retorna o permitido da matriz para o papel", async () => {
    mockUsuario.mockResolvedValue({
      id: "1",
      email: null,
      nome: null,
      papel: "gerente",
    } as never);
    expect(await temPermissao("compras.aprovar")).toBe(true);
  });

  it("nega quando a matriz marca false", async () => {
    mockUsuario.mockResolvedValue({
      id: "1",
      email: null,
      nome: null,
      papel: "usuário",
    } as never);
    expect(await temPermissao("compras.aprovar")).toBe(false);
  });

  it("nega quando não há linha (ausência = negado)", async () => {
    mockUsuario.mockResolvedValue({
      id: "1",
      email: null,
      nome: null,
      papel: "usuário",
    } as never);
    expect(await temPermissao("backups.gerir")).toBe(false);
  });

  it("fail-closed sem usuário", async () => {
    mockUsuario.mockResolvedValue(null as never);
    expect(await temPermissao("compras.ver")).toBe(false);
  });
});
