import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0041_demanda_analises_solicitadas.sql"),
  "utf8",
);

describe("RPC sincronizar_demanda_analises", () => {
  it("mantem sincronizacao de demanda e itens dentro de uma funcao Postgres", () => {
    expect(migration).toContain("create or replace function sincronizar_demanda_analises");
    expect(migration).toContain("for update");
    expect(migration).toContain("delete from demanda_analises");
    expect(migration).toContain("delete from orcamento_itens");
    expect(migration).toContain("insert into orcamento_itens");
  });

  it("bloqueia dados invalidos, duplicidade e orcamento fora de rascunho", () => {
    expect(migration).toContain("p_itens deve ser um array JSON");
    expect(migration).toContain("A mesma analise nao pode ser sincronizada mais de uma vez");
    expect(migration).toContain("Ha analise inexistente no catalogo oficial");
    expect(migration).toContain("Somente orcamento laboratorial em rascunho pode ser sincronizado pela demanda");
  });
});
