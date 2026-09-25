import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  APP_MODULES,
  getCommandGroups,
  getModulesForProfile,
  moduleIsActive,
} from "./modules";

const APP_DIR = path.resolve(__dirname, "../app");

function paginaExiste(href: string) {
  const segmentos = href.split("/").filter(Boolean);
  return existsSync(path.join(APP_DIR, ...segmentos, "page.tsx"));
}

function modulo(id: string) {
  const encontrado = APP_MODULES.find((item) => item.id === id);
  if (!encontrado) throw new Error(`módulo ${id} ausente`);
  return encontrado;
}

describe("APP_MODULES", () => {
  it("todo link aponta para uma página existente", () => {
    const hrefs = APP_MODULES.flatMap((item) => item.children.map((child) => child.href));
    const quebrados = hrefs.filter(
      (href) => !href.startsWith("/cadastros/") && !paginaExiste(href),
    );
    expect(quebrados).toEqual([]);
  });

  it("não repete o mesmo link dentro de um módulo", () => {
    for (const item of APP_MODULES) {
      const hrefs = item.children.map((child) => child.href);
      expect(new Set(hrefs).size, item.id).toBe(hrefs.length);
    }
  });

  it("alcança as páginas que antes não tinham entrada na navegação", () => {
    const todos = APP_MODULES.flatMap((item) => item.children.map((child) => child.href));
    expect(todos).toEqual(
      expect.arrayContaining([
        "/projetos",
        "/parametros",
        "/estoque/inventario",
        "/etiquetas",
        "/scanner/triagem",
      ]),
    );
  });

  it("marca o módulo certo como ativo para as novas rotas", () => {
    expect(moduleIsActive(modulo("orcamentos"), "/projetos/7")).toBe(true);
    expect(moduleIsActive(modulo("operacao"), "/parametros")).toBe(true);
    expect(moduleIsActive(modulo("suprimentos"), "/estoque/inventario")).toBe(true);
    expect(moduleIsActive(modulo("suprimentos"), "/etiquetas")).toBe(true);
    expect(moduleIsActive(modulo("suprimentos"), "/scanner/triagem")).toBe(true);
    expect(moduleIsActive(modulo("orcamentos"), "/projetosx")).toBe(false);
  });

  it("parâmetros de custeio só aparecem para gestor ou acima", () => {
    const hrefsTecnico = getCommandGroups({ papel: "tecnico" }).flatMap((g) => g.links.map((l) => l.href));
    const hrefsGestor = getCommandGroups({ papel: "gestor" }).flatMap((g) => g.links.map((l) => l.href));
    expect(hrefsTecnico).not.toContain("/parametros");
    expect(hrefsGestor).toContain("/parametros");
    expect(hrefsTecnico).toEqual(expect.arrayContaining(["/estoque/inventario", "/projetos"]));
  });

  it("governança continua restrita a gestor ou acima", () => {
    expect(getModulesForProfile({ papel: "tecnico" }).map((m) => m.id)).not.toContain("governanca");
    expect(getModulesForProfile({ papel: "gestor" }).map((m) => m.id)).toContain("governanca");
  });
});
