import type { OrcamentoFila } from "./orcamentos-listagem";

export type ResumoFunil = {
  emElaboracao: number;
  revisao: number;
  emitidas: number;
  aprovadas: number;
  recusadas: number;
  concluidas: number;
};

export function resumirFunilPropostas(linhas: OrcamentoFila[]): ResumoFunil {
  const resumo: ResumoFunil = {
    emElaboracao: 0,
    revisao: 0,
    emitidas: 0,
    aprovadas: 0,
    recusadas: 0,
    concluidas: 0,
  };
  for (const linha of linhas) {
    if (linha.grupo === "em_elaboracao") resumo.emElaboracao += 1;
    if (linha.grupo === "revisao") resumo.revisao += 1;
    if (linha.grupo === "emitidos") resumo.emitidas += 1;
    if (linha.grupo === "decididos") resumo.concluidas += 1;
    if (linha.status === "aprovado") resumo.aprovadas += 1;
    if (linha.status === "recusado") resumo.recusadas += 1;
  }
  return resumo;
}
