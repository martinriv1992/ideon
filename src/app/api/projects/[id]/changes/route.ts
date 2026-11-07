import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { epaycoCheckout, epaycoConfigured } from "@/features/billing/epayco";
import { getBilling, type PaymentMeta } from "@/features/billing/fulfil";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

/** Compra de un paquete de cambios adicionales (proyecto activado). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const body = z.object({ pack: z.number().int().min(0).max(20), locale: z.enum(["es", "en"]).default("es") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  if (!access.project.paid_at) return fail("invalid_state", "Primero activa el proyecto", 409);
  if (!epaycoConfigured()) return fail("not_configured", "Los pagos con ePayco no están configurados todavía.", 503);
  const s = await getBilling();
  const pack = s.changePacks[body.data.pack];
  if (!pack) return fail("invalid", "Paquete no disponible");

  const db = createAdminClient();
  const { data: sub } = await db.from("subscriptions").select("id").eq("project_id", id).eq("plan", "hosting_domain").maybeSingle();
  if (!sub) return fail("invalid_state", "El proyecto no tiene plan anual", 409);
  await db.from("payments").update({ status: "failed" }).eq("project_id", id).eq("status", "pending").eq("provider", "epayco");
  const es = body.data.locale === "es";
  const label = es ? `Paquete de ${pack.qty} cambios` : `${pack.qty}-change pack`;
  const meta: PaymentMeta = { type: "changes", user_id: access.user.id, items: [{ key: "changes", label, amount: pack.price }], renewal: 0, domain: null, domain_order_id: null, subscription_id: sub.id, pack_qty: pack.qty };
  const { data: payment, error } = await db.from("payments").insert({
    organization_id: access.project.organization_id, project_id: id, provider: "epayco", amount: pack.price, currency: s.currency, status: "pending", metadata: meta as unknown as Json,
  }).select("id").single();
  if (error || !payment) return fail("db", error?.message ?? "No se pudo crear el pago", 500);
  return json({
    checkout: epaycoCheckout({
      paymentId: payment.id, projectId: id, locale: body.data.locale, amount: pack.price, currency: s.currency,
      name: `Ideon · ${access.project.name}`, description: label, email: access.user.email,
    }),
  });
}
