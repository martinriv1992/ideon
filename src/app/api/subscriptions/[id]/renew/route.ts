import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { json, fail } from "@/lib/api";
import { epaycoCheckout, epaycoConfigured } from "@/features/billing/epayco";
import type { PaymentMeta } from "@/features/billing/fulfil";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

/** Prepara el pago de la renovación anual (hosting + dominio) de un paquete. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z.object({ locale: z.enum(["es", "en"]).default("es") }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  if (!epaycoConfigured()) return fail("not_configured", "Los pagos con ePayco no están configurados todavía.", 503);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated", "Inicia sesión", 401);
  // RLS: solo los miembros (admin) de la organización ven la suscripción.
  const { data: sub } = await supabase.from("subscriptions").select("*").eq("id", id).maybeSingle();
  if (!sub || !sub.project_id || sub.plan !== "hosting_domain") return fail("not_found", "Suscripción no encontrada", 404);
  const amount = Number(sub.renewal_amount ?? sub.amount);
  const { data: project } = await supabase.from("projects").select("name").eq("id", sub.project_id).single();

  const db = createAdminClient();
  await db.from("payments").update({ status: "failed" }).eq("project_id", sub.project_id).eq("status", "pending").eq("provider", "epayco");
  const es = body.data.locale === "es";
  const items = [{ key: "hosting", label: es ? "Renovación anual: hosting y mantenimiento" : "Annual renewal: hosting and upkeep", amount }];
  const meta: PaymentMeta = { type: "renewal", user_id: user.id, items, renewal: amount, domain: sub.domain, domain_order_id: null, subscription_id: sub.id };
  const { data: payment, error } = await db.from("payments").insert({
    organization_id: sub.organization_id, project_id: sub.project_id, provider: "epayco", amount, currency: sub.currency, status: "pending", metadata: meta as unknown as Json,
  }).select("*").single();
  if (error || !payment) return fail("db", error?.message ?? "No se pudo crear el pago", 500);
  return json({
    amount, currency: sub.currency,
    checkout: epaycoCheckout({
      paymentId: payment.id, projectId: sub.project_id, locale: body.data.locale, amount, currency: sub.currency,
      name: `Ideon · ${project?.name ?? ""}`, description: items[0].label + (sub.domain ? ` + ${sub.domain}` : ""), email: user.email,
      returnPath: "/subscriptions?payment=return",
    }),
  });
}
