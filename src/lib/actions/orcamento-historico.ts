"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";

const historicoPath = "/orcamento/historico";
const STATUS_CLASSIFICACAO = new Set(["enviado", "alterado_reenviado", "aprovado", "recusado"]);

export async function atualizarOrcamentosFinaisVencidos() {
  await exigirPapelOrcamento("classificar_final");
  const supabase = await createClient();
  const { data: vencidos, error: consultaError } = await supabase
    .from("orcamento_final_versoes")
    .select("id")
    .eq("status", "emitido")
    .lt("valido_ate", new Date().toISOString().slice(0, 10));
  if (consultaError) throw new Error(consultaError.message);
  for (const versao of vencidos ?? []) {
    const { error } = await supabase.rpc("transicionar_orcamento_final", {
      p_versao_id: versao.id,
      p_status_destino: "vencido",
      p_motivo: "Validade expirada.",
    });
    if (error) throw new Error(error.message);
  }
}

export async function cancelarVersaoFinal(formData: FormData) {
  const id = Number(formData.get("versao_id"));
  if (!id) return;
  const motivo = String(formData.get("motivo") ?? "").trim() || "Cancelamento operacional pelo histórico.";
  await exigirPapelOrcamento("cancelar_documento");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transicionar_orcamento_final", {
    p_versao_id: id,
    p_status_destino: "cancelado",
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
  revalidatePath(historicoPath);
  revalidatePath("/orcamento");
}

export async function classificarVersaoFinal(formData: FormData) {
  const id = Number(formData.get("versao_id"));
  const status = String(formData.get("status") ?? "").trim();
  if (!id || !STATUS_CLASSIFICACAO.has(status)) return;

  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  await exigirPapelOrcamento("classificar_final");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transicionar_orcamento_final", {
    p_versao_id: id,
    p_status_destino: status,
    p_motivo: motivo,
  });
  if (error) throw new Error(error.message);
  revalidatePath(historicoPath);
  revalidatePath("/orcamento/fundos");
  revalidatePath("/orcamento");
}

export async function duplicarVersaoFinal(formData: FormData) {
  const id = Number(formData.get("versao_id"));
  if (!id) return;
  await exigirPapelOrcamento("duplicar_final");
  const operacaoId = String(formData.get("operacao_id") ?? "").trim();
  if (!z.string().uuid().safeParse(operacaoId).success) {
    throw new Error("Identidade da operação de duplicação inválida.");
  }
  const validadeDias = Number(formData.get("validade_dias")) || 30;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("duplicar_orcamento_final_transacional", {
      p_versao_id: id,
      p_validade_dias: validadeDias,
      p_operacao_id: operacaoId,
  });
  if (error) throw new Error(error.message);
  const nova = data as { id?: number } | null;
  if (!nova?.id) throw new Error("A duplicação não retornou a nova versão.");

  revalidatePath(historicoPath);
  revalidatePath("/orcamento");
  redirect(`/orcamento/final/${nova.id}`);
}
