import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase/migrations");
const file = readdirSync(dir).find((name) => /^0112_.*\.sql$/.test(name));
const sql = file ? readFileSync(join(dir, file), "utf8") : "";
const semComentarios = sql.replace(/--.*$/gm, "");
const posteriores = readdirSync(dir)
  .filter((name) => name > (file ?? "") && name.endsWith(".sql"))
  .map((name) => readFileSync(join(dir, name), "utf8"));
const srcRoot = join(process.cwd(), "src");

function arquivosTs(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entry) => {
    const caminho = join(pasta, entry.name);
    if (entry.isDirectory()) return arquivosTs(caminho);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [caminho] : [];
  });
}

describe("0112: salário dos técnicos protegido no banco", () => {
  it("é aditiva: não apaga tabela, coluna, dado, RLS nem trigger existente", () => {
    expect(file).toMatch(/^0112_salario_tecnicos_permissao\.sql$/);
    expect(semComentarios).not.toMatch(/drop\s+(table|column|policy|trigger|function|schema)/i);
    expect(semComentarios).not.toMatch(/\btruncate\b|\bdelete\s+from\b|disable\s+row\s+level/i);
    expect(semComentarios).not.toMatch(/alter\s+table[^;]*drop/i);
    // 0108 criou o schema; recriá-lo faria a 0108 falhar em reaplicações.
    expect(semComentarios).not.toContain("create schema");
  });

  it("semeia a permissão com padrão somente admin, preservando valores existentes", () => {
    expect(sql).toContain(`('admin', '{"tecnicos.salario.ver": true}'::jsonb)`);
    for (const papel of ["tecnico", "coordenador", "gestor"]) {
      expect(sql).toContain(`('${papel}', '{"tecnicos.salario.ver": false}'::jsonb)`);
    }
    expect(sql).toContain("excluded.permissoes || permissoes_categorias.permissoes");
  });

  it("avalia a permissão efetiva como a 0108 (admin, suspenso, perfil > categoria)", () => {
    expect(sql).toContain("create function kontrol_private.tem_permissao_efetiva(p_chave text)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog");
    expect(sql).toContain("not suspenso");
    expect(sql).toContain("v_papel = 'admin'");
    expect(sql).toContain("permissoes ? p_chave");
    expect(sql).toContain("jsonb_typeof(v_valor) = 'boolean'");
    expect(sql).toContain("kontrol_private.tem_permissao_efetiva('tecnicos.salario.ver')");
    expect(sql).toContain("grant execute on function public.tem_permissao(text) to authenticated");
  });

  it("revoga o SELECT direto de valor_mes e do preço do catálogo", () => {
    expect(sql).toContain("revoke select on public.tecnicos from anon, authenticated;");
    expect(sql).toMatch(
      /grant select \(id, nome, processo, horas_mes_base, percentual_dedicado\)\s+on public\.tecnicos to authenticated;/,
    );
    expect(sql).toContain("revoke select on public.orcamento_projeto_catalogo from anon, authenticated;");
    const grantCatalogo = sql.match(/grant select \(([^)]*)\)\s+on public\.orcamento_projeto_catalogo/);
    expect(grantCatalogo?.[1]).toBeDefined();
    expect(grantCatalogo?.[1]).not.toContain("preco_unitario");
  });

  it("expõe só leituras mascaradas/agregadas e rejeita escrita sem permissão", () => {
    expect(sql).toMatch(/case when a\.pode then t\.valor_mes end/);
    expect(sql).toMatch(/case when c\.rubrica = 'PE' and not a\.pode then null else c\.preco_unitario end/);
    expect(sql).toContain("create function public.valor_hora_pessoal_total()");
    expect(sql).toContain("before insert or update on public.tecnicos");
    expect(sql).toContain("before insert or update on public.orcamento_projeto_catalogo");
    expect(sql).toContain("errcode = '42501'");
  });

  it("audita técnicos sem vazar o salário e esconde a linha sigilosa via policy restritiva", () => {
    expect(sql).toContain("jsonb_build_object('valor_mes', 'XXX')");
    expect(sql).toContain("'tecnicos_remuneracao'");
    expect(sql).toContain("create trigger aud_tecnicos");
    expect(sql).toMatch(/create policy auditoria_salario_restrito on public\.auditoria\s+as restrictive/);
    expect(sql).toContain("(select kontrol_private.pode_ver_salario())");
  });

  it("nenhuma migration posterior reabre o SELECT de tabela", () => {
    for (const texto of posteriores) {
      expect(texto).not.toMatch(/grant\s+select\s+on\s+all\s+tables/i);
      expect(texto).not.toMatch(/grant\s+select\s+on\s+(public\.)?(tecnicos|orcamento_projeto_catalogo)\b/i);
    }
  });

  it("o app nunca lê tecnicos com select('*') nem o preço do catálogo direto da tabela", () => {
    for (const arquivo of arquivosTs(srcRoot)) {
      const fonte = readFileSync(arquivo, "utf8");
      expect(fonte, arquivo).not.toMatch(/from\("tecnicos"\)\s*\.select\("\*"\)/);
      expect(fonte, arquivo).not.toMatch(/from\("orcamento_projeto_catalogo"\)\s*\.select\([^)]*preco_unitario/);
    }
  });
});
