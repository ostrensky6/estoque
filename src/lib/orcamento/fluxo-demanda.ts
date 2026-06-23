import { modalidadeExigeLaboratorio, modalidadeExigeProjeto } from "./orcamento-economico";

export type EstadoEtapaDemanda = "ativo" | "concluido" | "pendente" | "bloqueado" | "pulado";

export type EtapaFluxoDemanda = {
  id: "demanda" | "laboratorio" | "projeto" | "parametros" | "final" | "historico";
  numero: number;
  label: string;
  detalhe: string;
  status: string;
  estado: EstadoEtapaDemanda;
  obrigatoria: boolean;
};

export function calcularFluxoDemanda(args: {
  modalidade?: string | null;
  projetoAssociado?: boolean;
  demandaCompleta: boolean;
  demandaFaltante: number;
  laboratorioStatus: "pendente" | "preenchido" | "revisado" | "nao_exigido";
  laboratorioLabel: string;
  projetoStatus: "pendente" | "preenchido" | "revisado" | "nao_exigido";
  projetoLabel: string;
  parametrosLiberados: boolean;
  orcamentoFinalPronto: boolean;
  versoesFinais: number;
}): EtapaFluxoDemanda[] {
  const exigeAnalises = modalidadeExigeLaboratorio(args.modalidade);
  const exigeProjeto = modalidadeExigeProjeto(args.modalidade) || Boolean(args.projetoAssociado);
  const laboratorioLiberado = args.demandaCompleta && exigeAnalises;
  const projetoLiberado = args.demandaCompleta && exigeProjeto;
  // Sequenciamento: quando a modalidade exige análises, o laboratório precisa
  // sair de "pendente" antes de o orçamento de projeto ficar ativo.
  const laboratorioBloqueiaProjeto = exigeAnalises && args.laboratorioStatus === "pendente";

  return [
    {
      id: "demanda",
      numero: 1,
      label: "Demandas",
      detalhe: "Cadastro inicial",
      status: args.demandaCompleta ? "Completa" : `${args.demandaFaltante}% faltante`,
      estado: args.demandaCompleta ? "concluido" : "ativo",
      obrigatoria: true,
    },
    {
      id: "laboratorio",
      numero: 2,
      label: "Análises laboratoriais",
      detalhe: exigeAnalises ? "Amostras, análises e previsão" : "Pulado pela modalidade",
      status: exigeAnalises ? args.laboratorioLabel : "Pulado",
      estado: !exigeAnalises
        ? "pulado"
        : !laboratorioLiberado
          ? "bloqueado"
          : args.laboratorioStatus === "pendente"
            ? "ativo"
            : "concluido",
      obrigatoria: exigeAnalises,
    },
    {
      id: "projeto",
      numero: 3,
      label: "Orçamento de projeto",
      detalhe: exigeProjeto ? "Custos próprios do projeto" : "Pulado pela modalidade",
      status: exigeProjeto ? args.projetoLabel : "Pulado",
      estado: !exigeProjeto
        ? "pulado"
        : !projetoLiberado
          ? "bloqueado"
          : laboratorioBloqueiaProjeto
            ? "bloqueado"
            : args.projetoStatus === "pendente"
              ? "ativo"
              : "concluido",
      obrigatoria: exigeProjeto,
    },
    {
      id: "parametros",
      numero: 4,
      label: "Parâmetros econômicos",
      detalhe: "Depois da composição técnica",
      status: args.parametrosLiberados ? "Liberado" : "Bloqueado",
      estado: args.parametrosLiberados ? "pendente" : "bloqueado",
      obrigatoria: true,
    },
    {
      id: "final",
      numero: 5,
      label: "Proposta final",
      detalhe: "Consolidação e emissão",
      status: args.orcamentoFinalPronto ? "Pronto" : "Bloqueado",
      estado: args.orcamentoFinalPronto ? "pendente" : "bloqueado",
      obrigatoria: true,
    },
    {
      id: "historico",
      numero: 6,
      label: "Histórico e auditoria",
      detalhe: "Registros preservados",
      status: `${args.versoesFinais} versão(ões)`,
      estado: "pendente",
      obrigatoria: false,
    },
  ];
}
