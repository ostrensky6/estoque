function parseDateOnly(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calcularValidadeDiasProposta({
  dataEmissao,
  validoAte,
  fallbackDias = 30,
}: {
  dataEmissao?: string | null;
  validoAte?: string | null;
  fallbackDias?: number;
}) {
  const inicio = parseDateOnly(dataEmissao);
  const fim = parseDateOnly(validoAte);
  if (!inicio || !fim) return fallbackDias;

  const diffDias = Math.round((fim.getTime() - inicio.getTime()) / 86400000);
  return Math.max(1, diffDias);
}
