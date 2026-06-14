import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0014_rls_por_papel.sql"),
  "utf8",
);
const aliasCleanupMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0015_rls_limpa_aliases_lotes.sql"),
  "utf8",
);

describe("RLS por papel", () => {
  it("remove policies abertas e instala predicado hierarquico", () => {
    expect(migration).toContain("drop policy if exists authenticated_all_");
    expect(migration).toContain("drop policy if exists anon_read_");
    expect(migration).toContain("create or replace function papel_minimo");
    expect(migration).toContain("array['tecnico','coordenador','gestor','admin']");
  });

  it("protege transicoes de lote por papel", () => {
    expect(migration).toContain("perform fn_exige_papel('coordenador');");
    expect(migration.match(/perform fn_exige_papel\('gestor'\);/g)?.length).toBeGreaterThanOrEqual(3);
    expect(migration).toContain("create or replace function aceitar_lote");
    expect(migration).toContain("create or replace function descartar_lote");
  });

  it("mantem estoque fisico sem mutacao direta por policy", () => {
    expect(migration).toContain(
      "Sem policies de insert/update/delete diretas em lotes/reservas/movimentações.",
    );
    expect(`${migration}\n${aliasCleanupMigration}`).toContain(
      "drop policy if exists authenticated_all_lotes",
    );
    expect(`${migration}\n${aliasCleanupMigration}`).toContain(
      "drop policy if exists authenticated_all_reservas",
    );
    expect(migration).not.toContain("rls_tecnico_insert_lotes_estoque");
    expect(migration).not.toContain("rls_tecnico_update_lotes_estoque");
    expect(migration).not.toContain("rls_tecnico_insert_reservas_estoque");
  });
});
