import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrcamentoProjetoLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("orcamento_projetos")
    .select("demanda_id")
    .eq("id", Number(id))
    .single();
  if (data?.demanda_id) {
    redirect(`/orcamento/demandas/${data.demanda_id}#projeto`);
  }
  redirect("/orcamento/demandas");
}
