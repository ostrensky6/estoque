import { redirect } from "next/navigation";

export default function OrcamentosCanceladosPage() {
  redirect("/orcamento/historico?status=cancelado");
}
