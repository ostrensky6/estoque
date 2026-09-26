/**
 * Login automático para desenvolvimento local.
 *
 * Só fica ativo quando as três condições valem ao mesmo tempo:
 * - o app roda em `next dev` (NODE_ENV === "development");
 * - DEV_AUTO_LOGIN_EMAIL está definido;
 * - o Supabase configurado é local (127.0.0.1, localhost ou [::1]).
 *
 * Em produção (Vercel) NODE_ENV é "production" e o Supabase é remoto, então
 * a rota /auth/dev-login responde 404 e o fluxo normal de senha continua.
 */

type Env = Record<string, string | undefined>;

const HOSTS_LOCAIS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export const ROTA_DEV_LOGIN = "/auth/dev-login";

export function emailAutoLoginDev(env: Env = process.env): string | null {
  if (env.NODE_ENV !== "development") return null;

  const email = env.DEV_AUTO_LOGIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;

  try {
    const host = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
    return HOSTS_LOCAIS.has(host) ? email : null;
  } catch {
    return null;
  }
}

/** Aceita apenas caminhos internos; evita redirecionamento aberto e laços. */
export function destinoAposDevLogin(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (next.startsWith(ROTA_DEV_LOGIN) || next.startsWith("/login")) return "/";
  return next;
}
