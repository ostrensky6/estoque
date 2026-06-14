import { expect, test } from "@playwright/test";

test("fluxo orcamento -> documento imprimivel/PDF", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__printCalled", { value: false, writable: true });
    window.print = () => {
      (window as typeof window & { __printCalled: boolean }).__printCalled = true;
    };
  });

  await page.goto("/orcamento");
  await page.locator('select[name="tipo"]').selectOption("analises");
  await page.locator('input[name="cliente_nome"]').fill("Cliente Playwright");
  await expect(page.getByRole("button", { name: "Novo orçamento" })).toBeEnabled();
  await page.getByRole("button", { name: "Novo orçamento" }).click();

  await expect(page).toHaveURL(/\/orcamento\/\d+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Orçamento de análises" })).toBeVisible();
  await expect(page.getByText("Cliente Playwright")).toBeVisible();

  await page.getByRole("button", { name: "Imprimir / PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalled: boolean }).__printCalled)).toBe(true);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Custo/amostra")).toBeHidden();
  await expect(page.getByText("Preço/amostra")).toBeVisible();
});
