import { expect, test } from "@playwright/test";

test("fluxo orcamento -> documento imprimivel/PDF", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__printCalled", { value: false, writable: true });
    window.print = () => {
      (window as typeof window & { __printCalled: boolean }).__printCalled = true;
    };
  });

  await page.goto("/orcamento/1");
  await expect(page.getByRole("heading", { name: "Custos laboratoriais" })).toBeVisible();
  await expect(page.getByText("Cliente Demo")).toBeVisible();

  await page.getByRole("button", { name: "Imprimir / PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalled: boolean }).__printCalled)).toBe(true);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Imprimir / PDF" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "Custos laboratoriais" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dados do cliente e do orçamento" })).toBeHidden();
});
