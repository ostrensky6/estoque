import { expect, test } from "@playwright/test";

test("emissão configurada salva proposta final no histórico", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/orcamento/demandas/1?etapa=final");

  const propostaFinal = page.locator("#final");
  await expect(propostaFinal.getByText("Proposta final · Nº 1")).toBeVisible();
  await expect(propostaFinal.getByText("Total final").first()).toBeVisible();

  const emitir = page.getByRole("button", { name: "Emitir versão final" });
  await expect(emitir).toBeEnabled();
  await emitir.click();

  await expect(page).toHaveURL(/\/orcamento\/demandas\/1\?etapa=final/);
  await expect(page.getByRole("link", { name: /Abrir versão emitida \(OF-2026-0001-v1\)/ })).toBeVisible();
  await expect(propostaFinal.getByText("1 versão(ões)")).toBeVisible();
});
