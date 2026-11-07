/**
 * Analítica del sitio comercial (cliente). Los eventos van a window.dataLayer
 * y, si el visitante aceptó cookies y hay NEXT_PUBLIC_GA_ID, a Google Analytics 4.
 * Nunca se envían datos personales de formularios: solo parámetros categóricos.
 */
export type AnalyticsEvent =
  | "page_view" | "language_selected" | "solution_viewed" | "inventory_demo_opened" | "demo_interaction"
  | "lead_form_started" | "lead_form_submitted" | "meeting_cta_clicked" | "meeting_booked" | "proposal_requested";

type Params = Record<string, string | number | boolean | undefined>;
type W = Window & { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };

export function track(name: AnalyticsEvent, params: Params = {}) {
  if (typeof window === "undefined") return;
  const w = window as W;
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined));
  (w.dataLayer ??= []).push({ event: name, ...clean });
  w.gtag?.("event", name, clean);
}

const ATTR_KEY = "ideon.attribution";
export interface Attribution { source?: string; medium?: string; campaign?: string; term?: string; content?: string; referrer?: string; landing_page?: string }

/** Primer contacto: se guarda la primera vez (o la primera visita con UTM) y acompaña al lead. */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  try {
    const q = new URLSearchParams(window.location.search);
    const utm: Attribution = {
      source: q.get("utm_source") ?? undefined, medium: q.get("utm_medium") ?? undefined, campaign: q.get("utm_campaign") ?? undefined,
      term: q.get("utm_term") ?? undefined, content: q.get("utm_content") ?? undefined,
    };
    if (!utm.source && q.get("gclid")) { utm.source = "google"; utm.medium = "cpc"; }
    if (!utm.source && q.get("fbclid")) { utm.source = "facebook"; utm.medium = "paid_social"; }
    const prev = localStorage.getItem(ATTR_KEY);
    const hasUtm = Object.values(utm).some(Boolean);
    if (prev && !(hasUtm && !JSON.parse(prev).source)) return;
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer.slice(0, 300) : undefined;
    if (!utm.source && ref) { try { utm.source = new URL(ref).hostname.replace(/^www\./, ""); utm.medium = "referral"; } catch { /* referencia no válida */ } }
    const value: Attribution = { ...utm, referrer: ref, landing_page: (window.location.pathname + window.location.search).slice(0, 300) };
    localStorage.setItem(ATTR_KEY, JSON.stringify(value));
  } catch { /* almacenamiento no disponible */ }
}

export function getAttribution(): Attribution {
  try { return JSON.parse(localStorage.getItem(ATTR_KEY) ?? "{}") as Attribution; } catch { return {}; }
}

const CONSENT_KEY = "ideon.cookieConsent";
export function getConsent(): "granted" | "denied" | null {
  try { const v = localStorage.getItem(CONSENT_KEY); return v === "granted" || v === "denied" ? v : null; } catch { return null; }
}
export function setConsent(v: "granted" | "denied") {
  try { localStorage.setItem(CONSENT_KEY, v); } catch { /* sin almacenamiento */ }
}
