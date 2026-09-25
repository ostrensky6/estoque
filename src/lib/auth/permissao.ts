import "server-only";
import { cache } from "react";

import { createClientUntyped } from "@/lib/supabase/server";
import { papelAtual } from "@/lib/auth/roles";

/** Chaves verificadas pelo banco em kontrol_private.tem_permissao (0112). */
export type PermissaoVerificada = "tecnicos.remuneracao.ver" | "analises.editar";

/** Papel mínimo equivalente enquanto a migration 0112 não estiver aplicada. */
const PAPEL_PADRAO: Record<PermissaoVerificada, "coordenador" | "gestor"> = {
  "tecnicos.remuneracao.ver": "gestor",
  "analises.editar": "coordenador",
};

/**
 * Permissão efetiva do usuário atual (individual > padrão do papel; admin
 * sempre). A decisão é do banco; aqui só lemos para mostrar ou esconder.
 */
export const temPermissao = cache(async (chave: PermissaoVerificada): Promise<boolean> => {
  const supabase = await createClientUntyped();
  const { data, error } = await supabase.rpc("tem_permissao", { p_chave: chave });
  if (!error && typeof data === "boolean") return data;

  const papel = await papelAtual();
  const ordem = ["tecnico", "coordenador", "gestor", "admin"];
  return ordem.indexOf(papel) >= ordem.indexOf(PAPEL_PADRAO[chave]);
});

export const podeVerRemuneracao = () => temPermissao("tecnicos.remuneracao.ver");
export const podeEditarAnalises = () => temPermissao("analises.editar");
