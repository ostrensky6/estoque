import "server-only";
import { createClient } from "@/lib/supabase/server";

const ORDEM = ["usuário", "coordenador", "administrativo", "gerente", "administrador"] as const;
export type Papel = (typeof ORDEM)[number];

export async function usuarioAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("perfis")
    .select("nome, email, papel")
    .eq("id", user.id)
    .single();
  return { id: user.id, email: user.email, ...data } as {
    id: string;
    email: string | null;
    nome: string | null;
    papel: Papel;
  };
}

export async function papelAtual(): Promise<Papel> {
  const u = await usuarioAtual();
  return (u?.papel as Papel) ?? "usuário";
}

/** true se o papel do usuário é >= mínimo exigido. */
export async function temPapel(min: Papel): Promise<boolean> {
  const p = await papelAtual();
  return ORDEM.indexOf(p) >= ORDEM.indexOf(min);
}
