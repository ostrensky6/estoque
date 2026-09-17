import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase/migrations");
const file = readdirSync(dir).find((name) => /^0108_.*\.sql$/.test(name));
const sql = file ? readFileSync(join(dir, file), "utf8") : "";
const tables = [
  "projetos", "insumos", "equipamentos", "tecnicos", "overhead",
  "clientes", "fornecedores", "locais",
];

describe("RLS granular dos oito cadastros", () => {
  it("instala somente a migration 0108 aditiva com helper privado", () => {
    expect(file).toMatch(/^0108_/);
    expect(sql).toContain("create schema kontrol_private");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("p_chave is null");
    expect(sql).toContain("not suspenso");
    expect(sql).toContain("permissoes ? p_chave");
    expect(sql).toContain("permissoes_categorias");
    expect(sql).not.toMatch(/current_user\s*=|session_user\s*=/i);
  });

  it.each(tables)("substitui apenas as tres policies de %s", (table) => {
    expect(sql).toContain(`'${table}'`);
    expect(sql).toContain("for insert to authenticated with check");
    expect(sql).toContain("for update to authenticated using");
    expect(sql).toContain("for delete to authenticated using");
    expect(sql).toContain("'rls_coordenador_insert_' || t");
    expect(sql).toContain("'rls_coordenador_update_' || t");
    expect(sql).toContain("'rls_coordenador_delete_' || t");
  });

  it("mapeia as tres chaves sem OR amplo e falha fechado", () => {
    expect(sql).toContain("'projetos.editar'");
    expect(sql).toContain("'insumos.editar'");
    expect(sql).toContain("'cadastros.editar'");
    expect(sql).toContain("papel = 'admin'");
    expect(sql).toContain("jsonb_typeof");
    expect(sql).toContain("return false");
    expect(sql).toContain("revoke all on function kontrol_private.pode_editar_cadastro(text)");
    expect(sql).toContain("grant execute on function kontrol_private.pode_editar_cadastro(text) to authenticated");
  });
});
