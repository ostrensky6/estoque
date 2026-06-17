"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { SENHA_PROVISORIA } from "@/lib/auth/senha-provisoria";
import type { FormState } from "./cadastros";

const PAPEIS = ["tecnico", "coordenador", "gestor", "admin"];

// ban "permanente" para suspensão; o GoTrue aceita uma duração em horas.
const BAN_SUSPENSO = "876000h"; // ~100 anos

/**
 * Cadastra um usuário diretamente. Cria a conta no Auth com senha
 * provisória e marca senha_provisoria=true; o trigger cria o perfil e o
 * próprio usuário define a senha definitiva no primeiro acesso.
 */
export async function criarUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para cadastrar usuários." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nome = String(formData.get("nome") ?? "").trim();
  const papel = String(formData.get("papel") ?? "tecnico");
  if (!email) return { ok: false, message: "Informe o e-mail do usuário." };
  if (!PAPEIS.includes(papel)) return { ok: false, message: "Papel inválido." };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SENHA_PROVISORIA,
    email_confirm: true,
    user_metadata: { nome, senha_provisoria: true },
  });

  if (error || !data.user) {
    const jaExiste = error?.message?.toLowerCase().includes("already");
    return {
      ok: false,
      message: jaExiste ? "Já existe um usuário com este e-mail." : (error?.message ?? "Não foi possível criar o usuário."),
    };
  }

  // o trigger criou o perfil; ajusta nome/papel (e garante a flag)
  const supabase = await createClient();
  await supabase
    .from("perfis")
    .update({ nome: nome || null, papel, senha_provisoria: true, suspenso: false })
    .eq("id", data.user.id);

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `Usuário ${email} criado. Senha provisória: ${SENHA_PROVISORIA} (ele definirá a definitiva no primeiro acesso).`,
  };
}

/** Edita nome e papel de um usuário existente. */
export async function editarUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para editar usuários." };
  }
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const papel = String(formData.get("papel") ?? "");
  if (!id) return { ok: false, message: "Usuário inválido." };
  if (!PAPEIS.includes(papel)) return { ok: false, message: "Papel inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ nome: nome || null, papel })
    .eq("id", id);

  // mantém o nome também no Auth (user_metadata)
  await createAdminClient().auth.admin.updateUserById(id, { user_metadata: { nome } });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuário atualizado." };
}

/** Suspende (bloqueia login) ou reativa um usuário. */
export async function alternarSuspensao(formData: FormData) {
  if (!(await temPapel("admin"))) return;
  const id = String(formData.get("id") ?? "");
  const suspender = String(formData.get("suspender") ?? "") === "1";
  if (!id) return;

  // um admin não pode suspender a si mesmo (evita travar o próprio acesso)
  const eu = await usuarioAtual();
  if (suspender && eu?.id === id) return;

  await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: suspender ? BAN_SUSPENSO : "none",
  });

  const supabase = await createClient();
  await supabase.from("perfis").update({ suspenso: suspender }).eq("id", id);
  revalidatePath("/usuarios");
}

/**
 * Reseta a senha de um usuário para a senha provisória e força a troca no
 * próximo acesso (senha_provisoria=true).
 */
export async function resetarSenha(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para resetar senhas." };
  }
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!id) return { ok: false, message: "Usuário inválido." };

  const { error } = await createAdminClient().auth.admin.updateUserById(id, {
    password: SENHA_PROVISORIA,
    user_metadata: { senha_provisoria: true },
  });
  if (error) return { ok: false, message: error.message };

  const supabase = await createClient();
  await supabase.from("perfis").update({ senha_provisoria: true }).eq("id", id);

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `Senha de ${email || "usuário"} redefinida. Senha provisória: ${SENHA_PROVISORIA} — ele definirá uma nova no próximo acesso.`,
  };
}
