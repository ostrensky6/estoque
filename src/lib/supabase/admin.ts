import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
