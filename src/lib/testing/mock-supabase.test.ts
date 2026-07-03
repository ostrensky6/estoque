import { afterEach, describe, expect, it } from "vitest";

import { createMockSupabaseClient } from "./mock-supabase";

type ScratchRow = { id: number; recebido_em: string | null };
type ScratchQuantidadeRow = { id: number; quantidade_atual: number };

afterEach(() => {
  // Limpa a tabela usada nos testes para nao vazar estado entre casos.
  const globalStore = globalThis as typeof globalThis & {
    __kontrolMockStore?: Record<string, unknown[]>;
  };
  if (globalStore.__kontrolMockStore) {
    globalStore.__kontrolMockStore.scratch_is = [];
    globalStore.__kontrolMockStore.scratch_quantidades = [];
  }
});

describe("mock supabase .is", () => {
  it("filtra linhas onde a coluna e null", async () => {
    const supabase = createMockSupabaseClient();

    await supabase.from("scratch_is").insert([
      { id: 1, recebido_em: null },
      { id: 2, recebido_em: "2026-06-20T10:00:00.000Z" },
      { id: 3, recebido_em: null },
    ]);

    const { data, error } = await supabase
      .from("scratch_is")
      .select("id, recebido_em")
      .is("recebido_em", null);

    expect(error).toBeNull();
    const ids = ((data ?? []) as ScratchRow[]).map((row) => row.id).sort();
    expect(ids).toEqual([1, 3]);
  });
});

describe("mock supabase comparadores", () => {
  it("filtra linhas com gt", async () => {
    const supabase = createMockSupabaseClient();

    await supabase.from("scratch_quantidades").insert([
      { id: 1, quantidade_atual: 0 },
      { id: 2, quantidade_atual: 1 },
      { id: 3, quantidade_atual: 10 },
    ]);

    const { data, error } = await supabase
      .from("scratch_quantidades")
      .select("id, quantidade_atual")
      .gt("quantidade_atual", 0);

    expect(error).toBeNull();
    const ids = ((data ?? []) as ScratchQuantidadeRow[]).map((row) => row.id).sort();
    expect(ids).toEqual([2, 3]);
  });
});
