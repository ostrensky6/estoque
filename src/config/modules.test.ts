import { describe, expect, it } from "vitest";

import { APP_MODULES, hrefAtivoNaBarra } from "./modules";

const itens = [{ href: "/estoque" }, { href: "/estoque/controle" }, { href: "/pedido" }];

describe("hrefAtivoNaBarra", () => {
  it("escolhe o prefixo mais longo, deixando uma única aba ativa", () => {
    expect(hrefAtivoNaBarra(itens, "/estoque/controle")).toBe("/estoque/controle");
    expect(hrefAtivoNaBarra(itens, "/estoque/controle/123")).toBe("/estoque/controle");
    expect(hrefAtivoNaBarra(itens, "/estoque/lotes/9")).toBe("/estoque");
  });

  it("não confunde rotas com o mesmo início de nome", () => {
    expect(hrefAtivoNaBarra([{ href: "/pedido" }], "/pedidos")).toBeNull();
  });

  it("retorna null fora das abas do módulo", () => {
    expect(hrefAtivoNaBarra(itens, "/compras")).toBeNull();
  });

  it("Orçamentos: a demanda ativa só 'Orçamentos não finalizados'", () => {
    const orcamentos = APP_MODULES.find((m) => m.id === "orcamentos")!;
    expect(hrefAtivoNaBarra(orcamentos.children, "/orcamento/demandas/1")).toBe("/orcamento/demandas");
    expect(hrefAtivoNaBarra(orcamentos.children, "/orcamento/demandas/nova")).toBe("/orcamento/demandas/nova");
    expect(orcamentos.children.some((c) => c.href === "/orcamento")).toBe(false);
  });

  it("Operação mostra Análises, Insumos por análise e Custeio na barra", () => {
    const operacao = APP_MODULES.find((m) => m.id === "operacao")!;
    const visiveis = operacao.children.filter((c) => c.showInTopNav !== false).map((c) => c.href);
    expect(visiveis).toEqual(["/analises", "/insumos", "/custeio"]);
  });
});
