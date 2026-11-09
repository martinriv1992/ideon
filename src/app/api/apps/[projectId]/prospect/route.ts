import { createAdminClient } from "@/lib/supabase/admin";
import { nextPool, prospectRequestSchema, remainingSearches } from "@/features/appdata/core";
import { prospectBalance } from "@/features/appdata/server";
import { prospect } from "@/features/appdata/prospect";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Prospección con IA desde el CRM del cliente (usuarios con sesión).
 * Cada búsqueda sale de una bolsa: prueba gratis → plan prepago vigente → búsquedas sueltas
 * (las compra el dueño del proyecto en Ideonapp, pestaña Publicar).
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const body = prospectRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("invalid_query", 400);
  if (!process.env.ANTHROPIC_API_KEY) return appFail("not_configured", 503);

  const db = createAdminClient();
  const { balance } = await prospectBalance(projectId);
  const pool = nextPool(balance);
  if (!pool) return appJson({ error: { code: "no_searches" } }, 402);
  const { data: slot } = await db.from("rate_limits").insert({ bucket: `prospect:${pool}`, ip_hash: projectId }).select("id").single();

  const { data: project } = await db.from("projects").select("organization_id,locale").eq("id", projectId).single();
  try {
    const r = await prospect({ ...body.data, locale: project?.locale ?? "es" });
    if (project) await db.from("ai_usage").insert({ organization_id: project.organization_id, project_id: projectId, provider: "anthropic", model: r.model, cost_usd: Number(r.costUsd.toFixed(6)) });
    return appJson({ results: r.results, remaining: Math.max(0, remainingSearches(balance) - 1) });
  } catch (e) {
    console.error("prospect failed", projectId, e instanceof Error ? e.message : e);
    // Una búsqueda fallida no consume cupo.
    if (slot) await db.from("rate_limits").delete().eq("id", slot.id);
    return appFail((e as { code?: string }).code === "refusal" ? "refused" : "search_failed", 502);
  }
}
