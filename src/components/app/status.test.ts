import { describe, expect, it } from "vitest";
import { statusInfo } from "./status";

describe("statusInfo", () => {
  it("mapeia status conhecidos para tom e rótulo", () => {
    expect(statusInfo("aprovado")).toEqual({ label: "Aprovado", tone: "success" });
    expect(statusInfo("rascunho")).toEqual({ label: "Rascunho", tone: "neutral" });
    expect(statusInfo("vencido")).toEqual({ label: "Vencido", tone: "danger" });
    expect(statusInfo("enviado")).toEqual({ label: "Enviado", tone: "info" });
    expect(statusInfo("quarentena")).toEqual({ label: "Quarentena", tone: "warning" });
    expect(statusInfo("cancelado")).toEqual({ label: "Cancelado", tone: "danger" });
    expect(statusInfo("nao_lida")).toEqual({ label: "Não lida", tone: "warning" });
    expect(statusInfo("aguardando_pagamento_nf")).toEqual({
      label: "Aguardando pagamento NF",
      tone: "warning",
    });
  });

  it("faz fallback neutro com o proprio texto para status desconhecido", () => {
    expect(statusInfo("qualquer_coisa")).toEqual({ label: "qualquer_coisa", tone: "neutral" });
  });
});
