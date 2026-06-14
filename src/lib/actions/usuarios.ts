"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { temPapel } from "@/lib/auth/roles";
import type { FormState } from "./cadastros";

const PAPEIS = ["tecnico", "coordenador", "gestor", "admin"];

export async function atualizarPapel(formData: FormData) {
  if (!(await temPapel("admin"))) return;
  const id = String(formData.get("id"));
  const papel = String(formData.get("papel"));
  if (!id || !PAPEIS.includes(papel)) return;
  const supabase = await createClient();
  await supabase.from("perfis").update({ papel }).eq("id", id);
  revalidatePath("/usuarios");
}

export async function prepararConviteUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para convidar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const papel = String(formData.get("papel") ?? "tecnico");
  if (!email) return { ok: false, message: "Informe o e-mail do usuário." };
  if (!PAPEIS.includes(papel)) return { ok: false, message: "Papel inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("notificacoes").insert({
    tipo: "sistema",
    titulo: "Convite de usuário pendente",
    corpo: `${nome ? `${nome} · ` : ""}${email} · papel inicial ${papel}. Envio por e-mail depende de SMTP/Resend.`,
    papel_destino: "admin",
    dedupe_key: `convite_usuario:${email}`,
  });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/usuarios");
  return {
    ok: true,
    message: "Convite preparado como pendência in-app. Envio externo depende de SMTP/Resend.",
  };
}
