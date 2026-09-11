import { describe, expect, it } from "vitest";

import {
  HISTORICAL_ROLE_RECONCILIATION,
  PERMISSOES,
  defaultPermissionsForRole,
  normalizePermissions,
  selectedPermissionsFromForm,
} from "./permissions";

describe("permissoes reconciliadas", () => {
  it("preserva capacidades granulares historicas no catalogo atual", () => {
    const keys = PERMISSOES.map((permissao) => permissao.key);

    expect(keys).toEqual(expect.arrayContaining([
      "analises.ver",
      "analises.editar",
      "estoque.lote.aceitar",
      "estoque.lote.gerir",
      "orcamento.parametros.editar",
      "backups.gerenciar",
      "privilegios.gerenciar",
    ]));
  });

  it("documenta que o papel administrativo historico nao foi colapsado silenciosamente", () => {
    expect(HISTORICAL_ROLE_RECONCILIATION).toContainEqual(expect.objectContaining({
      historico: "administrativo",
      atual: "sem papel dedicado",
    }));
  });

  it("mantem admin como superconjunto de todas as permissoes", () => {
    expect(defaultPermissionsForRole("admin")).toEqual(PERMISSOES.map((permissao) => permissao.key));
    expect(Object.values(normalizePermissions("admin", {})).every(Boolean)).toBe(true);
  });

  it("nao reduz os defaults funcionais ja existentes", () => {
    expect(defaultPermissionsForRole("tecnico")).toEqual(expect.arrayContaining([
      "orcamentos.visualizar",
      "orcamentos.criar_editar",
      "compras.solicitar",
      "estoque.movimentar",
    ]));
    expect(defaultPermissionsForRole("gestor")).toEqual(expect.arrayContaining([
      "orcamentos.cancelar",
      "estoque.descartar_bloquear",
      "auditoria.visualizar",
    ]));
  });

  it("forca permissoes completas para formulario de admin", () => {
    const formData = new FormData();
    formData.append("permissoes", "analises.ver");

    expect(Object.values(selectedPermissionsFromForm(formData, "admin")).every(Boolean)).toBe(true);
  });

  it("distingue zero permissoes explicitas de formulario sem sentinel", () => {
    const explicitamenteVazio = new FormData();
    explicitamenteVazio.set("permissoes_presentes", "1");
    const semFormularioExplicito = new FormData();

    expect(
      Object.values(selectedPermissionsFromForm(explicitamenteVazio, "tecnico")).every(
        (enabled) => enabled === false,
      ),
    ).toBe(true);
    expect(selectedPermissionsFromForm(semFormularioExplicito, "tecnico")).toMatchObject(
      normalizePermissions("tecnico", {}),
    );
    expect(Object.values(selectedPermissionsFromForm(explicitamenteVazio, "admin")).every(Boolean)).toBe(true);
  });
});
