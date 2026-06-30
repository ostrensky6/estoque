import { expect, test } from "@playwright/test";

test("emissão configurada salva proposta final no histórico", async ({ page }) => {
  await page.goto("/orcamento/demandas/1?etapa=emissao");

  await expect(page.getByRole("heading", { name: "Proposta para o cliente" })).toBeVisible();
  await expect(page.getByText("Valor Total da Proposta")).toBeVisible();

  await page.locator('input[name="dados_codigo"]').fill("OF-E2E-2026-0001");
  await page.locator('input[name="dados_data_emissao"]').fill("2026-06-27");
  await page.locator('input[name="dados_validade"]').fill("2026-07-27");
  await page.locator('textarea[name="dados_objeto"]').fill("Proposta E2E com emissão configurada.");

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Deseja salvar e emitir");
    await dialog.accept();
  });
  await page.getByRole("button", { name: /Emitir e salvar versão final no histórico/ }).click();

  await expect(page).toHaveURL(/\/orcamento\/demandas\/1\?etapa=historico/);
  await expect(page.getByText("OF-E2E-2026-0001")).toBeVisible();
});
