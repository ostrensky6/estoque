import { describe, expect, it } from "vitest";
import { moduloBloqueadoParaEdicao } from "./ciclo-vida-modulo";

describe("moduloBloqueadoParaEdicao", () => {
  it("permite edição em rascunho/preenchido", () => {
    expect(moduloBloqueadoParaEdicao({ status: "rascunho" }).bloqueado).toBe(false);
    expect(moduloBloqueadoParaEdicao({ status: "rascunho", statusOperacional: "preenchido" }).bloqueado).toBe(false);
  });

  it("bloqueia documentos enviado/aprovado/cancelado", () => {
    for (const status of ["enviado", "aprovado", "cancelado"]) {
      expect(moduloBloqueadoParaEdicao({ status }).bloqueado).toBe(true);
    }
  });

  it("bloqueia módulo com status_operacional revisado", () => {
    const r = moduloBloqueadoParaEdicao({ status: "rascunho", statusOperacional: "revisado" });
    expect(r.bloqueado).toBe(true);
    expect(r.motivo).toMatch(/nova revisão/i);
  });
});
