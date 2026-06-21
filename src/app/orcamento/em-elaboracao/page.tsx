import { OrcamentoSubarea } from "@/components/orcamento/OrcamentoSubarea";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

export default async function OrcamentosEmElaboracaoPage() {
  const linhas = (await carregarLinhasOrcamentos()).filter((linha) => linha.grupo === "em_elaboracao");

  return (
    <OrcamentoSubarea
      titulo="Orçamentos em elaboração"
      descricao="Demandas e módulos com custos pendentes ou em preenchimento, antes de revisão e emissão formal."
      rows={linhas}
      acaoHref="/orcamento/demandas"
      acaoLabel="Nova demanda"
    />
  );
}
