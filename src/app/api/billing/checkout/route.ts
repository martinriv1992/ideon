import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { json, fail } from "@/lib/api";
import { getStripe, stripeConfigured } from "@/features/billing/stripe";
import { publicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Crea una sesión de Stripe Checkout para pagar una propuesta aprobada. */
export async function POST(req: Request) {
  const body = z.object({ proposalId: z.string().uuid(), locale: z.enum(["es", "en"]).default("es") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  if (!stripeConfigured()) return fail("not_configured", "Pagos con tarjeta no configurados todavía.", 503);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("unauthenticated", "Inicia sesión", 401);
  const { data: proposal } = await supabase.from("proposals").select("*, projects!inner(id, name, organization_id)").eq("id", body.data.proposalId).maybeSingle();
  if (!proposal) return fail("not_found", "Propuesta no encontrada", 404);
  if (proposal.price == null) return fail("invalid_state", "La propuesta no tiene precio fijado", 409);
  const project = proposal.projects as unknown as { id: string; name: string; organization_id: string };

  const admin = createAdminClient();
  const { data: payment } = await admin.from("payments").insert({ organization_id: project.organization_id, project_id: project.id, proposal_id: proposal.id, provider: "stripe", amount: Number(proposal.price), currency: proposal.currency, status: "pending" }).select("*").single();
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: proposal.currency.toLowerCase(), unit_amount: Math.round(Number(proposal.price) * 100), product_data: { name: proposal.title, description: proposal.summary ?? undefined } } }],
    metadata: { payment_id: payment!.id, project_id: project.id, proposal_id: proposal.id },
    success_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/${body.data.locale}/projects/${project.id}?paid=1`,
    cancel_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/${body.data.locale}/projects/${project.id}`,
    customer_email: user.email ?? undefined,
  });
  await admin.from("payments").update({ external_id: session.id }).eq("id", payment!.id);
  return json({ url: session.url });
}
