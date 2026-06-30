import { redirect } from "next/navigation";

import { permiteMinRole } from "@/config/modules";
import { createClient } from "@/lib/supabase/server";

export default async function GovernancaRedirectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/ajuda");

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();

  if (permiteMinRole(perfil, "gestor")) {
    redirect("/auditoria");
  }

  redirect("/ajuda");
}
