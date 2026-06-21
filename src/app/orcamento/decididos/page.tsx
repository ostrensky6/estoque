import { OrcamentoSubarea } from "@/components/orcamento/OrcamentoSubarea";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

export default async function OrcamentosDecididosPage() {
  const linhas = (await carregarLinhasOrcamentos()).filter((linha) => linha.grupo === "decididos");

  return (
    <OrcamentoSubarea
      titulo="Aprovados, recusados e cancelados"
      descricao="Resultado comercial e operacional de orçamentos decididos, substituídos ou encerrados sem remoção de histórico."
      rows={linhas}
      acaoHref="/orcamento/historico"
      acaoLabel="Histórico"
    />
  );
}
