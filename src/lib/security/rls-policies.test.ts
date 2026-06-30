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
const orcamentoRlsMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/0075_rls_permissoes_orcamentos.sql"),
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

  it("endurece RLS no modulo orcamentos (Fase 11 - migration 0075)", () => {
    // Remove as policies amplas
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_final_versoes");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_parametros_aplicados");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_demanda_analises");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_demanda_grupos_amostras");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_eventos_status");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_projeto_anexos");
    expect(orcamentoRlsMigration).toContain("drop policy if exists authenticated_all_orcamento_projeto_links");

    // Restringe escritas em versoes e parametros a coordenador
    expect(orcamentoRlsMigration).toContain("create policy rls_coordenador_insert_orcamento_final_versoes");
    expect(orcamentoRlsMigration).toContain("create policy rls_coordenador_insert_orcamento_parametros_aplicados");
    expect(orcamentoRlsMigration).toContain("papel_minimo('coordenador')");

    // Restringe escrita de anexos, links e analises a tecnico
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_demanda_analises");
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_orcamento_projeto_anexos");
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_orcamento_projeto_links");
    expect(orcamentoRlsMigration).toContain("papel_minimo('tecnico')");

    // Bloqueia atualizacao/delecao de historicos em eventos_status (apenas insert)
    expect(orcamentoRlsMigration).toContain("create policy rls_tecnico_insert_eventos_status");
    expect(orcamentoRlsMigration).not.toContain("update_eventos_status");
    expect(orcamentoRlsMigration).not.toContain("delete_eventos_status");

    // Endurece RPC de emissao no banco de dados
    expect(orcamentoRlsMigration).toContain("perform fn_exige_papel('coordenador');");
    expect(orcamentoRlsMigration).toContain("revoke execute on function emitir_orcamento_final_transacional");
    expect(orcamentoRlsMigration).toContain("from public, anon;");
    expect(orcamentoRlsMigration).toContain("grant execute on function emitir_orcamento_final_transacional");
    expect(orcamentoRlsMigration).toContain("to authenticated, service_role;");
  });
});
