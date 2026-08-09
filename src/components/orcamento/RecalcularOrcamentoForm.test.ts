import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../../app/orcamento/[id]/page.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../../lib/actions/orcamentos.ts", import.meta.url), "utf8");
const componentUrl = new URL("./RecalcularOrcamentoForm.tsx", import.meta.url);
const component = existsSync(componentUrl) ? readFileSync(componentUrl, "utf8") : "";
const chamada = /(?:const|let)\s+(\w+)\s*=\s*await\s+[\w.]+\(\s*(\w+)\s*\)\s*;/.exec(component);
const nomeResultado = chamada?.[1] ?? "";
const nomeFormData = chamada?.[2] ?? "";
const antesDaAcao = chamada ? component.slice(0, chamada.index) : "";
const depoisDaAcao = chamada ? component.slice(chamada.index + chamada[0].length) : "";
const guardaMotivo = /if\s*\(([^;\r\n]*\.trim\(\)[^;\r\n]*)\)\s*(\{[^{}]*\breturn\b[^{}]*\}|return\s*;)/.exec(antesDaAcao);
const guardasSimples = [...antesDaAcao.matchAll(/if\s*\(([^()\r\n]+)\)\s*(\{[^{}]*\breturn\b[^{}]*\}|return\s*;)/g)];
const guardaReenvio = guardasSimples.find((item) => {
  const condicao = item[1].trim();
  return new RegExp(`${condicao.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*true`).test(antesDaAcao.slice((item.index ?? 0) + item[0].length));
});
const expressaoTrava = guardaReenvio?.[1].trim() ?? "";
const ramoFalha = nomeResultado
  ? new RegExp(`if\\s*\\(\\s*!\\s*${nomeResultado}\\.ok\\s*\\)\\s*\\{([^{}]*)\\}`).exec(depoisDaAcao)
  : null;
const textoFalha = ramoFalha?.[1] ?? "";
const textoSucesso = ramoFalha ? depoisDaAcao.slice((ramoFalha.index ?? 0) + ramoFalha[0].length) : "";
const travaEscapada = expressaoTrava.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const liberaNaFalha = travaEscapada ? new RegExp(`${travaEscapada}\\s*=\\s*false`).test(textoFalha) : false;
const liberaNoSucesso = travaEscapada ? new RegExp(`${travaEscapada}\\s*=\\s*false`).test(textoSucesso) : false;
const liberaSempre = travaEscapada
  ? new RegExp(`finally\\s*\\{[^{}]*${travaEscapada}\\s*=\\s*false[^{}]*\\}`).test(depoisDaAcao)
  : false;

describe("RecalcularOrcamentoForm", () => {
  it("consome o retorno explicito e nunca normaliza undefined como sucesso", async () => {
    expect(action).toContain("Promise<ResultadoRecalculoOrcamento>");
    expect(component).toContain("const resultado = await recalcularOrcamento(formData);");
    expect(component).not.toContain("executarRecalculo");
    expect(component).not.toMatch(/\?\?\s*\{[\s\S]*?ok:\s*true/);

    const consumirRetornoIncompativel = async (
      executar: () => Promise<{ ok: boolean; message: string } | undefined>,
    ) => {
      try {
        const resultado = (await executar()) as { ok: boolean; message: string };
        return resultado.ok ? "sucesso" : "erro-esperado";
      } catch {
        return "erro-tecnico";
      }
    };

    expect(await consumirRetornoIncompativel(async () => undefined)).toBe("erro-tecnico");
  });

  it("parte do contrato backend ja existente e preserva a fonte de custo", () => {
    expect(action).toContain('["enviado", "aprovado", "cancelado"]');
    expect(action).toMatch(/formData\.get\("motivo"\)[\s\S]*\.trim\(\)/);
    expect(action).toContain("exige motivo");
    expect(`${page}\n${component}`).toContain('name="fonte_custo_insumos"');
  });

  it("separa motivo vazio da trava e envia motivo valido com a fonte", () => {
    expect(component, "o componente cliente ainda nao existe").toContain('name="motivo"');
    expect(`${page}\n${component}`).toContain('name="fonte_custo_insumos"');
    expect(guardaMotivo, "motivo vazio deve retornar antes da action").not.toBeNull();
    expect(guardaReenvio, "reenvio pendente exige outra guarda").toBeDefined();
    expect(guardaReenvio?.index).not.toBe(guardaMotivo?.index);
    expect(nomeFormData).not.toBe("");
    expect(component).toMatch(new RegExp(`new FormData\\([^;]+\\)|\\b${nomeFormData}\\s*:\\s*FormData`));
  });

  it("preserva contexto e apresenta message quando o resultado e ok:false", () => {
    expect(nomeResultado, "a action deve devolver resultado observavel").not.toBe("");
    expect(ramoFalha, "ok:false deve possuir ramo proprio").not.toBeNull();
    expect(textoFalha).toContain(`${nomeResultado}.message`);
    expect(textoFalha).toMatch(/\breturn\b/);
    expect(textoFalha).not.toMatch(/\w+\(\s*(?:null|"")\s*\)|\.refresh\(\)|\bthrow\b/);
    expect(component).toMatch(/role=["']alert["']/);
    expect(liberaNaFalha || liberaSempre, "falha deve liberar retry").toBe(true);
  });

  it("bloqueia segunda action pendente e so ok:true limpa, fecha e atualiza", () => {
    expect(expressaoTrava).not.toBe("");
    expect(antesDaAcao).toMatch(new RegExp(`${travaEscapada}\\s*=\\s*true`));
    expect(textoSucesso).toMatch(/\w+\(\s*(?:null|false)\s*\)/);
    expect(textoSucesso).toMatch(/\w+\(\s*""\s*\)/);
    expect(textoSucesso).toMatch(/\.refresh\(\)/);
    expect(liberaNoSucesso || liberaSempre, "sucesso deve liberar nova submissao").toBe(true);
    expect(component).toMatch(/<button[\s\S]{0,500}disabled=\{[^}]+\}[\s\S]{0,500}(?:Aplicar|Recalcular)/i);
  });
});
