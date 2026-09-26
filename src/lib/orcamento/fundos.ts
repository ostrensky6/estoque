import { roundMoney } from "@/lib/costing/pricing";

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
  valorNominal?: unknown;
  amount?: unknown;
};

const CHAVES: Record<keyof FundosPrevistos, string[]> = {
  impostos: ["impostos_legacy", "impostos", "taxes"],
  incubacao: ["incubacao", "incubation"],
  reserva: ["reserva", "reserve", "fundo_reserva"],
  investimentos: ["investimentos", "investment", "investments", "fundo_investimento"],
};

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function saldoAjustado(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? roundMoney(n) : null;
}

function chaveParametro(parametro: ParametroSnapshot) {
  return String(parametro.chave ?? parametro.key ?? parametro.label ?? "").toLowerCase();
}

function valorParametro(parametro: ParametroSnapshot) {
  // Snapshot atual grava `valorNominal`; `valorCalculado`/`amount` vêm de formatos anteriores.
  return numero(parametro.valorCalculado ?? parametro.valorNominal ?? parametro.amount);
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
      acc[campo] = encontrado ? roundMoney(valorParametro(encontrado as ParametroSnapshot)) : fallback[campo];
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

  // Engine atual: consolidado.economia.parametros; versões antigas: parametrosProjeto.
  const economia = (consolidado as { economia?: { parametros?: unknown } }).economia;
  const parametros = Array.isArray(economia?.parametros)
    ? economia.parametros
    : (consolidado as { parametrosProjeto?: unknown }).parametrosProjeto;
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
    impostos: roundMoney(args.previstos.impostos * percentualRecebido),
    incubacao: roundMoney(args.previstos.incubacao * percentualRecebido),
    reserva: roundMoney(args.previstos.reserva * percentualRecebido),
    investimentos: roundMoney(args.previstos.investimentos * percentualRecebido),
  };
  const executado = {
    impostos: roundMoney(Math.max(0, numero(args.lancamentos.impostosPagos))),
    incubacao: roundMoney(Math.max(0, numero(args.lancamentos.incubacaoPaga))),
    reserva: roundMoney(Math.max(0, numero(args.lancamentos.reservaGasta))),
    investimentos: roundMoney(Math.max(0, numero(args.lancamentos.investimentoGasto))),
  };
  const reservaSaldoAjustado = saldoAjustado(args.lancamentos.reservaSaldoAjustado);
  const investimentoSaldoAjustado = saldoAjustado(args.lancamentos.investimentoSaldoAjustado);

  return {
    percentualRecebido,
    previsto: {
      impostos: roundMoney(args.previstos.impostos),
      incubacao: roundMoney(args.previstos.incubacao),
      reserva: roundMoney(args.previstos.reserva),
      investimentos: roundMoney(args.previstos.investimentos),
    },
    liberado,
    executado,
    saldo: {
      impostos: roundMoney(liberado.impostos - executado.impostos),
      incubacao: roundMoney(liberado.incubacao - executado.incubacao),
      reserva: reservaSaldoAjustado ?? roundMoney(liberado.reserva - executado.reserva),
      investimentos: investimentoSaldoAjustado ?? roundMoney(liberado.investimentos - executado.investimentos),
    },
  };
}
