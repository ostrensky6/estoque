import "server-only";
import { createClient } from "@/lib/supabase/server";
import { usuarioAtual } from "@/lib/auth/roles";
import { PAPEL_ADMIN } from "@/lib/auth/capacidades";

/** true se o papel do usuário tem a capacidade `chave` na matriz permissoes_papel. */
export async function temPermissao(chave: string): Promise<boolean> {
  const u = await usuarioAtual();
  if (!u?.papel) return false;
  if (u.papel === PAPEL_ADMIN) return true;

  const supabase = await createClient();
  const { data } = await supabase
    .from("permissoes_papel")
    .select("permitido")
    .eq("papel", u.papel)
    .eq("chave", chave)
    .maybeSingle();

  return data?.permitido === true;
}
