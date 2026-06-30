"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, mensagemErroAdminSupabase } from "@/lib/supabase/admin";
import { temPapel, usuarioAtual } from "@/lib/auth/roles";
import { SENHA_PROVISORIA } from "@/lib/auth/senha-provisoria";
import { PAPEIS, normalizePermissions, selectedPermissionsFromForm, type PapelUsuario } from "@/lib/auth/permissions";
import type { FormState } from "./cadastros";

const PAPEIS_VALIDOS = PAPEIS.map((papel) => papel.value);
const BUCKET_ASSINATURAS = "user-signatures";

function isPapelValido(papel: string): papel is PapelUsuario {
  return PAPEIS_VALIDOS.includes(papel as PapelUsuario);
}

async function permissoesDaCategoria(papel: string, formData?: FormData) {
  if (formData?.getAll("permissoes").length) {
    return selectedPermissionsFromForm(formData, papel);
  }

  const { data } = await createAdminClient()
    .from("permissoes_categorias")
    .select("permissoes")
    .eq("papel", papel)
    .maybeSingle();

  return normalizePermissions(papel, data?.permissoes);
}

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
  if (!isPapelValido(papel)) return { ok: false, message: "Papel inválido." };
  const permissoes = await permissoesDaCategoria(papel, formData);

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
      message: jaExiste ? "Já existe um usuário com este e-mail." : mensagemErroAdminSupabase(error),
    };
  }

  // o trigger criou o perfil; ajusta nome/papel (e garante a flag)
  const supabase = await createClient();
  await supabase
    .from("perfis")
    .update({
      nome: nome || null,
      papel,
      permissoes,
      senha_provisoria: true,
      suspenso: false,
    })
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
  if (!isPapelValido(papel)) return { ok: false, message: "Papel inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update({ nome: nome || null, papel, permissoes: selectedPermissionsFromForm(formData, papel) })
    .eq("id", id);

  // mantém o nome também no Auth (user_metadata)
  const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, { user_metadata: { nome } });

  if (error) return { ok: false, message: error.message };
  if (authError) return { ok: false, message: mensagemErroAdminSupabase(authError) };
  revalidatePath("/usuarios");
  return { ok: true, message: "Usuário atualizado." };
}

export async function salvarPermissoesCategoria(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para editar permissões." };
  }

  const papel = String(formData.get("papel") ?? "");
  if (!isPapelValido(papel)) return { ok: false, message: "Categoria inválida." };

  const permissoes = selectedPermissionsFromForm(formData, papel);
  const { error } = await createAdminClient()
    .from("permissoes_categorias")
    .upsert({ papel, permissoes, atualizado_em: new Date().toISOString() });

  if (error) return { ok: false, message: error.message };
  revalidatePath("/usuarios");
  return { ok: true, message: "Permissões da categoria atualizadas." };
}

export async function criarUsuarioPreAprovado(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para cadastrar usuários." };
  }

  const id = Number(formData.get("pre_aprovado_id") ?? 0);
  if (!id) return { ok: false, message: "Pré-aprovação inválida." };

  const supabase = await createClient();
  const { data: pre, error: preError } = await supabase
    .from("usuarios_pre_aprovados")
    .select("id, nome, email, papel, permissoes")
    .eq("id", id)
    .single();

  if (preError || !pre?.email) return { ok: false, message: "Pré-aprovação não encontrada." };

  const email = String(pre.email).trim().toLowerCase();
  const nome = String(pre.nome ?? "").trim();
  const papel = isPapelValido(String(pre.papel)) ? String(pre.papel) : "tecnico";
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
      message: jaExiste ? "Já existe um usuário com este e-mail." : mensagemErroAdminSupabase(error),
    };
  }

  await supabase
    .from("perfis")
    .update({
      nome: nome || null,
      papel,
      permissoes: normalizePermissions(papel, pre.permissoes ?? (await permissoesDaCategoria(papel))),
      senha_provisoria: true,
      suspenso: false,
    })
    .eq("id", data.user.id);

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `Acesso de ${email} criado. Senha provisória: ${SENHA_PROVISORIA}.`,
  };
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

  const { error: authError } = await createAdminClient().auth.admin.updateUserById(id, {
    ban_duration: suspender ? BAN_SUSPENSO : "none",
  });
  if (authError) return;

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
  if (error) return { ok: false, message: mensagemErroAdminSupabase(error) };

  const supabase = await createClient();
  await supabase.from("perfis").update({ senha_provisoria: true }).eq("id", id);

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: `Senha de ${email || "usuário"} redefinida. Senha provisória: ${SENHA_PROVISORIA} — ele definirá uma nova no próximo acesso.`,
  };
}

export async function salvarAssinaturaUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para alterar assinatura." };
  }

  const id = String(formData.get("id") ?? "");
  const dataUrl = String(formData.get("assinatura_data_url") ?? "");
  const arquivo = formData.get("assinatura") as File | null;
  if (!id) return { ok: false, message: "Usuário inválido." };
  if (!arquivo || arquivo.size <= 0 || !dataUrl.startsWith("data:image/png;base64,")) {
    return { ok: false, message: "Envie uma assinatura em PNG." };
  }
  if (arquivo.size > 600_000 || dataUrl.length > 850_000) {
    return { ok: false, message: "A assinatura está muito grande. Use um PNG menor." };
  }

  const path = `${id}/assinatura.png`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_ASSINATURAS)
    .upload(path, arquivo, { contentType: "image/png", upsert: true });
  if (uploadError) return { ok: false, message: uploadError.message };

  const { error } = await supabase
    .from("perfis")
    .update({ assinatura_path: path, assinatura_url: dataUrl })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/usuarios");
  return { ok: true, message: "Assinatura salva sem fundo." };
}

export async function removerAssinaturaUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para remover assinatura." };
  }
  const id = String(formData.get("id") ?? "");
  const path = String(formData.get("assinatura_path") ?? "");
  if (!id) return { ok: false, message: "Usuário inválido." };

  const supabase = await createClient();
  if (path) {
    await supabase.storage.from(BUCKET_ASSINATURAS).remove([path]);
  }
  const { error } = await supabase
    .from("perfis")
    .update({ assinatura_path: null, assinatura_url: null })
    .eq("id", id);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/usuarios");
  return { ok: true, message: "Assinatura removida." };
}

/**
 * Exclui um usuário definitivamente (Auth + perfil por cascade). Ação
 * irreversível — a auditoria das ações que ele registrou permanece.
 */
export async function excluirUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await temPapel("admin"))) {
    return { ok: false, message: "Sem permissão para excluir usuários." };
  }
  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!id) return { ok: false, message: "Usuário inválido." };

  // um admin não pode excluir a si mesmo
  const eu = await usuarioAtual();
  if (eu?.id === id) return { ok: false, message: "Você não pode excluir o seu próprio usuário." };

  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) return { ok: false, message: mensagemErroAdminSupabase(error) };

  revalidatePath("/usuarios");
  return { ok: true, message: `Usuário ${email || ""} excluído.` };
}
