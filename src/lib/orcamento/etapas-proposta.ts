export const MODALIDADES_COM_ANALISES = new Set([
  "analises",
  "analises_projeto",
  "projeto_analises_custos",
]);
export const MODALIDADES_COM_PROJETO = new Set([
  "projeto",
  "analises_projeto",
  "projeto_analises_custos",
]);

export type EtapaProposta = {
  id: "demanda" | "laboratorio" | "projeto" | "parametros" | "final";
  label: string;
  aplicavel: boolean;
};

export function montarEtapasProposta(modalidade: string): EtapaProposta[] {
  const exigeAnalises = MODALIDADES_COM_ANALISES.has(modalidade);
  const exigeProjeto = MODALIDADES_COM_PROJETO.has(modalidade);
  return [
    { id: "demanda", label: "Dados da demanda", aplicavel: true },
    { id: "laboratorio", label: "Orçamento laboratorial", aplicavel: exigeAnalises },
    { id: "projeto", label: "Custos do projeto", aplicavel: exigeProjeto },
    { id: "parametros", label: "Parâmetros econômicos", aplicavel: true },
    { id: "final", label: "Proposta final", aplicavel: true },
  ];
}
