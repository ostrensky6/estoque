import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrudShell.tsx", import.meta.url), "utf8");

type State = { ok: boolean; createdId?: number };

function podeOferecerEntrada(slug: string, registro: unknown, state: State) {
  return slug === "insumos"
    && !registro
    && state.ok
    && Number.isSafeInteger(state.createdId)
    && Number(state.createdId) > 0;
}

describe("CrudShell: handoff para estoque inicial", () => {
  it("explica os totais calculados somente no cadastro de insumos", () => {
    expect(source).toContain('slug === "insumos"');
    expect(source).toContain("Unidades fechadas e abertas são calculadas automaticamente pelos lotes");
    expect(source).toMatch(/fechada = sem data\s+de abertura; aberta = com data de abertura/);
    expect(source).toMatch(/não são\s+editáveis neste cadastro/);
  });

  it("restringe a oferta a uma criacao confirmada de insumo", () => {
    expect(podeOferecerEntrada("insumos", null, { ok: true, createdId: 321 })).toBe(true);
    expect(podeOferecerEntrada("insumos", { id: 321 }, { ok: true, createdId: 321 })).toBe(false);
    expect(podeOferecerEntrada("clientes", null, { ok: true, createdId: 321 })).toBe(false);
    expect(podeOferecerEntrada("insumos", null, { ok: false, createdId: 321 })).toBe(false);
    expect(podeOferecerEntrada("insumos", null, { ok: true })).toBe(false);
    expect(podeOferecerEntrada("insumos", null, { ok: true, createdId: 1.5 })).toBe(false);
  });

  it("deriva a oferta somente do retorno gateado e nao navega automaticamente", () => {
    expect(source).toContain('slug === "insumos"');
    expect(source).toContain("!registro");
    expect(source).toContain("state.ok");
    expect(source).toContain("Number.isSafeInteger(state.createdId)");
    expect(source).toContain("state.createdId > 0");
    expect(source).not.toMatch(/router\.(?:push|replace)\([^)]*estoque/);
  });

  it("oferece a entrada canonica na criacao e na edicao sem novo submit de cadastro", () => {
    expect(source).toContain('import { AjusteInventarioButton } from "@/components/estoque/ReceberLote";');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain("Lançar quantidade");
    expect(source).toContain("insumoExistenteId");
    expect(source.match(/<AjusteInventarioButton/g)).toHaveLength(2);
    expect(source).not.toContain('href={`/estoque?entrada=${ofertaEntradaId}`}');

    const oferta = source.indexOf("if (ofertaEntradaId)");
    const acoes = [...source.matchAll(/<AjusteInventarioButton/g)].map((match) => match.index);
    const formulario = source.indexOf("<form action={action}", acoes[1]);
    expect(oferta).toBeGreaterThan(-1);
    expect(acoes).toHaveLength(2);
    expect(formulario).toBeGreaterThan(acoes[1]);
  });

  it("permite fechar a oferta e mantem o fechamento atual nos demais sucessos", () => {
    expect(source).toMatch(/if \(!state\.ok\) return;[\s\S]*router\.refresh\(\);[\s\S]*if \(!ofertaEntradaId\) onClose\(\);/);
    expect(source).toMatch(/<Button[\s\S]*type="button"[\s\S]*onClick=\{onClose\}[\s\S]*>\s*Fechar\s*<\/Button>/);
  });
});
