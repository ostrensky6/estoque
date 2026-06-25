import { redirect } from "next/navigation";

export default function OrcamentosEmElaboracaoPage() {
  redirect("/orcamento/demandas?filtro=em_elaboracao");
}
