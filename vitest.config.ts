import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
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
