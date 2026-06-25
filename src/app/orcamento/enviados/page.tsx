import { redirect } from "next/navigation";

export default function OrcamentosEnviadosPage() {
  redirect("/orcamento/historico?status=enviado");
}
