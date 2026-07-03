export type FundosPrevistos = {
  impostos: number;
  incubacao: number;
  reserva: number;
  investimentos: number;
};

export type FundosLancamentos = {
  valorRecebido: number;
  impostosPagos: number;
  incubacaoPaga: number;
  reservaGasta: number;
  investimentoGasto: number;
  reservaSaldoAjustado?: number | null;
  investimentoSaldoAjustado?: number | null;
};

export type FundosCalculados = {
  percentualRecebido: number;
  previsto: FundosPrevistos;
  liberado: FundosPrevistos;
  executado: FundosPrevistos;
  saldo: FundosPrevistos;
};

type ParametroSnapshot = {
  chave?: unknown;
  key?: unknown;
  label?: unknown;
  valorCalculado?: unknown;
  amount?: unknown;
};

const CHAVES: Record<keyof FundosPrevistos, string[]> = {
  impostos: ["impostos_legacy", "impostos", "taxes"],
  incubacao: ["incubacao", "incubation"],
  reserva: ["reserva", "reserve", "fundo_reserva"],
  investimentos: ["investimentos", "investment", "investments", "fundo_investimento"],
};

export function dinheiro(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function saldoAjustado(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? dinheiro(n) : null;
}

function chaveParametro(parametro: ParametroSnapshot) {
  return String(parametro.chave ?? parametro.key ?? parametro.label ?? "").toLowerCase();
}

function valorParametro(parametro: ParametroSnapshot) {
  return numero(parametro.valorCalculado ?? parametro.amount);
}

export function extrairFundosPrevistos(parametrosSnapshot: unknown, snapshotFinal?: unknown): FundosPrevistos {
  const parametros = Array.isArray(parametrosSnapshot)
    ? parametrosSnapshot
    : parametrosSnapshot && typeof parametrosSnapshot === "object" && "parametros" in parametrosSnapshot && Array.isArray((parametrosSnapshot as { parametros?: unknown }).parametros)
      ? (parametrosSnapshot as { parametros: unknown[] }).parametros
      : [];
  const fallback = extrairFundosDoSnapshotFinal(snapshotFinal);

  return (Object.keys(CHAVES) as Array<keyof FundosPrevistos>).reduce(
    (acc, campo) => {
      const encontrado = parametros.find((parametro) => {
        const chave = chaveParametro(parametro as ParametroSnapshot);
        return CHAVES[campo].some((alias) => chave === alias || chave.includes(alias));
      });
      acc[campo] = encontrado ? dinheiro(valorParametro(encontrado as ParametroSnapshot)) : fallback[campo];
      return acc;
    },
    { impostos: 0, incubacao: 0, reserva: 0, investimentos: 0 },
  );
}

function extrairFundosDoSnapshotFinal(snapshotFinal?: unknown): FundosPrevistos {
  const vazio = { impostos: 0, incubacao: 0, reserva: 0, investimentos: 0 };
  if (!snapshotFinal || typeof snapshotFinal !== "object") return vazio;

  const consolidado = (snapshotFinal as { consolidado?: unknown }).consolidado;
  if (!consolidado || typeof consolidado !== "object") return vazio;

  const parametros = (consolidado as { parametrosProjeto?: unknown }).parametrosProjeto;
  if (!Array.isArray(parametros)) return vazio;

  return extrairFundosPrevistos(parametros);
}

export function calcularFundos(args: {
  totalFinal: number;
  previstos: FundosPrevistos;
  lancamentos: FundosLancamentos;
}): FundosCalculados {
  const totalFinal = Math.max(0, numero(args.totalFinal));
  const valorRecebido = Math.max(0, numero(args.lancamentos.valorRecebido));
  const percentualRecebido = totalFinal > 0 ? Math.max(0, Math.min(1, valorRecebido / totalFinal)) : 0;
  const liberado = {
    impostos: dinheiro(args.previstos.impostos * percentualRecebido),
    incubacao: dinheiro(args.previstos.incubacao * percentualRecebido),
    reserva: dinheiro(args.previstos.reserva * percentualRecebido),
    investimentos: dinheiro(args.previstos.investimentos * percentualRecebido),
  };
  const executado = {
    impostos: dinheiro(Math.max(0, numero(args.lancamentos.impostosPagos))),
    incubacao: dinheiro(Math.max(0, numero(args.lancamentos.incubacaoPaga))),
    reserva: dinheiro(Math.max(0, numero(args.lancamentos.reservaGasta))),
    investimentos: dinheiro(Math.max(0, numero(args.lancamentos.investimentoGasto))),
  };
  const reservaSaldoAjustado = saldoAjustado(args.lancamentos.reservaSaldoAjustado);
  const investimentoSaldoAjustado = saldoAjustado(args.lancamentos.investimentoSaldoAjustado);

  return {
    percentualRecebido,
    previsto: {
      impostos: dinheiro(args.previstos.impostos),
      incubacao: dinheiro(args.previstos.incubacao),
      reserva: dinheiro(args.previstos.reserva),
      investimentos: dinheiro(args.previstos.investimentos),
    },
    liberado,
    executado,
    saldo: {
      impostos: dinheiro(liberado.impostos - executado.impostos),
      incubacao: dinheiro(liberado.incubacao - executado.incubacao),
      reserva: reservaSaldoAjustado ?? dinheiro(liberado.reserva - executado.reserva),
      investimentos: investimentoSaldoAjustado ?? dinheiro(liberado.investimentos - executado.investimentos),
    },
  };
}
