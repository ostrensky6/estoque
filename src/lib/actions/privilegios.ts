"use server";

import { revalidatePath } from "next/cache";

import type { FormState } from "@/lib/actions/cadastros";
import { temPapel } from "@/lib/auth/roles";
import { PAPEIS, selectedPermissionsFromForm, type PapelUsuario } from "@/lib/auth/permissions";
import { buildPermissoesPorCategoria } from "@/lib/auth/permission-categories";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAPEIS_VALIDOS = PAPEIS.map((papel) => papel.value);

function isPapelValido(papel: string): papel is PapelUsuario {
  return PAPEIS_VALIDOS.includes(papel as PapelUsuario);
}

export async function obterMatrizPrivilegios() {
  if (!(await temPapel("admin"))) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("permissoes_categorias").select("papel, permissoes");
  return buildPermissoesPorCategoria(data ?? []);
}

export async function salvarPrivilegiosPapel(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    if (!(await temPapel("admin"))) {
      return { ok: false, message: "Sem permissão para editar privilégios." };
    }

    const papel = String(formData.get("papel") ?? "");
    if (!isPapelValido(papel)) return { ok: false, message: "Papel inválido." };

    const permissoes = selectedPermissionsFromForm(formData, papel);
    const { error } = await createAdminClient()
      .from("permissoes_categorias")
      .upsert({ papel, permissoes, atualizado_em: new Date().toISOString() });

    if (error) return { ok: false, message: error.message };

    revalidatePath("/governanca/privilegios");
    revalidatePath("/usuarios");
    return { ok: true, message: "Privilégios atualizados." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível salvar os privilégios.";
    return { ok: false, message };
  }
}
