"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { exigirPapelOrcamento } from "@/lib/orcamento/governanca";
import { registrarEvento } from "./eventos";

function numero(formData: FormData, chave: string) {
  const raw = String(formData.get(chave) ?? "").trim();
  const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor > 0 ? valor : 0;
}

function numeroOpcional(formData: FormData, chave: string) {
  const raw = String(formData.get(chave) ?? "").trim();
  if (!raw) return null;
  const normalizado = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor >= 0 ? valor : null;
}

function texto(formData: FormData, chave: string) {
  const valor = String(formData.get(chave) ?? "").trim();
  return valor || null;
}

export async function salvarAcompanhamentoFundos(formData: FormData) {
  await exigirPapelOrcamento("acompanhar_fundos");

  const versaoId = Number(formData.get("orcamento_final_versao_id"));
  if (!versaoId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const payload = {
    orcamento_final_versao_id: versaoId,
    valor_recebido: numero(formData, "valor_recebido"),
    impostos_pagos: numero(formData, "impostos_pagos"),
    incubacao_paga: numero(formData, "incubacao_paga"),
    reserva_gasta: numero(formData, "reserva_gasta"),
    investimento_gasto: numero(formData, "investimento_gasto"),
    reserva_saldo_ajustado: numeroOpcional(formData, "reserva_saldo_ajustado"),
    investimento_saldo_ajustado: numeroOpcional(formData, "investimento_saldo_ajustado"),
    saldo_ajustado_motivo: texto(formData, "saldo_ajustado_motivo"),
    observacao: texto(formData, "observacao"),
    atualizado_por: user?.id ?? null,
    atualizado_em: new Date().toISOString(),
  };

  const db = supabase as unknown as {
    from: (table: "orcamento_fundos_acompanhamento") => {
      upsert: (
        value: typeof payload,
        options: { onConflict: string },
      ) => { select: (columns: string) => { single: () => Promise<{ data: { id: number } | null; error: { message: string } | null }> } };
    };
  };

  const { data, error } = await db
    .from("orcamento_fundos_acompanhamento")
    .upsert(payload, { onConflict: "orcamento_final_versao_id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await registrarEvento(
    "orcamento_fundos",
    data?.id ?? versaoId,
    null,
    "atualizado",
    `Acompanhamento de fundos atualizado para a versão final #${versaoId}.`,
  );

  revalidatePath("/orcamento/fundos");
  revalidatePath("/orcamento");
}
