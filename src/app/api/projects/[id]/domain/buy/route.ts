import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBilling, type PaymentMeta } from "@/features/billing/fulfil";
import { epaycoCheckout, epaycoConfigured } from "@/features/billing/epayco";
import { domainCostUsd, domainSalePrice, parseDomainQuery } from "@/features/billing/pricing";
import * as registrar from "@/features/domains/registrar";
import { domainContactSchema } from "@/features/domains/contact";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  domain: z.string().trim().min(3).max(253),
  contact: domainContactSchema,
  locale: z.enum(["es", "en"]).default("es"),
});

/**
 * Compra de un dominio para un proyecto ya activado (el cliente lo activó sin
 * dominio y lo quiere ahora). Se cobra el primer año y, desde entonces, el
 * dominio se suma a la renovación anual del plan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const { project, user } = access;
  if (!project.paid_at) return fail("invalid_state", "Primero activa el proyecto", 409);
  if (!epaycoConfigured()) return fail("not_configured", "Los pagos con ePayco no están configurados todavía.", 503);
  if (!registrar.registrarConfigured()) return fail("not_configured", "La compra de dominios no está configurada todavía.", 503);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Datos no válidos");
  const { contact, locale } = parsed.data;

  const db = createAdminClient();
  const { data: sub } = await db.from("subscriptions").select("id,domain").eq("project_id", id).eq("plan", "hosting_domain").maybeSingle();
  if (!sub) return fail("invalid_state", "El proyecto no tiene plan anual", 409);
  const { data: busy } = await db.from("domain_orders").select("id").eq("project_id", id).in("status", ["purchasing", "configuring", "active"]).limit(1).maybeSingle();
  if (sub.domain || busy) return fail("invalid_state", "Este proyecto ya tiene un dominio", 409);

  const s = await getBilling();
  const q = parseDomainQuery(parsed.data.domain);
  if (!q?.tld || !s.tlds.includes(q.tld)) return fail("invalid", "Extensión de dominio no disponible");
  const name = `${q.label}.${q.tld}`;
  let costUsd: number;
  try {
    const [available, p] = await Promise.all([registrar.availability(name), registrar.price(name)]);
    if (!available || p.purchasePrice == null) return fail("unavailable", `${name} no está disponible`, 409);
    costUsd = domainCostUsd(p);
  } catch (e) {
    return fail("registrar", e instanceof Error ? e.message : "No se pudo consultar el dominio", 502);
  }
  const price = domainSalePrice(costUsd, s);

  await db.from("payments").update({ status: "failed" }).eq("project_id", id).eq("status", "pending").eq("provider", "epayco");
  await db.from("domain_orders").update({ status: "cancelled" }).eq("project_id", id).eq("status", "awaiting_payment");

  const label = locale === "es" ? `Dominio ${name} (1 año)` : `Domain ${name} (1 year)`;
  const { data: payment, error } = await db.from("payments").insert({
    organization_id: project.organization_id, project_id: id, provider: "epayco", amount: price, currency: s.currency, status: "pending", metadata: {} as Json,
  }).select("id").single();
  if (error || !payment) return fail("db", error?.message ?? "No se pudo crear el pago", 500);
  const { data: order, error: oe } = await db.from("domain_orders").insert({
    organization_id: project.organization_id, project_id: id, payment_id: payment.id, domain: name, cost_usd: costUsd, contact: contact as unknown as Json,
  }).select("id").single();
  if (oe || !order) return fail("db", oe?.message ?? "No se pudo reservar el dominio", 500);

  const meta: PaymentMeta = { type: "domain", user_id: user.id, items: [{ key: "domain", label, amount: price }], renewal: price, domain: name, domain_order_id: order.id, subscription_id: sub.id };
  await db.from("payments").update({ metadata: meta as unknown as Json }).eq("id", payment.id);

  return json({
    price, currency: s.currency, domain: name,
    checkout: epaycoCheckout({
      paymentId: payment.id, projectId: id, locale, amount: price, currency: s.currency,
      name: `Ideon · ${project.name}`, description: label, email: contact.email, buyerName: `${contact.firstName} ${contact.lastName}`,
      phone: contact.phone, address: `${contact.address1}, ${contact.city}`,
    }),
  });
}
