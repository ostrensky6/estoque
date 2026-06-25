import { OrcamentoSubarea } from "@/components/orcamento/OrcamentoSubarea";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

export default async function OrcamentosRevisaoPage() {
  const linhas = (await carregarLinhasOrcamentos())
    .filter((linha) => linha.grupo === "revisao")
    // Cada linha abre direto a etapa "Proposta final" da demanda de origem,
    // em vez do documento isolado de laboratório/projeto.
    .map((linha) =>
      linha.demandaId
        ? { ...linha, href: `/orcamento/demandas/${linha.demandaId}?etapa=final` }
        : linha,
    );

  return (
    <OrcamentoSubarea
      titulo="Proposta final"
      descricao="Orçamentos com custos preenchidos, prontos para parametrizar, consolidar e emitir a proposta final."
      rows={linhas}
      acaoHref="/orcamento/demandas"
      acaoLabel="Orçamentos não finalizados"
    />
  );
}
