import { redirect } from "next/navigation";

export default function OrcamentosEmitidosPage() {
  redirect("/orcamento/historico?status=emitido");
}
