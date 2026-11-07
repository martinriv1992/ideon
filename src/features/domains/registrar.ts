import "server-only";

/**
 * Registrador de dominios de Vercel (API /v1/registrar). Los dominios se compran
 * con la cuenta de Vercel de la plataforma (se cargan a su método de pago), a
 * nombre del cliente como titular, y se añaden al proyecto de Vercel de la
 * plataforma: Vercel gestiona DNS y SSL y el middleware sirve el sitio.
 *
 * Variables: VERCEL_TOKEN, VERCEL_TEAM_ID y VERCEL_PROJECT_ID (proyecto de la
 * plataforma en Vercel, p. ej. prj_… o «ideon»).
 */

export class RegistrarError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); }
}

export function registrarConfigured() {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!process.env.VERCEL_TOKEN) throw new RegistrarError("not_configured", "La compra de dominios no está configurada (VERCEL_TOKEN).", 503);
  const sep = path.includes("?") ? "&" : "?";
  const team = process.env.VERCEL_TEAM_ID ? `${sep}teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : "";
  const res = await fetch(`https://api.vercel.com${path}${team}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const b = body as { code?: string; message?: string; error?: { code?: string; message?: string } };
    throw new RegistrarError(b.code ?? b.error?.code ?? "registrar_error", b.message ?? b.error?.message ?? `Vercel respondió ${res.status}`, res.status);
  }
  return body as T;
}

export interface DomainPrice { years: number; purchasePrice: number | null; renewalPrice: number | null; transferPrice: number | null }

export async function availability(domain: string) {
  return (await call<{ available: boolean }>(`/v1/registrar/domains/${encodeURIComponent(domain)}/availability`)).available;
}

export async function price(domain: string) {
  return call<DomainPrice>(`/v1/registrar/domains/${encodeURIComponent(domain)}/price?years=1`);
}

export interface Contact {
  firstName: string; lastName: string; email: string; phone: string;
  address1: string; city: string; state: string; zip: string; country: string; companyName?: string;
}

/** Compra el dominio. expectedPrice debe coincidir con el precio actual del registrador. */
export async function buy(domain: string, contact: Contact, expectedPrice: number) {
  return call<{ orderId: string }>(`/v1/registrar/domains/${encodeURIComponent(domain)}/buy`, {
    method: "POST",
    body: JSON.stringify({ autoRenew: false, years: 1, expectedPrice, contactInformation: contact }),
  });
}

/** Renueva un año (cuando el cliente paga su renovación). */
export async function renew(domain: string, expectedPrice: number) {
  return call<{ orderId: string }>(`/v1/registrar/domains/${encodeURIComponent(domain)}/renew`, {
    method: "POST",
    body: JSON.stringify({ years: 1, expectedPrice }),
  });
}

export interface Order {
  orderId: string;
  status: "draft" | "purchasing" | "completed" | "failed";
  domains?: { domainName: string; status: "pending" | "completed" | "failed" | "refunded" | "refund-failed"; price?: number; error?: { code: string } }[];
  error?: { code: string };
}

export async function getOrder(orderId: string) {
  return call<Order>(`/v1/registrar/orders/${encodeURIComponent(orderId)}`);
}

/** Añade el dominio (y www → redirección) al proyecto de la plataforma. Idempotente. */
export async function attachToPlatform(domain: string) {
  const project = process.env.VERCEL_PROJECT_ID;
  if (!project) throw new RegistrarError("not_configured", "Falta VERCEL_PROJECT_ID", 503);
  const add = async (body: Record<string, unknown>) => {
    try { await call(`/v10/projects/${encodeURIComponent(project)}/domains`, { method: "POST", body: JSON.stringify(body) }); }
    catch (e) { if (!(e instanceof RegistrarError && /exist|already/i.test(`${e.code} ${e.message}`))) throw e; }
  };
  await add({ name: domain });
  await add({ name: `www.${domain}`, redirect: domain, redirectStatusCode: 308 });
}
