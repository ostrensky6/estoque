import { expect, test } from "@playwright/test";

test("fluxo orcamento -> documento imprimivel/PDF", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__printCalled", { value: false, writable: true });
    window.print = () => {
      (window as typeof window & { __printCalled: boolean }).__printCalled = true;
    };
  });

  await page.goto("/orcamento/1");
  await expect(page).toHaveURL(/\/orcamento\/\d+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Análises/Lab." })).toBeVisible();
  await expect(page.getByText("Cliente Demo")).toBeVisible();

  await page.getByRole("button", { name: "Imprimir / PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalled: boolean }).__printCalled)).toBe(true);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Custo/amostra")).toBeHidden();
  await expect(page.getByRole("columnheader", { name: "Custo" })).toBeVisible();
  await expect(page.locator("tfoot").getByRole("cell", { name: /R\$\s*540,00/ })).toBeVisible();
});
