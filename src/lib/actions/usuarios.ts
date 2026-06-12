"use server";

import { revalidatePath } from "next/cache";
import { createClientUntyped } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";

const PAPEIS = ["tecnico", "coordenador", "gestor", "admin"];

export async function atualizarPapel(formData: FormData) {
  if (!(await temPapel("admin"))) return;
  const id = String(formData.get("id"));
  const papel = String(formData.get("papel"));
  if (!id || !PAPEIS.includes(papel)) return;
  const supabase = await createClientUntyped();
  await supabase.from("perfis").update({ papel }).eq("id", id);
  revalidatePath("/usuarios");
}
