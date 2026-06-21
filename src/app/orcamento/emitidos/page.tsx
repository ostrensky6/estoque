import { OrcamentoSubarea } from "@/components/orcamento/OrcamentoSubarea";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

export default async function OrcamentosEmitidosPage() {
  const linhas = (await carregarLinhasOrcamentos()).filter((linha) => linha.grupo === "emitidos");

  return (
    <OrcamentoSubarea
      titulo="Orçamentos emitidos e enviados"
      descricao="Versões finais ativas, documentos enviados e orçamentos dentro do ciclo de validade ou vencimento."
      rows={linhas}
      acaoHref="/orcamento/historico"
      acaoLabel="Histórico"
    />
  );
}
