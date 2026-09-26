import { describe, expect, it } from "vitest";

import { formatDate } from "./formatters";

describe("formatDate", () => {
  it("mostra datas de calendário sem voltar um dia no fuso de São Paulo", () => {
    expect(formatDate("2026-10-25")).toBe("25/10/2026");
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
  });

  it("converte instantes para o fuso de São Paulo", () => {
    expect(formatDate("2026-10-25T02:00:00Z")).toBe("24/10/2026");
    expect(formatDate("2026-10-25T15:00:00Z")).toBe("25/10/2026");
  });

  it("trata vazios e inválidos", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("")).toBe("—");
    expect(formatDate("não é data")).toBe("—");
  });
});
