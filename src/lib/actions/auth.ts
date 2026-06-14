"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
