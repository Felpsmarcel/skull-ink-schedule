const EURO_LOCALE = "pt-PT";
const TIMEZONE = "Europe/Brussels";

const currencyFormatter = new Intl.NumberFormat(EURO_LOCALE, {
  style: "currency",
  currency: "EUR",
});

const dateFormatter = new Intl.DateTimeFormat(EURO_LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(EURO_LOCALE, {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDate(date: Date | string | number): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: Date | string | number): string {
  return dateTimeFormatter.format(new Date(date));
}

export const APP_TIMEZONE = TIMEZONE;