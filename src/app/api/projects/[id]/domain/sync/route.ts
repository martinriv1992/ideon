import { requireProjectAccess, json } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDomainOrder } from "@/features/billing/fulfil";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Avanza el pedido de dominio en curso (lo consulta la interfaz mientras se compra). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const db = createAdminClient();
  const { data: order } = await db.from("domain_orders").select("*").eq("project_id", id).in("status", ["purchasing", "configuring"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!order) return json({ status: null });
  return json({ status: await syncDomainOrder(order), domain: order.domain });
}
