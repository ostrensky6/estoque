#!/usr/bin/env node
// Teste local: comprova que o preflight é SOMENTE LEITURA, sem tocar no banco.
// Estratégia: remover comentários (-- ...) e literais de string, e então garantir
// que NENHUM verbo de escrita/DDL aparece, e que os guard-rails de transação
// read-only estão presentes.
//
// Uso: node scripts/sql/verify-preflight-readonly.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(here, "preflight-orcamentos-duplicidades.sql");
const raw = readFileSync(sqlPath, "utf8");

// 1) Tira comentários de linha e literais '...'/"..." para não gerar falsos positivos.
const semComentarios = raw
  .split("\n")
  .map((linha) => {
    const i = linha.indexOf("--");
    return i >= 0 ? linha.slice(0, i) : linha;
  })
  .join("\n");
const semLiterais = semComentarios
  .replace(/'(?:[^']|'')*'/g, "''")
  .replace(/"(?:[^"]|"")*"/g, '""');

const codigo = semLiterais.toLowerCase();

// 2) Verbos proibidos (escrita/DDL). \b garante palavra inteira.
const proibidos = [
  "insert", "update", "delete", "truncate", "drop", "alter",
  "create", "grant", "revoke", "merge", "copy", "call", "do ",
  "commit", // o script deve terminar em rollback, nunca commit
];
const encontrados = proibidos.filter((verbo) =>
  new RegExp(`\\b${verbo.trim()}\\b`).test(codigo),
);

// 3) Guard-rails obrigatórios de transação read-only.
const exigeReadOnly = /set\s+transaction\s+read\s+only/.test(codigo);
const exigeRollback = /\brollback\b/.test(codigo);
const exigeBegin = /\bbegin\b/.test(codigo);

const problemas = [];
if (encontrados.length > 0) problemas.push(`verbos de escrita/DDL encontrados: ${encontrados.join(", ")}`);
if (!exigeBegin) problemas.push("faltando BEGIN");
if (!exigeReadOnly) problemas.push("faltando SET TRANSACTION READ ONLY");
if (!exigeRollback) problemas.push("faltando ROLLBACK");

if (problemas.length > 0) {
  console.error("✗ PREFLIGHT NÃO é seguramente somente-leitura:");
  for (const p of problemas) console.error(`  - ${p}`);
  process.exit(1);
}

console.log("✓ Preflight é SOMENTE LEITURA:");
console.log("  - nenhum verbo de escrita/DDL (insert/update/delete/truncate/drop/alter/create/grant/...)");
console.log("  - envolto em BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;");
process.exit(0);
