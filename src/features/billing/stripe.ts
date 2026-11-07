import "server-only";
import Stripe from "stripe";

/** Stripe: pagos de propuestas y suscripciones. Solo activo con STRIPE_SECRET_KEY. */
export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
let client: Stripe | null = null;
export function getStripe() {
  if (!stripeConfigured()) throw Object.assign(new Error("Stripe no está configurado (STRIPE_SECRET_KEY)."), { code: "not_configured" });
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY as string);
  return client;
}

/** Wompi (Colombia): adaptador previsto. Activo cuando existan WOMPI_PUBLIC_KEY/WOMPI_PRIVATE_KEY. */
export function wompiConfigured() {
  return Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY);
}

export function invoiceNumber(date = new Date()) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, "0");
  return `IDN-${y}${m}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}
