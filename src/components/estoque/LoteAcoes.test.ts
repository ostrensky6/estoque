import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./LoteAcoes.tsx", import.meta.url), "utf8");
const tables = readFileSync(new URL("./EstoqueTables.tsx", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/estoque/page.tsx", import.meta.url), "utf8");
const resultadoDaAcao =
  /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]+\(\s*(?!\{)[^,\r\n]+\)\s*;/.exec(source);
const nomeResultado = resultadoDaAcao?.[1] ?? "";
const inicioFluxo = resultadoDaAcao ? source.lastIndexOf("function ", resultadoDaAcao.index) : -1;
const fimFluxo = resultadoDaAcao ? source.indexOf("\n  function ", resultadoDaAcao.index + 1) : -1;
const fluxo = inicioFluxo >= 0 ? source.slice(inicioFluxo, fimFluxo >= 0 ? fimFluxo : undefined) : "";

describe("LoteAcoes", () => {
  it("mantem contexto e mensagem quando a action retorna ok:false", () => {
    expect(nomeResultado, "o resultado da action precisa ser observado").not.toBe("");
    expect(fluxo).toMatch(new RegExp(`\\w+\\(\\s*${nomeResultado}\\s*\\)`));
    expect(source).toMatch(/\.message\b/);
  });

  it("fecha, limpa e atualiza somente dentro do ramo ok:true", () => {
    const inicioSucesso = fluxo.search(new RegExp(`if\\s*\\(\\s*${nomeResultado}\\.ok\\s*\\)`));
    const ramoSucesso = inicioSucesso >= 0 ? fluxo.slice(inicioSucesso) : "";

    expect(inicioSucesso).toBeGreaterThanOrEqual(0);
    expect(ramoSucesso).toMatch(/\w+\(\s*null\s*\)/);
    expect(ramoSucesso.match(/\w+\(\s*""\s*\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(ramoSucesso).toMatch(/\.refresh\(\)/);
    expect(fluxo.slice(0, inicioSucesso)).not.toMatch(/\w+\(\s*null\s*\)|\.refresh\(\)/);
  });

  it("possui trava sincrona contra reenvio enquanto a action esta pendente", () => {
    const antesDaAcao = resultadoDaAcao ? fluxo.slice(0, fluxo.indexOf(resultadoDaAcao[0])) : "";

    expect(antesDaAcao).toMatch(/if\s*\([^)]*\)\s*(?:\{[\s\S]*?\breturn\b|return\s*;)/);
    expect(source).toMatch(/<button[\s\S]{0,500}disabled=\{[^}]+\}[\s\S]{0,500}onClick=/);
  });

  it("expoe estorno auditavel somente com origem avulsa comprovada", () => {
    expect(source).toContain("estornarRecebimentoLote");
    expect(source).toMatch(/status\s*===\s*"quarentena"\s*&&\s*podeAceitar[\s\S]+estornoDiretoPermitido[\s\S]+Estornar entrada/);
    expect(source).toMatch(/modal\s*===\s*"estornar"[\s\S]+runState\(estornarRecebimentoLote/);
    expect(tables).toContain("estornoDiretoPermitido={row.original.estornoDiretoPermitido}");
    expect(page).toContain('from("pedidos_compra_item_recebimentos")');
    expect(page).toContain('from("pedidos_internos_item_recebimentos")');
    expect(page).toContain("estornoDiretoPermitido:");
  });
});
