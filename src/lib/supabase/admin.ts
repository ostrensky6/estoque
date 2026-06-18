import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

function adminKey() {
  return process.env.SUPABASE_AUTH_ADMIN_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
}

export function mensagemErroAdminSupabase(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  const key = adminKey();
  const pareceChaveNova = key.startsWith("sb_secret_");
  const pareceErroChave =
    error?.code === "bad_jwt" ||
    /invalid api key|bad jwt|jwt/i.test(message);

  if (pareceChaveNova || pareceErroChave) {
    return "Configuração do Supabase Auth Admin inválida. No Vercel, use a chave legacy service_role JWT em SUPABASE_AUTH_ADMIN_KEY.";
  }

  return message || "Não foi possível concluir a operação administrativa no Supabase.";
}

/**
 * Cliente Supabase com service_role — SOMENTE no servidor (server actions).
 * Ignora RLS. Usado para mutações administrativas internas enquanto a
 * autenticação não está implementada.
 *
 * TODO(auth): quando houver login, trocar mutações para o cliente do usuário
 * autenticado (que respeita RLS) e validar autorização em cada action.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    adminKey(),
    { auth: { persistSession: false } },
  );
}

/**
 * Variante sem o genérico de tipos — para CRUD genérico sobre tabelas
 * resolvidas em runtime (nome de tabela e payload dinâmicos).
 */
export function createAdminClientUntyped(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    adminKey(),
    { auth: { persistSession: false } },
  );
}
