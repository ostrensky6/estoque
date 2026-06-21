import { OrcamentoSubarea } from "@/components/orcamento/OrcamentoSubarea";
import { carregarLinhasOrcamentos } from "@/lib/orcamento/orcamentos-listagem";

export const dynamic = "force-dynamic";

export default async function OrcamentosRevisaoPage() {
  const linhas = (await carregarLinhasOrcamentos()).filter((linha) => linha.grupo === "revisao");

  return (
    <OrcamentoSubarea
      titulo="Prontos para revisão"
      descricao="Orçamentos laboratoriais e de projeto com custos preenchidos, enviados ou aguardando conferência técnico-financeira."
      rows={linhas}
      acaoHref="/orcamento/parametros"
      acaoLabel="Parâmetros"
    />
  );
}
