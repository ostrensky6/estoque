export type MetodoCalculo = "MARKUP" | "GROSS_UP";

export type BaseIncidencia =
  | "APENAS_LABORATORIO"
  | "APENAS_PROJETO"
  | "TODOS_COMPONENTES"
  | "VALOR_FIXO"
  | "NAO_APLICAVEL";

export type ModoLaboratorioNoOrcamento =
  | "CUSTO_TECNICO"
  | "PRECO_JA_FORMADO";

export type ParametroEconomicoAplicavel = {
  chave: string;
  label: string;
  base: BaseIncidencia;
  percentual?: number | null;
  valor?: number | null;
  incluirLaboratorioPrecificado?: boolean;
};

export type AplicarParametrosEconomicosArgs = {
  metodo: MetodoCalculo;
  laboratorio: {
    valor: number;
    modo: ModoLaboratorioNoOrcamento;
  };
  projeto?: {
    custo: number;
  };
  parametros: ParametroEconomicoAplicavel[];
};

export type ParametroEconomicoCalculado = {
  chave: string;
  label: string;
  base: BaseIncidencia;
  percentual: number;
  valorInformado: number;
  valorCalculado: number;
  baseLaboratorio: number;
  baseProjeto: number;
  aplicado: boolean;
};

export type ParametrosEconomicosAplicados = {
  metodo: MetodoCalculo;
  laboratorio: {
    valorEntrada: number;
    modo: ModoLaboratorioNoOrcamento;
    baseIncidencia: number;
    total: number;
  };
  projeto: {
    custoEntrada: number;
    baseIncidencia: number;
    total: number;
  };
  subtotalCustos: number;
  totalParametros: number;
  totalFinal: number;
  parametros: ParametroEconomicoCalculado[];
  alertas: string[];
  snapshot: {
    metodo: MetodoCalculo;
    laboratorio: {
      valorEntrada: number;
      modo: ModoLaboratorioNoOrcamento;
      baseIncidencia: number;
      total: number;
    };
    projeto: {
      custoEntrada: number;
      baseIncidencia: number;
      total: number;
    };
    subtotalCustos: number;
    totalParametros: number;
    totalFinal: number;
    parametros: ParametroEconomicoCalculado[];
    alertas: string[];
  };
};

const n = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function percentualNormalizado(parametro: ParametroEconomicoAplicavel) {
  return Math.max(0, n(parametro.percentual));
}

function valorFixoNormalizado(parametro: ParametroEconomicoAplicavel) {
  return n(parametro.valor);
}

function incideEmLaboratorio(
  parametro: ParametroEconomicoAplicavel,
  modoLaboratorio: ModoLaboratorioNoOrcamento,
) {
  if (
    modoLaboratorio === "PRECO_JA_FORMADO" &&
    !parametro.incluirLaboratorioPrecificado
  ) {
    return false;
  }
  return (
    parametro.base === "APENAS_LABORATORIO" ||
    parametro.base === "TODOS_COMPONENTES"
  );
}

function incideEmProjeto(parametro: ParametroEconomicoAplicavel) {
  return parametro.base === "APENAS_PROJETO" || parametro.base === "TODOS_COMPONENTES";
}

function somaPercentualGrossUp(
  parametros: ParametroEconomicoAplicavel[],
  componente: "laboratorio" | "projeto",
  modoLaboratorio: ModoLaboratorioNoOrcamento,
) {
  return parametros.reduce((acc, parametro) => {
    if (parametro.base === "NAO_APLICAVEL" || parametro.base === "VALOR_FIXO") {
      return acc;
    }
    const incide =
      componente === "laboratorio"
        ? incideEmLaboratorio(parametro, modoLaboratorio)
        : incideEmProjeto(parametro);
    return incide ? acc + percentualNormalizado(parametro) : acc;
  }, 0);
}

export function aplicarParametrosEconomicos(
  args: AplicarParametrosEconomicosArgs,
): ParametrosEconomicosAplicados {
  const valorLaboratorio = Math.max(0, n(args.laboratorio.valor));
  const custoProjeto = Math.max(0, n(args.projeto?.custo));
  const modoLaboratorio = args.laboratorio.modo;
  const parametros = args.parametros ?? [];
  const alertas: string[] = [];

  const laboratorioBaseIncidencia =
    modoLaboratorio === "CUSTO_TECNICO" ? valorLaboratorio : 0;
  const projetoBaseIncidencia = custoProjeto;

  for (const parametro of parametros) {
    if (
      modoLaboratorio === "PRECO_JA_FORMADO" &&
      !parametro.incluirLaboratorioPrecificado &&
      (parametro.base === "APENAS_LABORATORIO" ||
        parametro.base === "TODOS_COMPONENTES")
    ) {
      alertas.push(
        `${parametro.label} nao incidiu sobre laboratorio porque o valor laboratorial ja estava precificado.`,
      );
    }
  }

  if (args.metodo === "GROSS_UP") {
    const somaLaboratorio = somaPercentualGrossUp(
      parametros,
      "laboratorio",
      modoLaboratorio,
    );
    const somaProjeto = somaPercentualGrossUp(
      parametros,
      "projeto",
      modoLaboratorio,
    );
    if (somaLaboratorio >= 100 || somaProjeto >= 100) {
      throw new Error(
        "A soma dos parametros economicos de gross-up deve ser menor que 100%.",
      );
    }
  }

  const totalLaboratorio =
    args.metodo === "GROSS_UP"
      ? roundMoney(
          modoLaboratorio === "PRECO_JA_FORMADO" &&
            somaPercentualGrossUp(parametros, "laboratorio", modoLaboratorio) === 0
            ? valorLaboratorio
            : valorLaboratorio /
                (1 -
                  somaPercentualGrossUp(
                    parametros,
                    "laboratorio",
                    modoLaboratorio,
                  ) /
                    100),
        )
      : valorLaboratorio;

  const totalProjeto =
    args.metodo === "GROSS_UP"
      ? roundMoney(
          custoProjeto /
            (1 -
              somaPercentualGrossUp(parametros, "projeto", modoLaboratorio) /
                100),
        )
      : custoProjeto;

  const calculados = parametros.map((parametro) => {
    const percentual = percentualNormalizado(parametro);
    const valorInformado = valorFixoNormalizado(parametro);
    const aplicado = parametro.base !== "NAO_APLICAVEL";

    if (parametro.base === "VALOR_FIXO") {
      return {
        chave: parametro.chave,
        label: parametro.label,
        base: parametro.base,
        percentual,
        valorInformado,
        valorCalculado: roundMoney(valorInformado),
        baseLaboratorio: 0,
        baseProjeto: 0,
        aplicado,
      };
    }

    if (!aplicado) {
      return {
        chave: parametro.chave,
        label: parametro.label,
        base: parametro.base,
        percentual,
        valorInformado,
        valorCalculado: 0,
        baseLaboratorio: 0,
        baseProjeto: 0,
        aplicado,
      };
    }

    const baseLaboratorio =
      incideEmLaboratorio(parametro, modoLaboratorio)
        ? args.metodo === "GROSS_UP"
          ? totalLaboratorio
          : valorLaboratorio
        : 0;
    const baseProjeto = incideEmProjeto(parametro)
      ? args.metodo === "GROSS_UP"
        ? totalProjeto
        : projetoBaseIncidencia
      : 0;
    const valorCalculado = roundMoney(
      ((baseLaboratorio + baseProjeto) * percentual) / 100,
    );

    return {
      chave: parametro.chave,
      label: parametro.label,
      base: parametro.base,
      percentual,
      valorInformado,
      valorCalculado,
      baseLaboratorio: roundMoney(baseLaboratorio),
      baseProjeto: roundMoney(baseProjeto),
      aplicado,
    };
  });

  const totalParametros = roundMoney(
    calculados.reduce((acc, parametro) => acc + parametro.valorCalculado, 0),
  );
  const totalFinal =
    args.metodo === "GROSS_UP"
      ? roundMoney(
          totalLaboratorio +
            totalProjeto +
            calculados
              .filter((parametro) => parametro.base === "VALOR_FIXO")
              .reduce((acc, parametro) => acc + parametro.valorCalculado, 0),
        )
      : roundMoney(valorLaboratorio + custoProjeto + totalParametros);

  const result = {
    metodo: args.metodo,
    laboratorio: {
      valorEntrada: roundMoney(valorLaboratorio),
      modo: modoLaboratorio,
      baseIncidencia: roundMoney(laboratorioBaseIncidencia),
      total: roundMoney(totalLaboratorio),
    },
    projeto: {
      custoEntrada: roundMoney(custoProjeto),
      baseIncidencia: roundMoney(projetoBaseIncidencia),
      total: roundMoney(totalProjeto),
    },
    subtotalCustos: roundMoney(valorLaboratorio + custoProjeto),
    totalParametros,
    totalFinal,
    parametros: calculados,
    alertas,
  };

  return {
    ...result,
    snapshot: result,
  };
}
