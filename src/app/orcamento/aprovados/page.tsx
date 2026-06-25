import { redirect } from "next/navigation";

export default function OrcamentosAprovadosPage() {
  redirect("/orcamento/historico?status=aprovado");
}
