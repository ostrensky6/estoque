"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function refreshNotifications() {
  revalidatePath("/");
  revalidatePath("/notificacoes");
}

export async function marcarNotificacaoLida(formData: FormData) {
  const id = Number(formData.get("notificacao_id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ status: "lida", lida_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refreshNotifications();
}

export async function arquivarNotificacao(formData: FormData) {
  const id = Number(formData.get("notificacao_id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ status: "arquivada" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refreshNotifications();
}

export async function marcarTodasNotificacoesLidas() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notificacoes")
    .update({ status: "lida", lida_em: new Date().toISOString() })
    .eq("status", "nao_lida");
  if (error) throw new Error(error.message);
  refreshNotifications();
}
