/**
 * Precios del lanzamiento y del paquete anual (módulo puro, probado de forma aislada).
 *
 * Lanzamiento = desarrollo (precio de la propuesta) + primer año de hosting
 *               + primer año de dominio (opcional).
 * Renovación  = hosting + dominio, cada año.
 *
 * El dominio se cotiza con el MAYOR entre el precio de compra y el de renovación
 * del registrador (hay extensiones de 1,49 USD el primer año y 40 USD después):
 * así el precio anual es estable y la renovación nunca da pérdida.
 */

export interface BillingSettings {
  currency: string;            // moneda de cobro (COP por defecto)
  usdRate: number;             // 1 USD = usdRate en la moneda de cobro
  hostingYear: number;         // precio anual del hosting, en la moneda de cobro
  domainMarkupPct: number;     // margen sobre el coste del dominio
  tlds: string[];              // extensiones que se ofrecen
  freeChanges: number;         // cambios por chat gratis en la vista previa
  graceDays: number;           // días tras el vencimiento antes de suspender el sitio
}

export const DEFAULT_BILLING: BillingSettings = {
  currency: "COP", usdRate: 4000, hostingYear: 240000, domainMarkupPct: 30,
  tlds: ["com", "co", "net", "org", "online", "store", "shop"], freeChanges: 2, graceDays: 15,
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : d);

export function billingFromSettings(rows: { key: string; value: unknown }[]): BillingSettings {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const tlds = m.get("domain_tlds");
  return {
    currency: typeof m.get("billing_currency") === "string" ? String(m.get("billing_currency")).toUpperCase() : DEFAULT_BILLING.currency,
    usdRate: num(m.get("usd_to_billing_rate"), DEFAULT_BILLING.usdRate),
    hostingYear: num(m.get("hosting_price_year"), DEFAULT_BILLING.hostingYear),
    domainMarkupPct: num(m.get("domain_markup_pct"), DEFAULT_BILLING.domainMarkupPct),
    tlds: Array.isArray(tlds) && tlds.length ? tlds.map((t) => String(t).toLowerCase().replace(/^\./, "")) : DEFAULT_BILLING.tlds,
    freeChanges: Math.floor(num(m.get("free_preview_changes"), DEFAULT_BILLING.freeChanges)),
    graceDays: Math.floor(num(m.get("renewal_grace_days"), DEFAULT_BILLING.graceDays)),
  };
}

/** Redondeo comercial hacia arriba: COP a miles, otras monedas a unidades enteras. */
export function roundPrice(amount: number, currency: string) {
  if (currency === "COP" || currency === "CLP") return Math.ceil(amount / 1000) * 1000;
  return Math.ceil(amount);
}

export function toBilling(amount: number, fromCurrency: string, s: BillingSettings) {
  const from = fromCurrency.toUpperCase();
  if (from === s.currency) return amount;
  if (from === "USD") return amount * s.usdRate;
  if (s.currency === "USD") return amount / s.usdRate;
  throw new Error(`No hay conversión de ${from} a ${s.currency}`);
}

/** Coste anual de referencia del dominio en USD (el mayor entre compra y renovación). */
export function domainCostUsd(price: { purchasePrice: number | null; renewalPrice: number | null }) {
  const p = price.purchasePrice ?? 0; const r = price.renewalPrice ?? 0;
  return Math.max(p, r);
}

export function domainSalePrice(costUsd: number, s: BillingSettings) {
  return roundPrice(toBilling(costUsd, "USD", s) * (1 + s.domainMarkupPct / 100), s.currency);
}

export interface LineItem { key: "development" | "hosting" | "domain"; label: string; amount: number }
export interface Quote { items: LineItem[]; total: number; currency: string; renewal: number }

export function launchQuote(args: {
  development: { title: string; price: number; currency: string } | null;
  domain: { name: string; salePrice: number } | null;
}, s: BillingSettings, lang: "es" | "en" = "es"): Quote {
  const es = lang === "es";
  const items: LineItem[] = [];
  if (args.development) items.push({ key: "development", label: (es ? "Desarrollo: " : "Development: ") + args.development.title, amount: roundPrice(toBilling(args.development.price, args.development.currency, s), s.currency) });
  items.push({ key: "hosting", label: es ? "Hosting y mantenimiento técnico (1 año)" : "Hosting and technical upkeep (1 year)", amount: s.hostingYear });
  if (args.domain) items.push({ key: "domain", label: (es ? "Dominio " : "Domain ") + args.domain.name + (es ? " (1 año)" : " (1 year)"), amount: args.domain.salePrice });
  const total = items.reduce((n, i) => n + i.amount, 0);
  const renewal = s.hostingYear + (args.domain?.salePrice ?? 0);
  return { items, total, currency: s.currency, renewal };
}

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** Normaliza lo que escribe el cliente: «https://www.MiTienda.com/» → { label: "mitienda", tld: "com" }. */
export function parseDomainQuery(input: string): { label: string; tld: string | null } | null {
  const host = input.trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n").replace(/\s+/g, "-");
  if (!host) return null;
  const parts = host.split(".").filter(Boolean);
  const label = parts[0];
  if (!label || !LABEL.test(label) || label.length < 2) return null;
  return { label, tld: parts.length > 1 ? parts.slice(1).join(".") : null };
}

/** Dominios a consultar: el pedido primero (si su extensión se ofrece) y el resto de extensiones. */
export function domainCandidates(input: string, tlds: string[]): string[] {
  const q = parseDomainQuery(input);
  if (!q) return [];
  const order = q.tld && tlds.includes(q.tld) ? [q.tld, ...tlds.filter((t) => t !== q.tld)] : tlds;
  return order.map((t) => `${q.label}.${t}`);
}

/** Estado del paquete anual: activo, en gracia (vencido pero aún servido) o suspendido. */
export function subscriptionState(periodEnd: string | null, graceDays: number, now = new Date()): "active" | "grace" | "suspended" | "none" {
  if (!periodEnd) return "none";
  const end = new Date(periodEnd).getTime();
  if (now.getTime() <= end) return "active";
  return now.getTime() <= end + graceDays * 86_400_000 ? "grace" : "suspended";
}
