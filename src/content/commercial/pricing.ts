/**
 * Precios indicativos de lanzamiento (editables aquí). No son precios cerrados:
 * la cotización final depende de funcionalidades, integraciones, infraestructura
 * y alcance. No se convierten automáticamente entre monedas.
 */
export type PricingRegion = "co" | "intl";
export type PricingTier = "web" | "systems" | "custom";

export const PRICING: Record<PricingRegion, { currency: "COP" | "USD"; tiers: { key: PricingTier; from: number }[] }> = {
  co: { currency: "COP", tiers: [{ key: "web", from: 590_000 }, { key: "systems", from: 1_490_000 }, { key: "custom", from: 2_900_000 }] },
  intl: { currency: "USD", tiers: [{ key: "web", from: 350 }, { key: "systems", from: 900 }, { key: "custom", from: 1_800 }] },
};

/** Región por defecto según el país del visitante (cabecera de Vercel); Colombia ve COP y el resto USD. */
export function regionForCountry(country: string | null | undefined): PricingRegion {
  return (country ?? "").toUpperCase() === "CO" ? "co" : "intl";
}

/** «Desde» en la moneda de la región: sin decimales; COP lleva el código para no confundirlo con USD. */
export function formatFrom(amount: number, currency: string, locale: string) {
  const n = new Intl.NumberFormat(locale === "en" ? "en-US" : "es-CO", { style: "currency", currency, maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(amount);
  return currency === "COP" ? `${n} COP` : n;
}
