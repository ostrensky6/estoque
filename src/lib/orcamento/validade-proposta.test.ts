import { describe, expect, it } from "vitest";
import { calcularValidadeDiasProposta } from "./validade-proposta";

describe("calcularValidadeDiasProposta", () => {
  it("calcula os dias entre emissão e validade escolhida", () => {
    expect(
      calcularValidadeDiasProposta({
        dataEmissao: "2026-06-27",
        validoAte: "2026-07-27",
      }),
    ).toBe(30);
  });

  it("garante pelo menos um dia quando a validade não passa da emissão", () => {
    expect(
      calcularValidadeDiasProposta({
        dataEmissao: "2026-06-27",
        validoAte: "2026-06-27",
      }),
    ).toBe(1);
  });

  it("usa fallback quando alguma data é inválida", () => {
    expect(
      calcularValidadeDiasProposta({
        dataEmissao: "27/06/2026",
        validoAte: "2026-07-27",
        fallbackDias: 45,
      }),
    ).toBe(45);
  });
});
