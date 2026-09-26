import "server-only";
import { cache } from "react";
import { PERMISSOES, type PermissaoUsuario } from "@/lib/auth/permissions";
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

/** Pode criar, duplicar, excluir e editar análises (0124: só a permissão). */
export function podeEditarAnalises() {
  return temPermissao("analises.editar");
}

/** Atalho: a caixinha manda (migration 0124). */
export const pode = temPermissao;

/** Lança erro legível quando falta a permissão (para ações chamadas por <form>). */
export async function exigirPermissao(chave: PermissaoUsuario) {
  if (await temPermissao(chave)) return;
  const rotulo = PERMISSOES.find((item) => item.key === chave)?.label ?? chave;
  throw new Error(`Sem permissão: peça ao administrador a permissão “${rotulo}” em Usuários.`);
}

/** Mensagem padrão das ações que devolvem { ok, message }. */
export function semPermissao(chave: PermissaoUsuario) {
  const rotulo = PERMISSOES.find((item) => item.key === chave)?.label ?? chave;
  return { ok: false as const, message: `Sem permissão: peça ao administrador a permissão “${rotulo}” em Usuários.` };
}

export type PermissoesEfetivas = { admin: boolean; permissoes: Record<string, boolean> };

/**
 * Todas as permissões efetivas do usuário corrente numa só consulta
 * (public.minhas_permissoes, 0124). Usada para montar o menu. Falha fechada.
 */
export const minhasPermissoes = cache(async (): Promise<PermissoesEfetivas> => {
  const supabase = await createClientUntyped();
  const { data, error } = await supabase.rpc("minhas_permissoes");
  if (error || !data || typeof data !== "object") return { admin: false, permissoes: {} };
  const bruto = data as { admin?: unknown; permissoes?: Record<string, unknown> };
  const permissoes: Record<string, boolean> = {};
  for (const [chave, valor] of Object.entries(bruto.permissoes ?? {})) {
    if (typeof valor === "boolean") permissoes[chave] = valor;
  }
  return { admin: bruto.admin === true, permissoes };
});

export function temNaLista(efetivas: PermissoesEfetivas, chave: PermissaoUsuario | undefined) {
  if (!chave) return true;
  return efetivas.admin || efetivas.permissoes[chave] === true;
}
