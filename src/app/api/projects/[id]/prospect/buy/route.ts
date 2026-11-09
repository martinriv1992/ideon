import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { epaycoCheckout, epaycoConfigured } from "@/features/billing/epayco";
import { getBilling, type PaymentMeta } from "@/features/billing/fulfil";
import { prospectBalance } from "@/features/appdata/server";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

/** Compra de prospección con IA: plan prepago (búsquedas por N días) o búsquedas sueltas. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const body = z.object({ kind: z.enum(["plan", "single"]), qty: z.number().int().min(1).max(50).default(1), locale: z.enum(["es", "en"]).default("es") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  if (!access.project.paid_at) return fail("invalid_state", "Primero activa el proyecto", 409);
  if (!epaycoConfigured()) return fail("not_configured", "Los pagos con ePayco no están configurados todavía.", 503);
  const { pricing } = await prospectBalance(id);
  const s = await getBilling();
  const es = body.data.locale === "es";
  const plan = body.data.kind === "plan";
  const qty = plan ? pricing.planSearches : body.data.qty;
  const amount = plan ? pricing.planPrice : pricing.singlePrice * qty;
  const label = plan
    ? (es ? `Prospección con IA: plan ${pricing.planSearches} búsquedas (${pricing.planDays} días)` : `AI prospecting: ${pricing.planSearches}-search plan (${pricing.planDays} days)`)
    : (es ? `Prospección con IA: ${qty} ${qty === 1 ? "búsqueda" : "búsquedas"}` : `AI prospecting: ${qty} ${qty === 1 ? "search" : "searches"}`);
  const db = createAdminClient();
  await db.from("payments").update({ status: "failed" }).eq("project_id", id).eq("status", "pending").eq("provider", "epayco");
  const meta: PaymentMeta = { type: plan ? "prospect_plan" : "prospect_credits", user_id: access.user.id, items: [{ key: "prospect", label, amount }], renewal: 0, domain: null, domain_order_id: null, pack_qty: qty };
  const { data: payment, error } = await db.from("payments").insert({
    organization_id: access.project.organization_id, project_id: id, provider: "epayco", amount, currency: s.currency, status: "pending", metadata: meta as unknown as Json,
  }).select("id").single();
  if (error || !payment) return fail("db", error?.message ?? "No se pudo crear el pago", 500);
  return json({
    checkout: epaycoCheckout({ paymentId: payment.id, projectId: id, locale: body.data.locale, amount, currency: s.currency, name: `Ideon · ${access.project.name}`, description: label, email: access.user.email }),
  });
}
