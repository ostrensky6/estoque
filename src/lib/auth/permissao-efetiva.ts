import "server-only";
import { cache } from "react";
import type { PermissaoUsuario } from "@/lib/auth/permissions";
import { createClientUntyped } from "@/lib/supabase/server";

/**
 * Permissão granular EFETIVA do usuário corrente, avaliada pelo próprio banco
 * (public.tem_permissao → kontrol_private.tem_permissao_efetiva, migration
 * 0112): admin sempre; suspenso/sem perfil nunca; perfil individual antes da
 * categoria. Assim o app e as policies/funções do banco concordam.
 *
 * Falha fechada: erro de RPC ou resposta não booleana ⇒ false.
 * Memoizada por requisição (React cache).
 */
export const temPermissao = cache(async (chave: PermissaoUsuario): Promise<boolean> => {
  const supabase = await createClientUntyped();
  const { data, error } = await supabase.rpc("tem_permissao", { p_chave: chave });
  if (error) return false;
  return data === true;
});

/** Atalho para a permissão que protege salários e valores de pessoal (PE). */
export function podeVerSalario() {
  return temPermissao("tecnicos.salario.ver");
}
