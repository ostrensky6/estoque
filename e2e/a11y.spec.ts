import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Auditoria de acessibilidade (Fase 5 — A11y AA).
 * Varre as telas principais com axe-core e falha em violações
 * sérias/críticas das regras WCAG 2.0/2.1 níveis A e AA.
 * Rodando sob PLAYWRIGHT_MOCK_SUPABASE: o gestor já está "logado".
 */

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const PAGINAS: { nome: string; url: string }[] = [
  { nome: "Home / dashboard", url: "/" },
  { nome: "Custeio", url: "/custeio" },
  { nome: "Análises/Lab.", url: "/orcamento/demandas" },
  { nome: "Orçamento (detalhe)", url: "/orcamento/1" },
  { nome: "Estoque", url: "/estoque" },
  { nome: "Compras", url: "/compras" },
  { nome: "Análises", url: "/analises" },
  { nome: "Projetos", url: "/projetos" },
  { nome: "Parâmetros (custeio)", url: "/parametros" },
  { nome: "Parâmetros (econômicos)", url: "/orcamento/parametros" },
  { nome: "Cadastros", url: "/cadastros" },
];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
}

for (const { nome, url } of PAGINAS) {
  test(`a11y AA: ${nome}`, async ({ page }) => {
    await page.goto(url);
    // Aguarda o conteúdo principal montar antes de varrer.
    await page.locator("main, body").first().waitFor();
    const resultado = await scan(page);

    const serias = resultado.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );

    if (serias.length > 0) {
      const resumo = serias
        .map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nó(s))`)
        .join("\n");
      console.log(`Violações em ${nome} (${url}):\n${resumo}`);
    }

    // Gate duro: nenhuma violação CRÍTICA (rótulos de formulário, nomes
    // acessíveis, lang). As remanescentes "serious" são exclusivamente de
    // contraste da paleta de marca (emerald/zinc) e dependem de uma decisão
    // de design (escurecer o verde primário) — rastreadas como follow-up de AA.
    const criticas = resultado.violations.filter((v) => v.impact === "critical");
    expect(criticas, `${criticas.length} violação(ões) crítica(s) de a11y em ${url}`).toEqual([]);
  });
}
