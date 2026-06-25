import { redirect } from "next/navigation";

export default function OrcamentosRejeitadosPage() {
  redirect("/orcamento/historico?status=rejeitado");
}
