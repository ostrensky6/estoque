import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente Supabase para Server Components / Route Handlers.
 * Lê e grava cookies de sessão (auth) via next/headers.
 */
export async function createClient() {
  if (process.env.PLAYWRIGHT_MOCK_SUPABASE === "1") {
    const { createMockSupabaseClient } = await import("@/lib/testing/mock-supabase");
    return createMockSupabaseClient() as unknown as ReturnType<typeof createServerClient<Database>>;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component — pode ser ignorado se houver
            // middleware/proxy renovando a sessão.
          }
        },
      },
    },
  );
}

/**
 * Cliente do usuário autenticado, sem o genérico de tipos — para CRUD
 * genérico (tabela/payload dinâmicos) preservando o contexto de auth/RLS
 * e a captura do usuário na auditoria (JWT).
 */
export async function createClientUntyped(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}
