import "server-only";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/roles";

export type Entidade = "orcamento" | "orcamento_projeto" | "pedido_compra" | "pedido_interno";

/** Registra uma transição de status na linha do tempo (quem/quando). */
export async function registrarEvento(
  entidade: Entidade,
  entidadeId: number,
  de: string | null,
  para: string,
  observacao?: string | null,
) {
  const supabase = await createClient();
  const u = await usuarioAtual();
  await supabase.from("eventos_status").insert({
    entidade,
    entidade_id: entidadeId,
    de_status: de,
    para_status: para,
    usuario: u?.email ?? null,
    observacao: observacao ?? null,
  });
}

/** Lê a linha do tempo de uma entidade (mais recente primeiro). */
export async function listarEventos(entidade: Entidade, entidadeId: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("eventos_status")
    .select("id, de_status, para_status, usuario, observacao, criado_em")
    .eq("entidade", entidade)
    .eq("entidade_id", entidadeId)
    .order("criado_em", { ascending: false });
  return data ?? [];
}
