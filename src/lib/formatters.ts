export const APP_LOCALE = "pt-BR";
export const APP_TIME_ZONE = "America/Sao_Paulo";
export const APP_CURRENCY = "BRL";

export const numberFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 2,
});

export const integerFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 0,
});

export const percentFormatter = new Intl.NumberFormat(APP_LOCALE, {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

export const currencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
});

export const compactCurrencyFormatter = new Intl.NumberFormat(APP_LOCALE, {
  style: "currency",
  currency: APP_CURRENCY,
  maximumFractionDigits: 0,
});

export const dateFormatter = new Intl.DateTimeFormat(APP_LOCALE, {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatNumber(value: number | null | undefined) {
  return numberFormatter.format(value ?? 0);
}

export function formatInteger(value: number | null | undefined) {
  return integerFormatter.format(value ?? 0);
}

export function formatPercent(value: number | null | undefined) {
  return `${percentFormatter.format(value ?? 0)}%`;
}

export function formatCurrency(value: number | null | undefined) {
  return currencyFormatter.format(value ?? 0);
}

export function formatCompactCurrency(value: number | null | undefined) {
  return compactCurrencyFormatter.format(value ?? 0);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}
