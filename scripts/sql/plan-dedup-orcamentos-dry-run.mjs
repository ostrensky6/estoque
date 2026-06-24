#!/usr/bin/env node
// Planejador de deduplicação em modo DRY-RUN. NÃO toca no banco, NÃO executa SQL,
// NÃO altera dados. Apenas lê o JSON de resultados do preflight e gera um PLANO em
// Markdown: candidatos a canônico, duplicados prováveis, decisões manuais,
// constraints futuras, ordem segura de correção e riscos.
//
// Uso:
//   node scripts/sql/plan-dedup-orcamentos-dry-run.mjs [caminho/para/preflight-resultados.json]
// Sem argumento: usa o artifact mais recente em artifacts/orcamento-preflight/.
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CHECKS } from "./preflight-checks.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const META = new Map(CHECKS.map((c) => [c.id, c]));

function fail(msg, code = 1) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(code);
}

function acharJsonMaisRecente() {
  const base = join(repoRoot, "artifacts", "orcamento-preflight");
  if (!existsSync(base)) return null;
  const dirs = readdirSync(base)
    .map((d) => join(base, d))
    .filter((p) => statSync(p).isDirectory())
    .sort();
  for (const d of dirs.reverse()) {
    const j = join(d, "preflight-resultados.json");
    if (existsSync(j)) return j;
  }
  return null;
}

function main() {
  const arg = process.argv[2];
  const jsonPath = arg || acharJsonMaisRecente();
  if (!jsonPath || !existsSync(jsonPath)) {
    fail(
      "Nenhum preflight-resultados.json encontrado.\n" +
        "Rode antes o runner (node scripts/sql/run-preflight-orcamentos.mjs) ou\n" +
        "passe o caminho do JSON: node scripts/sql/plan-dedup-orcamentos-dry-run.mjs <arquivo.json>",
      2,
    );
  }

  let data;
  try {
    data = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (e) {
    fail(`JSON inválido (${jsonPath}): ${e.message}`);
  }

  const resultados = data.resultados || [];
  const comOcc = resultados
    .filter((r) => typeof r.ocorrencias === "number" && r.ocorrencias > 0)
    .map((r) => ({ ...r, meta: META.get(r.id) }))
    .sort((a, b) => (a.meta?.ordem ?? 99) - (b.meta?.ordem ?? 99));

  const md = gerarPlano(data, comOcc);
  const outPath = join(dirname(jsonPath), "plan-dedup-dry-run.md");
  writeFileSync(outPath, md);

  console.log("✓ Plano DRY-RUN gerado (nenhum dado tocado):");
  console.log(`  entrada: ${jsonPath}`);
  console.log(`  saída:   ${outPath}`);
  console.log(`  checks com ocorrência: ${comOcc.length}`);
  if (comOcc.length === 0) {
    console.log("  → Nenhuma duplicidade detectada; nada a deduplicar.");
  }
}

function gerarPlano(data, comOcc) {
  const meta = data.meta || {};
  const automatizaveis = comOcc.filter((r) => r.meta?.decisao === "automatizavel");
  const parciais = comOcc.filter((r) => r.meta?.decisao === "parcial");
  const manuais = comOcc.filter((r) => r.meta?.decisao === "manual");

  const bloco = (r) => {
    const m = r.meta || {};
    const amostra = (r.amostra && r.amostra.length)
      ? "```json\n" + JSON.stringify(r.amostra.slice(0, 10), null, 2) + "\n```"
      : "_(sem amostra)_";
    return `### ${r.id} — ${r.descricao}
- **Severidade:** ${r.severidade} · **Decisão:** ${r.meta?.decisao ?? "?"} · **Ocorrências:** ${r.ocorrencias}
- **Risco:** ${riscoDe(r.id)}
- **Como escolher o canônico:** ${m.canonicoRegra ?? "—"}
- **Duplicados prováveis (amostra do preflight):**
${amostra}
- **Precisa de decisão manual?** ${r.meta?.decisao === "manual" ? "**SIM**" : r.meta?.decisao === "parcial" ? "parcial (confirmar casos)" : "não (regra determinística)"}
- **Constraint futura sugerida (aplicar SÓ depois de zerar):** \`${m.constraintSugerida ?? "—"}\`
- **Ação:** ${m.acao ?? "—"}
`;
  };

  return `# Plano de deduplicação — DRY-RUN (NÃO EXECUTADO)

> Gerado a partir de \`${"preflight-resultados.json"}\` (ambiente: **${meta.environment ?? "?"}**,
> gerado em ${meta.geradoEm ?? "?"}). **Este é apenas um plano.** Nenhuma limpeza
> foi executada, nenhum SQL de escrita rodou, nenhum dado foi alterado.

## Panorama
- Checks com ocorrência > 0: **${comOcc.length}**
- Automatizáveis: **${automatizaveis.length}** · Parciais: **${parciais.length}** · Manuais: **${manuais.length}**

## Ordem segura de correção (proposta)
1. **Backup lógico + export + contagem** (abortar se o backup falhar).
2. Resolver na ordem de menor risco → maior dependência:
${comOcc.length === 0 ? "   _(nada a fazer)_" : comOcc.map((r, i) => `   ${i + 1}. ${r.id} (${r.meta?.decisao}) — ${r.descricao}`).join("\n")}
3. Aplicar **constraints** de proteção (somente após zerar as duplicidades).
4. **Reexecutar o preflight** e comprovar ocorrências = 0.

## Separação automatizável × manual
- **Automatizável (regra determinística):** ${automatizaveis.map((r) => r.id).join(", ") || "—"}
- **Parcial (script + confirmação):** ${parciais.map((r) => r.id).join(", ") || "—"}
- **Manual (decisão humana):** ${manuais.map((r) => r.id).join(", ") || "—"}

## Detalhe por problema
${comOcc.length === 0 ? "_Nenhuma duplicidade detectada._" : comOcc.map(bloco).join("\n")}

## Riscos gerais
- Eleger canônico errado → perda de referência comercial. Mitigar com a ordem de
  desempate e revisão humana nos casos manuais/parciais.
- Remapear referências DEPOIS de cancelar → quebra de vínculo. Sempre remapear ANTES.
- Aplicar constraint antes de zerar → migration falha. Constraints só no fim.
- Recalcular versões finais históricas → quebra de histórico. **Proibido.**

## Próximo passo (requer aprovação explícita)
Converter este plano em migrations aditivas (log + constraints) e rotinas de
remapeamento idempotentes, **cada uma com rollback**, para revisão — **antes** de
qualquer execução. Nada será executado sem o seu "ok".
`;
}

function riscoDe(id) {
  const r = {
    A1: "dupla contagem de análises; ambiguidade de módulo canônico",
    A2: "dupla contagem; ambiguidade de módulo de projeto",
    A3: "soma inflada (mesma análise contada N vezes)",
    A4: "dupla contagem entre laboratório e análises-de-projeto",
    A5: "duplicidade de rubrica (pode ser legítima)",
    A6: "total final inclui módulo cancelado depois",
    A7: "numeração comercial ambígua",
    A8: "duas propostas 'válidas' simultâneas",
    A9: "snapshot econômico ambíguo da mesma versão",
    A10: "dados fora do fluxo; ruído em relatórios",
    A11: "inconsistência de modalidade entre linhas",
    A12: "funil não reflete a realidade",
    A13: "emissão com custo/preço zerado sem aprovação",
    A14: "página/PDF/banco divergem do snapshot",
    A15: "migrations com mesmo prefixo colidem na aplicação",
  };
  return r[id] || "—";
}

main();
