import { realpathSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Porta configurável e isolada para não reaproveitar o dev server manual do app.
const PORT = process.env.E2E_PORT ?? "3107";
const BASE_URL = `http://localhost:${PORT}`;
// Uso explícito para validar apenas rotas de leitura no servidor local já ativo.
// O padrão continua isolado, subindo `next start` com o mock E2E na porta 3107.
const REUSE_EXISTING_SERVER = process.env.E2E_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "output/playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  outputDir: "output/playwright",
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    cwd: realpathSync(process.cwd()),
    url: BASE_URL,
    reuseExistingServer: REUSE_EXISTING_SERVER,
    timeout: 120_000,
    env: {
      PLAYWRIGHT_MOCK_SUPABASE: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "playwright-anon-key",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
