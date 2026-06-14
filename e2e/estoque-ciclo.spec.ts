import { expect, test } from "@playwright/test";

test("ciclo de estoque: receber lote, aceitar e bloquear", async ({ page }) => {
  await page.goto("/estoque");

  await page.getByRole("button", { name: "+ Lote" }).first().click();
  await expect(page.getByRole("heading", { name: "Receber lote" })).toBeVisible();
  await page.locator('input[name="quantidade"]').fill("25");
  await page.locator('input[name="validade"]').fill("2026-12-31");
  await page.locator('input[name="codigo"]').fill("LOTE-E2E");
  await page.locator('input[name="fornecedor"]').fill("Fornecedor E2E");
  await page.getByRole("button", { name: "Receber" }).click();

  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "LOTE-E2E" }) });
  await expect(row).toBeVisible();
  await expect(row.getByText("Quarentena")).toBeVisible();

  await row.getByRole("button", { name: "Aceitar" }).click();
  await expect(row.getByText("Aceito")).toBeVisible();

  await row.getByRole("button", { name: "Bloquear" }).click();
  await page.locator("textarea").fill("Nao conformidade E2E");
  await page.getByRole("button", { name: "Bloquear" }).last().click();
  await expect(row.getByText("Bloqueado")).toBeVisible();
});
