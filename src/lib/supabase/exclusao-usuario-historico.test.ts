import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "0107_preservar_historico_ao_excluir_usuario.sql",
);

const constraints = [
  ["orcamento_final_versoes", "classificado_por", "orcamento_final_versoes_classificado_por_fkey"],
  ["orcamento_final_versoes", "criado_por", "orcamento_final_versoes_criado_por_fkey"],
  ["orcamento_fundos_acompanhamento", "atualizado_por", "orcamento_fundos_acompanhamento_atualizado_por_fkey"],
  ["orcamento_parametros_aplicados", "criado_por", "orcamento_parametros_aplicados_criado_por_fkey"],
  ["orcamento_projeto_anexos", "criado_por", "orcamento_projeto_anexos_criado_por_fkey"],
  ["orcamento_projeto_links", "criado_por", "orcamento_projeto_links_criado_por_fkey"],
  ["parametros_economicos_versoes", "criado_por", "parametros_economicos_versoes_criado_por_fkey"],
] as const;

const indexes = [
  "orcamento_final_versoes_classificado_por_idx",
  "orcamento_final_versoes_criado_por_idx",
  "orcamento_fundos_acompanhamento_atualizado_por_idx",
  "orcamento_parametros_aplicados_criado_por_idx",
  "orcamento_projeto_anexos_criado_por_idx",
  "orcamento_projeto_links_criado_por_idx",
  "parametros_economicos_versoes_criado_por_idx",
] as const;

describe("0107 preserva historico ao excluir usuario", () => {
  it("redefine exatamente as sete FKs historicas anulaveis", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const [table, column, constraint] of constraints) {
      expect(sql).toContain(`('${table}', '${column}', '${constraint}')`);
    }
    expect(sql).toMatch(/confdeltype\s+not in\s*\('a',\s*'n'\)/i);
    expect(sql).toMatch(/confupdtype\s+is distinct from\s+'a'/i);
    expect(sql).toMatch(/confmatchtype\s+is distinct from\s+'s'/i);
    expect(sql).toMatch(/condeferrable/i);
    expect(sql).toMatch(/on delete set null/i);
    expect(sql).toMatch(/validate constraint/i);
  });

  it("cria e valida um indice focal por FK", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const index of indexes) {
      expect(sql).toMatch(new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${index}`, "i"));
      expect(sql).toContain(`'${index}'`);
    }
    expect(sql).toMatch(/indisvalid/i);
    expect(sql).toMatch(/indisready/i);
    expect(sql).toMatch(/unnest\(i\.indkey\)\s+with\s+ordinality/i);
    expect(sql).not.toMatch(/i\.indkey::smallint\[\]/i);
  });

  it("falha fechada diante de schema divergente e limita locks", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/begin\s*;/i);
    expect(sql).toMatch(/set\s+local\s+lock_timeout/i);
    expect(sql).toMatch(/set\s+local\s+statement_timeout/i);
    expect(sql).toMatch(/raise\s+exception/i);
    expect(sql).toMatch(/commit\s*;/i);
    expect(sql).not.toMatch(/^\s*(insert|update|delete|truncate|drop\s+(table|schema|column))\b/im);
    expect(sql).not.toMatch(/\b(create|alter|drop)\s+(policy|trigger)\b/i);
    expect(sql).not.toMatch(/\bgrant\b/i);
  });

  it("permite somente o SET NULL referencial interno sem enfraquecer a imutabilidade", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.proteger_orcamento_final_emitido\(\)/i,
    );
    expect(sql).toMatch(/security\s+invoker/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*pg_catalog,\s*public/i);
    expect(sql).toMatch(/pg_trigger_depth\(\)\s*>\s*1/i);
    expect(sql).toMatch(/old\.criado_por\s+is\s+not\s+null/i);
    expect(sql).toMatch(/new\.criado_por\s+is\s+null/i);
    expect(sql).toMatch(
      /\(to_jsonb\(new\)\s*-\s*'criado_por'\)\s+is\s+not\s+distinct\s+from\s+\(to_jsonb\(old\)\s*-\s*'criado_por'\)/i,
    );
    expect(sql).toMatch(
      /new\.criado_por\s+is\s+distinct\s+from\s+old\.criado_por\s+and\s+not\s+desvinculo_referencial_de_autoria/i,
    );
    expect(sql).toMatch(/new\.status\s+is\s+distinct\s+from\s+old\.status/i);
    expect(sql).toMatch(/fn_marcador_transacional_autorizado/i);
    expect(sql).toMatch(/aclexplode\(coalesce\(p\.proacl,\s*acldefault\('f',\s*p\.proowner\)\)\)/i);
    expect(sql).toMatch(/t\.tgfoid\s*=\s*guard_function/i);
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.proteger_orcamento_final_emitido\(\)\s+from\s+public,\s*anon,\s*authenticated,\s*service_role\s*;\s*do\s+\$guard_validation\$/i,
    );
    expect(sql.match(/\brevoke\b/gi)).toHaveLength(1);
    expect(sql).not.toMatch(/alter\s+function\s+.+\s+owner\s+to/i);
  });

  it("preserva os contratos existentes de perfil, equipamento e auditoria", () => {
    const auth = readFileSync(join(root, "supabase", "migrations", "0005_auth.sql"), "utf8");
    const equipamentos = readFileSync(
      join(root, "supabase", "migrations", "0052_controle_equipamentos.sql"),
      "utf8",
    );
    const sql = readFileSync(migrationPath, "utf8");

    expect(auth).toMatch(/id\s+uuid\s+primary\s+key\s+references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i);
    expect(equipamentos).toMatch(/created_by\s+uuid\s+references\s+auth\.users\(id\)\s+on\s+delete\s+set\s+null/i);
    expect(equipamentos).toMatch(/usuario_id\s+uuid\s+references\s+auth\.users\(id\)\s+on\s+delete\s+set\s+null/i);
    expect(auth).toMatch(/insert\s+into\s+auditoria/i);
    expect(sql).not.toMatch(/\bperfis\b/i);
    expect(sql).not.toMatch(/\bequipamento_(reservas|manutencoes)\b/i);
    expect(sql).not.toMatch(/\bauditoria\b/i);
  });
});
