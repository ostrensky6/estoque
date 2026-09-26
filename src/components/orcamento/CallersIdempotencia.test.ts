import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("callers idempotentes da emissão final", () => {
  it("envia uma identidade criada no render do Server Component ao duplicar", () => {
    const fonte = readFileSync(resolve(process.cwd(), "src/app/orcamento/final/[id]/page.tsx"), "utf8");
    const formulario = fonte.match(/<form action=\{duplicarVersaoFinal\}>[\s\S]*?<\/form>/)?.[0] ?? "";
    const campo = formulario.match(
      /<input(?=[^>]*\btype="hidden")(?=[^>]*\bname="operacao_id")(?=[^>]*\bvalue=\{([A-Za-z_$][\w$]*)\})[^>]*\/>/,
    );
    const identidade = fonte.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*randomUUID\(\);/);

    expect(campo, "o form de duplicação deve enviar operacao_id oculto").not.toBeNull();
    expect(identidade, "o Server Component deve criar o UUID antes de renderizar o form").not.toBeNull();
    expect(campo?.[1]).toBe(identidade?.[1]);
    expect(fonte.indexOf("randomUUID()")).toBeLessThan(fonte.indexOf("<form action={duplicarVersaoFinal}>"));
  });
});
