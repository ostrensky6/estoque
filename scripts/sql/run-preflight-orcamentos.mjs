#!/usr/bin/env node
// Runner automatizado do preflight de Orçamentos. SOMENTE LEITURA.
//
// - valida que o SQL é read-only (verify-preflight-readonly + cada query de detalhe);
// - exige DATABASE_URL (falha claramente se ausente — nunca usa produção por engano);
// - conecta via psql, executa em transação READ ONLY e ROLLBACK;
// - confirma transaction_read_only = on;
// - salva output bruto + RESUMO + DETALHES + JSON + CSV em artifacts/.
// - NUNCA executa escrita; NUNCA imprime a string de conexão.
//
// Uso: DATABASE_URL=postgres://... [PREFLIGHT_ENV=homologacao] \
//        node scripts/sql/run-preflight-orcamentos.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assertReadOnly } from "./verify-preflight-readonly.mjs";
import { CHECKS } from "./preflight-checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const SQL_FILE = join(here, "preflight-orcamentos-duplicidades.sql");

function fail(msg, code = 1) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

// PGOPTIONS força read-only no servidor, mesmo que algo escape do begin/rollback.
const READONLY_ENV = { ...process.env, PGOPTIONS: "-c default_transaction_read_only=on" };

function psql(dbUrl, sql) {
  const args = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-t", "-A", dbUrl, "-c", sql];
  return spawnSync("psql", args, { env: READONLY_ENV, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function wrapReadOnly(innerSql, asJson) {
  const core = asJson
    ? `select coalesce(json_agg(row_to_json(t)), '[]'::json) as data from ( ${innerSql} ) t`
    : innerSql;
  return `begin;\nset transaction read only;\n${core};\nrollback;`;
}

function main() {
  const dbUrl = process.env.DATABASE_URL;
  const environment = process.env.PREFLIGHT_ENV || "desconhecido";

  // 1) DATABASE_URL obrigatório — sem fallback para produção.
  if (!dbUrl) {
    fail(
      "DATABASE_URL não definido. Defina a connection string (comece por HOMOLOGAÇÃO):\n" +
        "  DATABASE_URL=postgres://... PREFLIGHT_ENV=homologacao node scripts/sql/run-preflight-orcamentos.mjs\n" +
        "O runner NÃO usa produção por engano e não tem string padrão.",
      2,
    );
  }

  // 2) Validação read-only do arquivo .sql.
  const sqlRaw = readFileSync(SQL_FILE, "utf8");
  const fileCheck = assertReadOnly(sqlRaw, { requireTxnGuards: true });
  if (!fileCheck.ok) fail(`SQL de preflight não é somente-leitura: ${fileCheck.problemas.join("; ")}`);

  // 2b) Validação read-only de cada query de detalhe (sem guards próprios; o runner envolve).
  for (const c of CHECKS) {
    const r = assertReadOnly(c.sql, { requireTxnGuards: false });
    if (!r.ok) fail(`Query do check ${c.id} contém verbo proibido: ${r.problemas.join("; ")}`);
  }
  console.log("✓ Validação read-only: arquivo .sql e todas as queries de detalhe são SELECT puro.");

  // 3) psql disponível?
  const ver = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (ver.status !== 0) {
    fail(
      "psql não encontrado no PATH. Instale o cliente PostgreSQL (postgresql-client).\n" +
        "No GitHub Actions (ubuntu) já vem instalado.",
      3,
    );
  }

  // 4) Confirmar transaction_read_only = on.
  const ro = psql(dbUrl, "begin; set transaction read only; show transaction_read_only; rollback;");
  if (ro.status !== 0) {
    fail(`Falha ao conectar/checar read-only (psql exit ${ro.status}). stderr: ${(ro.stderr || "").trim()}`, 4);
  }
  const roValue = (ro.stdout || "").trim().split("\n").map((s) => s.trim()).filter(Boolean).pop();
  if (roValue !== "on") {
    fail(`transaction_read_only retornou "${roValue}" (esperado "on"). Abortando.`, 5);
  }
  console.log('✓ transaction_read_only = on (conexão confirmada como somente-leitura).');

  // 5) Output bruto (roda o arquivo inteiro: RESUMO + read-only + rollback).
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(repoRoot, "artifacts", "orcamento-preflight", ts);
  const detDir = join(outDir, "detalhes");
  mkdirSync(detDir, { recursive: true });

  const bruto = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", dbUrl, "-f", SQL_FILE], {
    env: READONLY_ENV,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const rawText = `# psql -f preflight (PGOPTIONS=read-only)\n# exit=${bruto.status}\n\n` +
    `## stdout\n${bruto.stdout || ""}\n\n## stderr\n${bruto.stderr || ""}\n`;
  writeFileSync(join(outDir, "preflight-resultado.txt"), rawText);

  // 6) Executar cada check (JSON estruturado) em transação read-only + rollback.
  const resultados = [];
  for (const c of CHECKS) {
    const res = psql(dbUrl, wrapReadOnly(c.sql, true));
    let rows = [];
    let erro = null;
    if (res.status !== 0) {
      erro = (res.stderr || "").trim();
      if (!c.tolerante) {
        // checks não-tolerantes não devem falhar; registra como erro mas segue.
        console.error(`! check ${c.id} retornou erro: ${erro}`);
      }
    } else {
      try {
        rows = JSON.parse((res.stdout || "[]").trim() || "[]");
      } catch (e) {
        erro = `falha ao parsear JSON: ${e.message}`;
      }
    }

    let ocorrencias;
    if (erro) {
      ocorrencias = null;
    } else if (c.tipoContagem === "coexistencia") {
      const mods = new Set(rows.map((r) => r.modalidade));
      const temLegada = mods.has("analises_projeto") || mods.has("projeto_analises_custos");
      const temCanonica = mods.has("projeto_com_analises");
      ocorrencias = temLegada && temCanonica ? rows.length : 0;
    } else {
      ocorrencias = rows.length;
    }

    // CSV por check (a partir das linhas JSON).
    const csv = linhasParaCsv(rows);
    writeFileSync(join(detDir, `${c.id}.csv`), csv);

    resultados.push({
      id: c.id,
      severidade: c.severidade,
      descricao: c.descricao,
      decisao: c.decisao,
      acao: c.acao,
      ocorrencias,
      erro: erro || undefined,
      tolerante: c.tolerante || false,
      amostra: rows.slice(0, 20),
    });
    const tag = erro ? "indisponível" : `${ocorrencias} ocorrência(s)`;
    console.log(`  ${c.id} [${c.severidade}] ${tag} — ${c.descricao}`);
  }

  // 7) JSON consolidado (sem nunca incluir a connection string).
  const meta = {
    timestamp: ts,
    geradoEm: new Date().toISOString(),
    environment,
    readOnlyConfirmado: true,
    rolledBack: true,
    totalChecks: resultados.length,
    semOcorrencias: resultados.filter((r) => r.ocorrencias === 0).length,
    comOcorrencias: resultados.filter((r) => typeof r.ocorrencias === "number" && r.ocorrencias > 0).length,
    indisponiveis: resultados.filter((r) => r.ocorrencias === null).length,
  };
  const json = { meta, resultados };
  writeFileSync(join(outDir, "preflight-resultados.json"), JSON.stringify(json, null, 2));

  // 8) Relatório Markdown.
  writeFileSync(join(outDir, "preflight-resumo.md"), gerarResumoMd(json));

  console.log(`\n✓ Concluído (READ ONLY + ROLLBACK). Artifacts em:\n  ${outDir}`);
  console.log(`  - preflight-resultado.txt (bruto)`);
  console.log(`  - preflight-resultados.json (estruturado)`);
  console.log(`  - preflight-resumo.md (relatório)`);
  console.log(`  - detalhes/A*.csv (por verificação)`);
  console.log(`\nNenhuma escrita foi feita; toda execução foi em transação READ ONLY revertida com ROLLBACK.`);
}

function linhasParaCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

function gerarResumoMd(json) {
  const { meta, resultados } = json;
  const linha = (r) => {
    const occ = r.ocorrencias === null ? "indisponível" : r.ocorrencias;
    return `| ${r.id} | ${r.severidade} | ${r.decisao} | ${occ} | ${r.descricao} | ${r.acao} |`;
  };
  const comOcc = resultados.filter((r) => typeof r.ocorrencias === "number" && r.ocorrencias > 0);
  const zero = resultados.filter((r) => r.ocorrencias === 0);
  const indisp = resultados.filter((r) => r.ocorrencias === null);
  return `# Preflight de Orçamentos — relatório automatizado

- Gerado em: ${meta.geradoEm}
- Ambiente: **${meta.environment}**
- READ ONLY confirmado: **${meta.readOnlyConfirmado ? "sim" : "não"}** · terminou em ROLLBACK: **${meta.rolledBack ? "sim" : "não"}**
- Total de checks: **${meta.totalChecks}** · com ocorrência: **${meta.comOcorrencias}** · zero: **${meta.semOcorrencias}** · indisponíveis: **${meta.indisponiveis}**

> Nenhuma limpeza foi executada e nenhum dado real foi alterado.

## Todos os checks

| ID | Severidade | Decisão | Ocorrências | Verificação | Ação recomendada |
|----|-----------|---------|------------:|-------------|------------------|
${resultados.map(linha).join("\n")}

## Checks com ocorrência > 0 (priorizar)

${comOcc.length === 0 ? "_Nenhum._" : comOcc.map((r) => `- **${r.id}** (${r.severidade}, ${r.decisao}): ${r.ocorrencias} — ${r.descricao}`).join("\n")}

## Checks com zero ocorrências

${zero.length === 0 ? "_Nenhum._" : zero.map((r) => `- ${r.id}: ${r.descricao}`).join("\n")}

${indisp.length ? `## Indisponíveis (ex.: schema não acessível)\n\n${indisp.map((r) => `- ${r.id}: ${r.erro || "n/d"}`).join("\n")}\n` : ""}
## Próximo passo

Rode o planejador dry-run (não toca no banco):
\`\`\`bash
node scripts/sql/plan-dedup-orcamentos-dry-run.mjs ${"${ARTIFACT_DIR}"}/preflight-resultados.json
\`\`\`
`;
}

main();
