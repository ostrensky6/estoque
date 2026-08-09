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

  it("mantém uma identidade por instância no Client Component e a envia na emissão", () => {
    const fonte = readFileSync(resolve(process.cwd(), "src/components/orcamento/EmissaoFinalForm.tsx"), "utf8");
    const formulario = fonte.match(/<form onSubmit=\{handleSalvarEmissao\}[\s\S]*?<\/form>/)?.[0] ?? "";
    const campo = formulario.match(
      /<input(?=[^>]*\btype="hidden")(?=[^>]*\bname="operacao_id")(?=[^>]*\bvalue=\{([A-Za-z_$][\w$]*)\})[^>]*\/>/,
    );
    const estadoDaIdentidade = fonte.match(
      /const\s+\[\s*([A-Za-z_$][\w$]*)\s*,\s*([A-Za-z_$][\w$]*)\s*\]\s*=\s*useState\(""\);/,
    );
    const inicializacaoUnica = fonte.match(
      /useEffect\(\(\)\s*=>\s*\{\s*([A-Za-z_$][\w$]*)\(\(([A-Za-z_$][\w$]*)\)\s*=>\s*\2\s*\|\|\s*crypto\.randomUUID\(\)\);\s*\},\s*\[\]\);/,
    );

    expect(campo, "o form de emissão deve enviar operacao_id oculto").not.toBeNull();
    expect(estadoDaIdentidade, "o UUID deve ter estado estável por instância").not.toBeNull();
    expect(inicializacaoUnica, "o UUID deve ser criado só quando a instância ainda não tem identidade").not.toBeNull();
    expect(campo?.[1]).toBe(estadoDaIdentidade?.[1]);
    expect(inicializacaoUnica?.[1]).toBe(estadoDaIdentidade?.[2]);
    expect(fonte.match(/crypto\.randomUUID\(\)/g)).toHaveLength(1);
    expect(fonte.indexOf("crypto.randomUUID()")).toBeLessThan(fonte.indexOf("const handleSalvarEmissao"));
    expect(fonte).toMatch(new RegExp(`if \\(\\s*!${campo?.[1]}\\s*\\) return;`));
  });
});
