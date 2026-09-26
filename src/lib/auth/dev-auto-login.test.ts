import { describe, expect, it } from "vitest";

import { destinoAposDevLogin, emailAutoLoginDev } from "./dev-auto-login";

const LOCAL = {
  NODE_ENV: "development",
  DEV_AUTO_LOGIN_EMAIL: " Admin@Exemplo.com ",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54521",
};

describe("emailAutoLoginDev", () => {
  it("ativa em next dev apontando para Supabase local", () => {
    expect(emailAutoLoginDev(LOCAL)).toBe("admin@exemplo.com");
    expect(emailAutoLoginDev({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54521" })).toBe("admin@exemplo.com");
  });

  it("nunca ativa fora de desenvolvimento", () => {
    expect(emailAutoLoginDev({ ...LOCAL, NODE_ENV: "production" })).toBeNull();
    expect(emailAutoLoginDev({ ...LOCAL, NODE_ENV: "test" })).toBeNull();
  });

  it("nunca ativa com Supabase remoto", () => {
    expect(emailAutoLoginDev({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: "https://gkcjzwfsnoknxgpsumxi.supabase.co" })).toBeNull();
    expect(emailAutoLoginDev({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1.nip.io:54521" })).toBeNull();
    expect(emailAutoLoginDev({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBeNull();
  });

  it("fica desligado sem e-mail configurado", () => {
    expect(emailAutoLoginDev({ ...LOCAL, DEV_AUTO_LOGIN_EMAIL: undefined })).toBeNull();
    expect(emailAutoLoginDev({ ...LOCAL, DEV_AUTO_LOGIN_EMAIL: "  " })).toBeNull();
  });
});

describe("destinoAposDevLogin", () => {
  it("preserva caminhos internos", () => {
    expect(destinoAposDevLogin("/estoque?aba=lotes")).toBe("/estoque?aba=lotes");
  });

  it("bloqueia destinos externos e laços", () => {
    expect(destinoAposDevLogin(null)).toBe("/");
    expect(destinoAposDevLogin("https://externo.com")).toBe("/");
    expect(destinoAposDevLogin("//externo.com")).toBe("/");
    expect(destinoAposDevLogin("/\\externo.com")).toBe("/");
    expect(destinoAposDevLogin("/auth/dev-login")).toBe("/");
    expect(destinoAposDevLogin("/login")).toBe("/");
  });
});
