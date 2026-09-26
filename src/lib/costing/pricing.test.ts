import { describe, expect, it } from "vitest";
import { roundMoney } from "./pricing";

describe("roundMoney", () => {
  it("arredonda para centavos corrigindo o ponto flutuante", () => {
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(117.647058)).toBe(117.65);
  });
});
