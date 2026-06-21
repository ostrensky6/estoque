import { test, expect } from "@playwright/test";

/**
 * Verificação visual/funcional da etapa de Parâmetros Econômicos no fluxo
 * (plano §6.5/§8.1/§8.2). Roda contra o dev server em modo mock
 * (PLAYWRIGHT_MOCK_SUPABASE=1), que serve uma demanda MISTA (laboratório +
 * projeto) em /orcamento/demandas/1.
 */
test("etapa de parâmetros econômicos renderiza densa no fluxo da demanda", async ({ page }) => {
  await page.goto("/orcamento/demandas/1");

  const secao = page.locator("#parametros");
  await expect(secao).toBeVisible();

  // Três blocos densos (§8.1): base de custos -> parâmetros aplicados -> resultado.
  await expect(secao.getByText("Base de cálculo")).toBeVisible();
  await expect(secao.getByText(/Parâmetros aplicados/)).toBeVisible();
  await expect(secao.getByText("Resultado final")).toBeVisible();
  await expect(secao.getByText("Subtotal de custos")).toBeVisible();
  // "Total final" aparece no painel e na tabela de memória; basta existir no painel.
  await expect(secao.getByText("Total final").first()).toBeVisible();

  // Parâmetros de projeto aplicados (gross-up) aparecem com percentuais.
  await expect(secao.getByText("Lucro").first()).toBeVisible();

  await secao.scrollIntoViewIfNeeded();
  await secao.screenshot({ path: "output/parametros-economicos.png" });
});
