"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import { registrarEvento } from "./eventos";

const historicoPath = "/orcamento/historico";
const STATUS_CLASSIFICACAO = new Set(["enviado", "alterado_reenviado", "aprovado", "recusado"]);

export async function atualizarOrcamentosFinaisVencidos() {
  const supabase = await createClient();
  await supabase
    .from("orcamento_final_versoes")
    .update({ status: "vencido" })
    .eq("status", "emitido")
    .lt("valido_ate", new Date().toISOString().slice(0, 10));
}

export async function cancelarVersaoFinal(formData: FormData) {
  const id = Number(formData.get("versao_id"));
  if (!id) return;
  const motivo = String(formData.get("motivo") ?? "").trim() || "Cancelamento operacional pelo histórico.";
  await exigirPapelOrcamento("cancelar_documento");
  const supabase = await createClient();
  const { error } = await supabase
    .from("orcamento_final_versoes")
    .update({
      status: "cancelado",
      cancelado_em: new Date().toISOString(),
      cancelado_motivo: motivo,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await registrarEvento("orcamento_final", id, "emitido", "cancelado", motivo);
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
  const db = supabase as unknown as {
    from: (table: "orcamento_final_versoes") => {
      select: (columns: string) => {
        eq: (column: string, value: unknown) => {
          single: () => Promise<{ data: { status: string | null } | null; error: { message: string } | null }>;
        };
      };
      update: (value: {
        status: string;
        classificado_em: string;
        classificado_por: string | null;
        classificacao_motivo: string | null;
      }) => { eq: (column: string, value: unknown) => Promise<{ error: { message: string } | null }> };
    };
  };
  const { data: atual, error: atualError } = await db
    .from("orcamento_final_versoes")
    .select("status")
    .eq("id", id)
    .single();
  if (atualError) throw new Error(atualError.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await db
    .from("orcamento_final_versoes")
    .update({
      status,
      classificado_em: new Date().toISOString(),
      classificado_por: user?.id ?? null,
      classificacao_motivo: motivo,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await registrarEvento(
    "orcamento_final",
    id,
    typeof atual?.status === "string" ? atual.status : null,
    status,
    motivo ?? `Classificação comercial alterada para ${status}.`,
  );
  revalidatePath(historicoPath);
  revalidatePath("/orcamento/fundos");
  revalidatePath("/orcamento");
}

export async function duplicarVersaoFinal(formData: FormData) {
  const id = Number(formData.get("versao_id"));
  if (!id) return;
  await exigirPapelOrcamento("duplicar_final");
  const validadeDias = Number(formData.get("validade_dias")) || 30;
  const supabase = await createClient();
  const { data: original, error: originalError } = await supabase
    .from("orcamento_final_versoes")
    .select("*")
    .eq("id", id)
    .single();
  if (originalError) throw new Error(originalError.message);
  if (!original) return;

  const { data: ultima } = await supabase
    .from("orcamento_final_versoes")
    .select("versao")
    .eq("demanda_id", original.demanda_id)
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const novaVersao = Number(ultima?.versao ?? 0) + 1;
  const numeroBase = String(original.numero ?? `OF-${original.demanda_id}`);
  const numero = `${numeroBase.replace(/-v\d+$/i, "")}-v${novaVersao}`;
  const validoAte = new Date(Date.now() + validadeDias * 86400000).toISOString().slice(0, 10);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("orcamento_final_versoes")
    .update({ status: "substituido" })
    .eq("demanda_id", original.demanda_id)
    .eq("status", "emitido");

  const { data: nova, error } = await supabase
    .from("orcamento_final_versoes")
    .insert({
      demanda_id: original.demanda_id,
      versao: novaVersao,
      numero,
      validade_dias: validadeDias,
      valido_ate: validoAte,
      total_laboratorio_custo: original.total_laboratorio_custo,
      total_laboratorio_preco: original.total_laboratorio_preco,
      total_projeto_custo: original.total_projeto_custo,
      total_projeto_final: original.total_projeto_final,
      total_final: original.total_final,
      snapshot: original.snapshot,
      criado_por: user?.id ?? null,
      duplicada_de_id: original.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await registrarEvento(
    "orcamento_final",
    nova?.id ?? id,
    String(id),
    `v${novaVersao}`,
    `Versão final duplicada a partir de #${id}.`,
  );

  revalidatePath(historicoPath);
  revalidatePath("/orcamento");
  revalidatePath(`/orcamento/demandas/${original.demanda_id}`);
  redirect(`/orcamento/final/${nova?.id ?? id}`);
}
