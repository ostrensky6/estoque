import { describe, expect, it, vi } from "vitest";

import { registrarVersaoParametrosEconomicos } from "./parametros-versionamento";

describe("registrarVersaoParametrosEconomicos", () => {
  it("incrementa a versao global e grava snapshot com usuario", async () => {
    const query = criarQuery({ versao: 2 });
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = criarSupabase(query, insert, "user-1");

    await registrarVersaoParametrosEconomicos(supabase, {
      escopo: "laboratorio_global",
      parametros: { margem_lucro: 20 },
      origem: "orcamento/parametros",
    });

    expect(query.eq).toHaveBeenCalledWith("escopo", "laboratorio_global");
    expect(query.is).toHaveBeenCalledWith("orcamento_projeto_id", null);
    expect(insert).toHaveBeenCalledWith({
      escopo: "laboratorio_global",
      orcamento_projeto_id: null,
      versao: 3,
      parametros: { margem_lucro: 20 },
      origem: "orcamento/parametros",
      criado_por: "user-1",
    });
  });

  it("incrementa a versao por projeto", async () => {
    const query = criarQuery(null);
    const insert = vi.fn(async () => ({ error: null }));
    const supabase = criarSupabase(query, insert, null);

    await registrarVersaoParametrosEconomicos(supabase, {
      escopo: "projeto",
      orcamentoProjetoId: 77,
      parametros: { impostos: 12, lucro: 18 },
      origem: "orcamento/projetos",
    });

    expect(query.eq).toHaveBeenCalledWith("escopo", "projeto");
    expect(query.eq).toHaveBeenCalledWith("orcamento_projeto_id", 77);
    expect(insert).toHaveBeenCalledWith({
      escopo: "projeto",
      orcamento_projeto_id: 77,
      versao: 1,
      parametros: { impostos: 12, lucro: 18 },
      origem: "orcamento/projetos",
      criado_por: null,
    });
  });
});

function criarQuery(ultima: { versao: number } | null) {
  const query = {
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: ultima })),
  };
  return query;
}

function criarSupabase(
  query: ReturnType<typeof criarQuery>,
  insert: ReturnType<typeof vi.fn>,
  userId: string | null,
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: userId ? { id: userId } : null },
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => query),
      insert,
    })),
  };
}
