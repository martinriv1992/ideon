import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBilling, type PaymentMeta } from "@/features/billing/fulfil";
import { epaycoCheckout, epaycoConfigured } from "@/features/billing/epayco";
import { domainCostUsd, domainSalePrice, launchQuote, parseDomainQuery } from "@/features/billing/pricing";
import * as registrar from "@/features/domains/registrar";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

const contactSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(120),
  phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "Teléfono en formato internacional, p. ej. +573001234567"),
  address1: z.string().trim().min(3).max(120),
  city: z.string().trim().min(1).max(60),
  state: z.string().trim().min(1).max(60),
  zip: z.string().trim().min(1).max(20),
  country: z.string().trim().length(2).transform((c) => c.toUpperCase()),
  companyName: z.string().trim().max(100).optional().transform((v) => v || undefined),
});

const bodySchema = z.object({
  domain: z.string().trim().max(253).nullable().optional(),
  contact: contactSchema.optional(),
  locale: z.enum(["es", "en"]).default("es"),
});

async function developmentFor(projectId: string) {
  const db = createAdminClient();
  const { data: proposal } = await db.from("proposals").select("*").eq("project_id", projectId).in("status", ["approved", "sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return proposal;
}

/** Resumen de lo que se pagará al activar el proyecto (sin dominio). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const s = await getBilling();
  const proposal = await developmentFor(id);
  const dev = proposal?.price != null ? { title: proposal.title, price: Number(proposal.price), currency: proposal.currency } : null;
  return json({
    quote: launchQuote({ development: dev, domain: null }, s, "es"),
    pendingPrice: !dev,
    paid: Boolean(access.project.paid_at),
    freeChanges: s.freeChanges,
    freeChangesUsed: access.project.free_changes_used,
    paymentsConfigured: epaycoConfigured(),
    domainsConfigured: registrar.registrarConfigured(),
  });
}

/** Prepara el pago del lanzamiento (desarrollo + primer año de hosting y dominio) y devuelve los datos del checkout de ePayco. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const { project, user } = access;
  if (project.paid_at) return fail("invalid_state", "Este proyecto ya está activado", 409);
  if (!project.current_version_id) return fail("invalid_state", "Primero genera la vista previa del proyecto", 409);
  if (!epaycoConfigured()) return fail("not_configured", "Los pagos con ePayco no están configurados todavía.", 503);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", parsed.error.issues[0]?.message ?? "Datos no válidos");
  const { contact, locale } = parsed.data;

  const s = await getBilling();
  const proposal = await developmentFor(id);
  if (!proposal || proposal.price == null) return fail("pending_price", "La propuesta aún no tiene precio. Te lo confirmaremos antes de activar el proyecto.", 409);

  let domain: { name: string; salePrice: number; costUsd: number } | null = null;
  if (parsed.data.domain) {
    const q = parseDomainQuery(parsed.data.domain);
    if (!q?.tld || !s.tlds.includes(q.tld)) return fail("invalid", "Extensión de dominio no disponible");
    if (!contact) return fail("invalid", "Faltan los datos del titular del dominio");
    const name = `${q.label}.${q.tld}`;
    try {
      const [available, p] = await Promise.all([registrar.availability(name), registrar.price(name)]);
      if (!available || p.purchasePrice == null) return fail("unavailable", `${name} no está disponible`, 409);
      const costUsd = domainCostUsd(p);
      domain = { name, costUsd, salePrice: domainSalePrice(costUsd, s) };
    } catch (e) {
      return fail("registrar", e instanceof Error ? e.message : "No se pudo consultar el dominio", 502);
    }
  }

  const quote = launchQuote({ development: { title: proposal.title, price: Number(proposal.price), currency: proposal.currency }, domain }, s, locale);
  const db = createAdminClient();

  // Pagos y pedidos anteriores sin completar de este proyecto quedan anulados.
  await db.from("payments").update({ status: "failed" }).eq("project_id", id).eq("status", "pending").eq("provider", "epayco");
  await db.from("domain_orders").update({ status: "cancelled" }).eq("project_id", id).eq("status", "awaiting_payment");

  const { data: payment, error } = await db.from("payments").insert({
    organization_id: project.organization_id, project_id: id, proposal_id: proposal.id, provider: "epayco",
    amount: quote.total, currency: quote.currency, status: "pending", metadata: {} as Json,
  }).select("*").single();
  if (error || !payment) return fail("db", error?.message ?? "No se pudo crear el pago", 500);

  let domainOrderId: string | null = null;
  if (domain && contact) {
    const { data: order, error: oe } = await db.from("domain_orders").insert({
      organization_id: project.organization_id, project_id: id, payment_id: payment.id, domain: domain.name, cost_usd: domain.costUsd, contact: contact as unknown as Json,
    }).select("id").single();
    if (oe || !order) return fail("db", oe?.message ?? "No se pudo reservar el dominio", 500);
    domainOrderId = order.id;
  }
  const meta: PaymentMeta = { type: "launch", user_id: user.id, items: quote.items, renewal: quote.renewal, domain: domain?.name ?? null, domain_order_id: domainOrderId };
  await db.from("payments").update({ metadata: meta as unknown as Json }).eq("id", payment.id);

  const checkout = epaycoCheckout({
    paymentId: payment.id, projectId: id, locale, amount: quote.total, currency: quote.currency,
    name: `Ideon · ${project.name}`, description: quote.items.map((i) => i.label).join(" + "),
    email: contact?.email ?? user.email, buyerName: contact ? `${contact.firstName} ${contact.lastName}` : null,
  });
  return json({ quote, checkout });
}
