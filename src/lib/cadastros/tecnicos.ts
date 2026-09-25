import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { podeVerRemuneracao } from "@/lib/auth/permissao";

/** Texto exibido no lugar da remuneração para quem não tem a permissão. */
export const REMUNERACAO_MASCARA = "XXX";

/** Colunas que revelam a remuneração individual. */
export const COLUNAS_REMUNERACAO = ["valor_mes", "custo_hora", "valor_hh"] as const;

type Linha = Record<string, unknown>;

/**
 * Técnicos visíveis ao usuário atual. Com a permissão
 * 'tecnicos.remuneracao.ver', lê a tabela; sem ela, usa listar_tecnicos()
 * (0112), que devolve nome, processo, horas e dedicação sem o salário.
 */
export async function carregarTecnicos(
  supabase: SupabaseClient,
): Promise<{ rows: Linha[]; remuneracaoVisivel: boolean }> {
  if (await podeVerRemuneracao()) {
    const { data, error } = await supabase.from("tecnicos").select("*").order("id");
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as Linha[], remuneracaoVisivel: true };
  }

  const { data, error } = await supabase.rpc("listar_tecnicos");
  if (!error) {
    return {
      rows: ((data ?? []) as Linha[]).map(({ remuneracao_visivel: _visivel, ...linha }) => ({
        ...linha,
        valor_mes: null,
      })),
      remuneracaoVisivel: false,
    };
  }

  // Antes da migration 0112: lê só as colunas não sensíveis.
  const { data: basico, error: erroBasico } = await supabase
    .from("tecnicos")
    .select("id, nome, processo, horas_mes_base, percentual_dedicado")
    .order("id");
  if (erroBasico) throw new Error(erroBasico.message);
  return {
    rows: ((basico ?? []) as Linha[]).map((linha) => ({ ...linha, valor_mes: null })),
    remuneracaoVisivel: false,
  };
}

/** Substitui a remuneração pelo texto da máscara. */
export function mascararRemuneracao(rows: Linha[]): Linha[] {
  return rows.map((linha) => {
    const copia = { ...linha };
    for (const coluna of COLUNAS_REMUNERACAO) copia[coluna] = REMUNERACAO_MASCARA;
    return copia;
  });
}
