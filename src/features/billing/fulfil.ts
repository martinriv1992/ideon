import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { invoiceNumber } from "./stripe";
import { billingFromSettings, type BillingSettings } from "./pricing";
import * as registrar from "@/features/domains/registrar";
import { requestPublish } from "@/features/deploy/review";
import type { DomainOrder, Json, Project } from "@/types/database.types";

/**
 * Lo que ocurre cuando un pago se confirma (idempotente: ePayco puede reenviar
 * la confirmación varias veces).
 *   · lanzamiento → proyecto activado, paquete anual, sitio publicado y compra del dominio.
 *   · renovación  → el paquete anual se extiende un año y se renueva el dominio.
 *   · dominio     → compra de un dominio para un proyecto ya activado; se suma a la renovación.
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface PaymentMeta {
  type: "launch" | "renewal" | "changes" | "domain";
  /** Paquete de cambios comprado (type = "changes"). */
  pack_qty?: number;
  user_id: string;
  items: { key: string; label: string; amount: number }[];
  renewal: number;
  domain: string | null;
  domain_order_id: string | null;
  subscription_id?: string | null;
  epayco?: Record<string, string>;
}

export async function getBilling(db: Admin = createAdminClient()): Promise<BillingSettings> {
  const { data } = await db.from("platform_settings").select("key,value");
  return billingFromSettings(data ?? []);
}

/** El proyecto salió de la vista previa gratuita (o lo mira un administrador de la plataforma). */
export function isUnlocked(project: Pick<Project, "paid_at">, isPlatformAdmin = false) {
  return Boolean(project.paid_at) || isPlatformAdmin;
}

const addYear = (from: Date) => { const d = new Date(from); d.setFullYear(d.getFullYear() + 1); return d; };

async function event(db: Admin, projectId: string, type: string, payload: Json = {}) {
  await db.from("project_events").insert({ project_id: projectId, actor_type: "system", type, payload });
}

export async function fulfilPayment(paymentId: string, providerData: Record<string, string>) {
  const db = createAdminClient();
  // Transición atómica pending → paid: solo una confirmación concurrente la gana.
  const { data: payment } = await db.from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", paymentId).eq("status", "pending").select("*").maybeSingle();
  if (!payment) {
    // Reintento tras un fallo a mitad: el pago ya consta como pagado pero el proyecto no se activó.
    const { data: paid } = await db.from("payments").select("*").eq("id", paymentId).eq("status", "paid").maybeSingle();
    const m = paid?.metadata as unknown as PaymentMeta | undefined;
    if (paid?.project_id && m?.type === "domain" && m.domain_order_id) await purchaseDomain(m.domain_order_id);
    if (paid?.project_id && m?.type === "launch") {
      const { data: pr } = await db.from("projects").select("paid_at").eq("id", paid.project_id).single();
      if (pr && !pr.paid_at) await fulfilLaunch(db, paid.project_id, paid.organization_id, paid.amount, paid.currency, m);
    }
    return { alreadyProcessed: true };
  }

  const meta = { ...(payment.metadata as unknown as PaymentMeta), epayco: providerData };
  await db.from("payments").update({ metadata: meta as unknown as Json, external_id: providerData.x_ref_payco ?? payment.external_id }).eq("id", payment.id);
  await db.from("invoices").insert({ organization_id: payment.organization_id, payment_id: payment.id, number: invoiceNumber(), amount: payment.amount, currency: payment.currency });
  if (!payment.project_id) return { ok: true };
  await event(db, payment.project_id, "payment.received", { amount: payment.amount, currency: payment.currency, type: meta.type });

  if (meta.type === "launch") await fulfilLaunch(db, payment.project_id, payment.organization_id, payment.amount, payment.currency, meta);
  else if (meta.type === "renewal") await fulfilRenewal(db, payment.project_id, meta);
  else if (meta.type === "domain") await fulfilDomain(db, payment.project_id, meta);
  else if (meta.type === "changes" && meta.subscription_id && meta.pack_qty) {
    const { data: sub } = await db.from("subscriptions").select("extra_changes").eq("id", meta.subscription_id).single();
    if (sub) await db.from("subscriptions").update({ extra_changes: sub.extra_changes + meta.pack_qty }).eq("id", meta.subscription_id);
    await event(db, payment.project_id, "changes.purchased", { qty: meta.pack_qty });
  }
  return { ok: true };
}

async function fulfilLaunch(db: Admin, projectId: string, orgId: string, _amount: number, currency: string, meta: PaymentMeta) {
  const now = new Date();
  // Reclamo atómico: si el proyecto ya estaba activado (confirmación repetida o
  // simultánea), no se publica ni se compra nada otra vez.
  const { data: claimed } = await db.from("projects").update({ paid_at: now.toISOString() }).eq("id", projectId).is("paid_at", null).select("id").maybeSingle();
  if (!claimed) return;
  await event(db, projectId, "project.activated");

  const { data: existing } = await db.from("subscriptions").select("id").eq("project_id", projectId).eq("plan", "hosting_domain").maybeSingle();
  if (!existing) {
    await db.from("subscriptions").insert({
      organization_id: orgId, project_id: projectId, provider: "epayco", plan: "hosting_domain", amount: meta.renewal, renewal_amount: meta.renewal,
      currency, period: "year", status: "active", current_period_end: addYear(now).toISOString(), domain: meta.domain,
    });
  }

  // Publicación en el hosting de Ideon: con revisión manual queda pendiente de aprobación
  // (el dominio se conecta al terminar su compra o al aprobar la publicación).
  try { await requestPublish(projectId, meta.user_id, { origin: "payment" }); }
  catch (e) { await event(db, projectId, "deploy.failed", { message: e instanceof Error ? e.message : String(e) }); }

  if (meta.domain_order_id) await purchaseDomain(meta.domain_order_id);
}

async function fulfilDomain(db: Admin, projectId: string, meta: PaymentMeta) {
  if (!meta.subscription_id || !meta.domain || !meta.domain_order_id) return;
  const { data: sub } = await db.from("subscriptions").select("id,domain,renewal_amount,amount").eq("id", meta.subscription_id).single();
  // Desde ahora el dominio se renueva junto con el plan anual.
  if (sub && !sub.domain) {
    const renewal = Number(sub.renewal_amount ?? sub.amount) + meta.renewal;
    await db.from("subscriptions").update({ domain: meta.domain, renewal_amount: renewal, amount: renewal }).eq("id", sub.id);
  }
  await event(db, projectId, "domain.paid", { domain: meta.domain });
  await purchaseDomain(meta.domain_order_id);
}

async function fulfilRenewal(db: Admin, projectId: string, meta: PaymentMeta) {
  if (!meta.subscription_id) return;
  const { data: sub } = await db.from("subscriptions").select("*").eq("id", meta.subscription_id).single();
  if (!sub) return;
  const base = sub.current_period_end && new Date(sub.current_period_end) > new Date() ? new Date(sub.current_period_end) : new Date();
  // Nuevo año: el contador de cambios se reinicia y los paquetes no usados no se acumulan.
  await db.from("subscriptions").update({ status: "active", current_period_end: addYear(base).toISOString(), changes_used: 0, extra_changes: 0 }).eq("id", sub.id);
  await event(db, projectId, "subscription.renewed", { until: addYear(base).toISOString() });
  // En modo de pruebas de ePayco el pago es ficticio: no se renueva el dominio real.
  if (sub.domain && process.env.EPAYCO_TEST !== "true") {
    try {
      const p = await registrar.price(sub.domain);
      if (p.renewalPrice == null) throw new Error("Sin precio de renovación");
      await registrar.renew(sub.domain, p.renewalPrice);
      await db.from("domain_orders").update({ expires_at: addYear(base).toISOString() }).eq("project_id", projectId).eq("domain", sub.domain).eq("status", "active");
      await event(db, projectId, "domain.renewed", { domain: sub.domain });
    } catch (e) {
      await event(db, projectId, "domain.renew_failed", { domain: sub.domain, message: e instanceof Error ? e.message : String(e) });
    }
  }
}

/** Compra el dominio en el registrador. Si el precio subió más de un 10 % desde la cotización, se detiene para revisión. */
export async function purchaseDomain(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db.from("domain_orders").update({ status: "purchasing" }).eq("id", orderId).eq("status", "awaiting_payment").select("*").maybeSingle();
  if (!order) return;
  // Con ePayco en modo de pruebas el pago es ficticio: nunca se compra un dominio real.
  if (process.env.EPAYCO_TEST === "true") {
    await db.from("domain_orders").update({ status: "failed", error: "Modo de pruebas de ePayco: el dominio no se compra." }).eq("id", order.id);
    await event(db, order.project_id, "domain.failed", { domain: order.domain, message: "test_mode" });
    return;
  }
  try {
    if (!(await registrar.availability(order.domain))) throw new registrar.RegistrarError("unavailable", "El dominio ya no está disponible");
    const p = await registrar.price(order.domain);
    if (p.purchasePrice == null) throw new registrar.RegistrarError("no_price", "El registrador no da precio para este dominio");
    if (p.purchasePrice > Number(order.cost_usd) * 1.1) throw new registrar.RegistrarError("price_changed", `El precio subió de ${order.cost_usd} a ${p.purchasePrice} USD`);
    const { orderId: vercelOrder } = await registrar.buy(order.domain, order.contact as unknown as registrar.Contact, p.purchasePrice);
    await db.from("domain_orders").update({ vercel_order_id: vercelOrder }).eq("id", order.id);
    await event(db, order.project_id, "domain.purchasing", { domain: order.domain });
    await syncDomainOrder({ ...order, vercel_order_id: vercelOrder });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("domain_orders").update({ status: "failed", error: message }).eq("id", order.id);
    await event(db, order.project_id, "domain.failed", { domain: order.domain, message });
  }
}

/** Avanza un pedido en curso: cuando el registrador lo completa, conecta el dominio al sitio. */
export async function syncDomainOrder(order: DomainOrder) {
  const db = createAdminClient();
  try {
    if (order.status === "purchasing" && order.vercel_order_id) {
      const o = await registrar.getOrder(order.vercel_order_id);
      if (o.status === "failed") {
        const code = o.error?.code ?? o.domains?.[0]?.error?.code ?? "failed";
        await db.from("domain_orders").update({ status: "failed", error: code }).eq("id", order.id);
        await event(db, order.project_id, "domain.failed", { domain: order.domain, message: code });
        return "failed";
      }
      if (o.status !== "completed") return "purchasing";
      await db.from("domain_orders").update({ status: "configuring" }).eq("id", order.id);
      order = { ...order, status: "configuring" };
    }
    if (order.status === "configuring") {
      await registrar.attachToPlatform(order.domain);
      await db.from("published_sites").update({ custom_domain: order.domain, domain_status: "verified", domain_verification: { type: "registrar", provider: "vercel" } as Json }).eq("project_id", order.project_id);
      const expires = addYear(new Date()).toISOString();
      await db.from("domain_orders").update({ status: "active", expires_at: expires, error: null }).eq("id", order.id);
      await event(db, order.project_id, "domain.verified", { domain: order.domain });
      return "active";
    }
    return order.status;
  } catch (e) {
    await db.from("domain_orders").update({ error: e instanceof Error ? e.message : String(e) }).eq("id", order.id);
    return order.status;
  }
}
