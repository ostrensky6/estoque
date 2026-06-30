import { expect, test } from "@playwright/test";

test("fluxo orcamento -> documento imprimivel/PDF", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__printCalled", { value: false, writable: true });
    window.print = () => {
      (window as typeof window & { __printCalled: boolean }).__printCalled = true;
    };
  });

  // Navigate directly to the seeded mock budget ID 2
  await page.goto("/orcamento/2");
  await expect(page.getByRole("heading", { name: "Análises/Lab." })).toBeVisible();
  await expect(page.getByText("Cliente Demo")).toBeVisible();

  await page.getByRole("button", { name: "Imprimir / PDF" }).click();
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __printCalled: boolean }).__printCalled)).toBe(true);

  await page.emulateMedia({ media: "print" });
  await expect(page.getByText("Preenchimento interno")).toBeHidden();
  await expect(page.getByText("Custo").first()).toBeVisible();
});
