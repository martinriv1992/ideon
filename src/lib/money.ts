/** Formato de importes (COP sin decimales). Compartido por servidor y cliente. */
export function money(amount: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CO", { style: "currency", currency, maximumFractionDigits: currency === "COP" ? 0 : 2 }).format(amount);
}
