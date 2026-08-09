import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const composition = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
  .join("\n");

function functionDefinitions(name: string) {
  const starts = [...composition.matchAll(new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${name}\\s*\\(`,
    "gi",
  ))].map((match) => match.index);

  return starts.map((start) => {
    const end = composition.indexOf("end $$;", start);
    return composition.slice(start, end < 0 ? composition.length : end + "end $$;".length).toLowerCase();
  });
}

function latestFunction(name: string) {
  return functionDefinitions(name).at(-1) ?? "";
}

function latestView(name: string) {
  const starts = [...composition.matchAll(new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?view\\s+(?:public\\.)?${name}\\s+as`,
    "gi",
  ))].map((match) => match.index);
  const start = starts.at(-1);
  if (start === undefined) return "";

  const end = composition.indexOf(";", start);
  return composition.slice(start, end < 0 ? composition.length : end).toLowerCase();
}

function hasStatement(...tokens: string[]) {
  return composition
    .toLowerCase()
    .split(";")
    .some((statement) => tokens.every((token) => statement.includes(token)));
}

describe("contrato transacional de recebimento", () => {
  it("exige chave UUID e indice unico nos dois livros de recebimento", () => {
    for (const table of [
      "pedidos_compra_item_recebimentos",
      "pedidos_internos_item_recebimentos",
    ]) {
      expect.soft(hasStatement(table, "operacao_id uuid")).toBe(true);
      expect.soft(hasStatement("unique", table, "operacao_id")).toBe(true);
    }
  });

  it("reutiliza o recebimento antes de criar outro lote para a mesma operacao", () => {
    for (const [rpc, table] of [
      ["receber_item_pedido_compra", "pedidos_compra_item_recebimentos"],
      ["receber_item_pedido_interno", "pedidos_internos_item_recebimentos"],
    ] as const) {
      const definition = latestFunction(rpc);
      const reuse = definition.search(/operacao_id\s*=\s*p_operacao_id/i);
      const newLot = definition.indexOf("insert into lotes_estoque");
      const idempotent = definition.includes("p_operacao_id")
        && definition.includes(table)
        && reuse >= 0
        && newLot >= 0
        && reuse < newLot;
      expect.soft(idempotent).toBe(true);
    }
  });

  it("audita o primeiro recebimento interno depois do retorno antecipado do retry", () => {
    const definition = latestFunction("receber_item_pedido_interno");
    const retryReturn = definition.indexOf("return v_existente.lote_id");
    const firstReceipt = definition.indexOf("v_lote_id := public.receber_item_pedido_interno");
    const audit = definition.indexOf("insert into public.eventos_status");

    expect.soft(retryReturn).toBeGreaterThan(-1);
    expect.soft(firstReceipt).toBeGreaterThan(retryReturn);
    expect.soft(audit).toBeGreaterThan(firstReceipt);
  });

  it("mantem o lote em quarentena fora do disponivel ate um unico aceite", () => {
    for (const rpc of ["receber_item_pedido_compra", "receber_item_pedido_interno"]) {
      expect.soft(functionDefinitions(rpc).some((definition) => (
        definition.includes("insert into lotes_estoque")
        && definition.includes("'quarentena'")
      ))).toBe(true);
    }

    const saldo = latestView("v_estoque_saldo");
    expect.soft(saldo).toMatch(
      /sum\s*\(\s*l\.quantidade_atual\s*\)[\s\S]*?where\s+l\.status\s+in\s*\(\s*'aceito'\s*,\s*'em_uso'\s*\)\s+and\s+\(\s*(?:public\.)?menor_validade\(\s*l\.validade\s*,\s*l\.validade_apos_abertura\s*\)\s+is\s+null\s+or\s+(?:public\.)?menor_validade\(\s*l\.validade\s*,\s*l\.validade_apos_abertura\s*\)\s*>=\s*current_date\s*\)[\s\S]*?as\s+disponivel_bruto/,
    );
    expect.soft(saldo).toContain("status = 'quarentena'");
    expect.soft(latestFunction("reservar_plano")).toMatch(
      /order\s+by\s+(?:public\.)?menor_validade\(\s*le\.validade\s*,\s*le\.validade_apos_abertura\s*\)\s+nulls\s+last\s*,\s*le\.id/,
    );

    const aceite = latestFunction("aceitar_lote");
    expect.soft(aceite).toContain("for update of l");
    expect.soft(aceite).toContain("if v_lote.status <> 'quarentena'");
    expect.soft(aceite).toContain("set status = 'aceito'");
  });

  it("bloqueia cancelamento quando os livros registram recebimento", () => {
    expect.soft(latestFunction("transicionar_pedido_compra"))
      .toContain("pedidos_compra_item_recebimentos");

    const cancelarInterno = latestFunction("cancelar_pedido_interno_operacional");
    expect.soft(cancelarInterno).toContain("pedidos_internos_item_recebimentos");
    expect.soft(cancelarInterno).toContain("pedidos_compra_item_recebimentos");
  });

  it("reconcilia bilateralmente o estorno de recebimento vinculado", () => {
    const estorno = latestFunction("estornar_recebimento_item_pedido_interno");

    expect.soft(estorno).toContain("pedidos_compra_item_recebimentos");
    expect.soft(estorno).toContain("update pedidos_compra_itens");
    expect.soft(estorno).toContain("update pedidos_compra");
  });
});
