import { redirect } from "next/navigation";

export default function OrcamentosSubstituidosPage() {
  redirect("/orcamento/historico?status=substituido");
}
