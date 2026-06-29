import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  calcularCustoUnitarioMinimo,
  entidadeTipoParaResolucao,
  isTipoResolucaoTriagem,
} from "./triagem-resolucao";

describe("triagem-resolucao", () => {
  it("aceita apenas tipos de resolucao do PR 6", () => {
    expect(isTipoResolucaoTriagem("insumo")).toBe(true);
    expect(isTipoResolucaoTriagem("lote")).toBe(true);
    expect(isTipoResolucaoTriagem("local")).toBe(true);
    expect(isTipoResolucaoTriagem("equipamento")).toBe(false);
  });

  it("mapeia tipo de resolucao para entidade escaneavel", () => {
    expect(entidadeTipoParaResolucao("insumo")).toBe("insumo");
    expect(entidadeTipoParaResolucao("lote")).toBe("lote");
    expect(entidadeTipoParaResolucao("local")).toBe("local");
  });

  it("calcula custo unitario apenas quando custo total existe", () => {
    expect(calcularCustoUnitarioMinimo(50, 10)).toBe(5);
    expect(calcularCustoUnitarioMinimo(null, 10)).toBeNull();
    expect(calcularCustoUnitarioMinimo(50, 0)).toBeNull();
  });

  it("mantem a resolucao por novo insumo em RPC transacional", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/0070_resolver_triagem_criando_insumo.sql"),
      "utf8",
    ).toLowerCase();

    expect(migration).toContain("create or replace function public.resolver_triagem_criando_insumo");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.insumos");
    expect(migration).toContain("insert into public.identificadores");
    expect(migration).toContain("update public.cadastros_triagem");
    expect(migration).toContain("grant execute on function public.resolver_triagem_criando_insumo");
  });
});
