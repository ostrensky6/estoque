"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "./cadastros";

export async function entrar(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  if (!email || !senha) return { ok: false, message: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) return { ok: false, message: "E-mail ou senha inválidos." };
  redirect("/");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function solicitarRedefinicaoSenha(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { ok: false, message: "Informe o e-mail para receber o link de redefinição." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"}/login`,
  });

  if (error) return { ok: false, message: "Não foi possível enviar a redefinição agora." };
  return {
    ok: true,
    message: "Se o e-mail existir no Kontrol, o link de redefinição será enviado.",
  };
}

/**
 * Define a senha definitiva de quem entrou com senha provisória. Limpa a
 * flag senha_provisoria no Auth e no perfil. Como updateUser rotaciona a
 * sessão, a baixa em perfis é feita pelo cliente admin (o cliente do
 * usuário ficaria com token defasado e o RLS barraria a escrita).
 */
export async function definirSenhaDefinitiva(_prev: FormState, formData: FormData): Promise<FormState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (senha.length < 8) return { ok: false, message: "A senha deve ter ao menos 8 caracteres." };
  if (senha !== confirmar) return { ok: false, message: "As senhas não conferem." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.auth.updateUser({
    password: senha,
    data: { senha_provisoria: false },
  });
  if (error) return { ok: false, message: error.message };

  await createAdminClient().from("perfis").update({ senha_provisoria: false }).eq("id", user.id);

  redirect("/");
}
