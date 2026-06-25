#!/usr/bin/env node
// Comprova que SQL é SOMENTE LEITURA, sem tocar no banco.
// Estratégia: remover comentários (-- ...) e literais de string e garantir que
// NENHUM verbo de escrita/DDL aparece. Para o arquivo de preflight, exige também
// os guard-rails de transação read-only (begin / set transaction read only / rollback).
//
// Uso CLI:   node scripts/sql/verify-preflight-readonly.mjs [arquivo.sql]
// Uso módulo: import { assertReadOnly } from "./verify-preflight-readonly.mjs"
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const VERBOS_PROIBIDOS = [
  "insert", "update", "delete", "truncate", "drop", "alter",
  "create", "grant", "revoke", "merge", "copy", "call", "do",
  "commit", // o preflight nunca deve dar commit
];

/** Remove comentários de linha e literais '...'/"..." para evitar falsos positivos. */
export function normalizarSql(raw) {
  const semComentarios = raw
    .split("\n")
    .map((linha) => {
      const i = linha.indexOf("--");
      return i >= 0 ? linha.slice(0, i) : linha;
    })
    .join("\n");
  return semComentarios
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
    .toLowerCase();
}

/**
 * Retorna { ok, problemas[] }.
 * @param {string} raw  SQL bruto.
 * @param {{ requireTxnGuards?: boolean }} [opts]
 */
export function assertReadOnly(raw, opts = {}) {
  const requireTxnGuards = opts.requireTxnGuards ?? true;
  const codigo = normalizarSql(raw);

  const encontrados = VERBOS_PROIBIDOS.filter((verbo) =>
    new RegExp(`\\b${verbo}\\b`).test(codigo),
  );

  const problemas = [];
  if (encontrados.length > 0) {
    problemas.push(`verbos de escrita/DDL encontrados: ${encontrados.join(", ")}`);
  }
  if (requireTxnGuards) {
    if (!/\bbegin\b/.test(codigo)) problemas.push("faltando BEGIN");
    if (!/set\s+transaction\s+read\s+only/.test(codigo)) problemas.push("faltando SET TRANSACTION READ ONLY");
    if (!/\brollback\b/.test(codigo)) problemas.push("faltando ROLLBACK");
  }
  return { ok: problemas.length === 0, problemas };
}

// --- CLI ---------------------------------------------------------------
function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
}

if (isMain()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const sqlPath = process.argv[2] || join(here, "preflight-orcamentos-duplicidades.sql");
  const raw = readFileSync(sqlPath, "utf8");
  const { ok, problemas } = assertReadOnly(raw, { requireTxnGuards: true });

  if (!ok) {
    console.error(`✗ ${sqlPath} NÃO é seguramente somente-leitura:`);
    for (const p of problemas) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log("✓ Preflight é SOMENTE LEITURA:");
  console.log("  - nenhum verbo de escrita/DDL (insert/update/delete/truncate/drop/alter/create/grant/...)");
  console.log("  - envolto em BEGIN; SET TRANSACTION READ ONLY; ... ROLLBACK;");
  process.exit(0);
}
