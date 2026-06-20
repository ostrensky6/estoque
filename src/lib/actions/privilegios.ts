"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { temPermissao } from "@/lib/auth/permissoes";
import { CHAVES_PERMISSAO, PAPEIS, PAPEL_ADMIN } from "@/lib/auth/capacidades";

export async function obterMatriz(): Promise<Record<string, boolean> | null> {
  if (!(await temPermissao("privilegios.gerir"))) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("permissoes_papel")
    .select("papel, chave, permitido");
  const mapa: Record<string, boolean> = {};
  for (const linha of data ?? []) {
    mapa[`${linha.papel}::${linha.chave}`] = linha.permitido === true;
  }
  return mapa;
}

export async function definirPermissao(
  papel: string,
  chave: string,
  permitido: boolean,
): Promise<{ ok: boolean; message?: string }> {
  if (!(await temPermissao("privilegios.gerir"))) {
    return { ok: false, message: "Acesso restrito ao administrador." };
  }
  if (papel === PAPEL_ADMIN) {
    return { ok: false, message: "Administrador tem acesso total e não é editável." };
  }
  if (!PAPEIS.includes(papel as never) || !CHAVES_PERMISSAO.includes(chave)) {
    return { ok: false, message: "Papel ou capacidade inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("permissoes_papel")
    .upsert({ papel, chave, permitido }, { onConflict: "papel,chave" });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/governanca/privilegios");
  return { ok: true };
}
