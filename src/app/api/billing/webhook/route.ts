import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, invoiceNumber, stripeConfigured } from "@/features/billing/stripe";

export const dynamic = "force-dynamic";

/** Webhook de Stripe: marca pagos como pagados y emite la factura interna. */
export async function POST(req: Request) {
  if (!stripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) return new Response("not configured", { status: 503 });
  const sig = (await headers()).get("stripe-signature") ?? "";
  const raw = await req.text();
  let event;
  try { event = getStripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (e) { return new Response(`Webhook error: ${e instanceof Error ? e.message : "invalid"}`, { status: 400 }); }

  const db = createAdminClient();
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const paymentId = s.metadata?.payment_id;
    if (paymentId) {
      const { data: payment } = await db.from("payments").update({ status: "paid", paid_at: new Date().toISOString(), metadata: { session: s.id, payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null } }).eq("id", paymentId).select("*").single();
      if (payment) {
        await db.from("invoices").insert({ organization_id: payment.organization_id, payment_id: payment.id, number: invoiceNumber(), amount: payment.amount, currency: payment.currency });
        if (payment.project_id) await db.from("project_events").insert({ project_id: payment.project_id, actor_type: "system", type: "payment.received", payload: { amount: payment.amount, currency: payment.currency } });
      }
    }
  }
  if (event.type === "checkout.session.expired") {
    const s = event.data.object; const paymentId = s.metadata?.payment_id;
    if (paymentId) await db.from("payments").update({ status: "failed" }).eq("id", paymentId).eq("status", "pending");
  }
  return new Response("ok");
}
