import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes são rápidos isolados (<0,2s cada), mas o transform on-the-fly de
    // TS para a suíte inteira satura o event loop e faz o wall-clock de testes
    // async (actions + mock-supabase) ultrapassar o default de 5s, gerando
    // timeouts intermitentes e poluição de mocks por async resolvido tarde.
    // Headroom generoso remove a flakiness sem mascarar hang real.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      // `server-only` lança fora de um Server Component; nos testes vira no-op.
      "server-only": fileURLToPath(
        new URL("./src/lib/testing/server-only-stub.ts", import.meta.url),
      ),
      // alias de path do projeto (tsconfig "@/*" -> "src/*")
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
