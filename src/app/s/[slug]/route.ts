import { createAdminClient } from "@/lib/supabase/admin";
import { getVersionFile, resolveImageMarkers, siteHeaders } from "@/features/deploy/serve";
import { billingFromSettings, subscriptionState } from "@/features/billing/pricing";

const page = (title: string, text: string, status: number) => new Response(
  `<!doctype html><html lang=es><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title><body style="font-family:system-ui;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center"><div><h1 style="font-size:20px">${title}</h1><p style="color:#666;max-width:420px">${text}</p></div></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

export const dynamic = "force-dynamic";

/** Sitio publicado en Ideon: público, sirve la versión publicada del proyecto. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const { data: site } = await db.from("published_sites").select("version_id,project_id").eq("slug", slug.toLowerCase()).maybeSingle();
  if (!site) return page("No encontrado", "Este sitio no existe o no está publicado.", 404);
  // Paquete anual vencido y fuera del periodo de gracia → sitio suspendido.
  const { data: sub } = await db.from("subscriptions").select("current_period_end").eq("project_id", site.project_id).eq("plan", "hosting_domain").maybeSingle();
  if (sub) {
    const { data: rows } = await db.from("platform_settings").select("key,value").in("key", ["renewal_grace_days"]);
    if (subscriptionState(sub.current_period_end, billingFromSettings(rows ?? []).graceDays) === "suspended")
      return page("Sitio suspendido temporalmente", "El plan de hosting de este sitio está pendiente de renovación.", 402);
  }
  const file = await getVersionFile(site.version_id);
  if (!file) return new Response("Sin contenido", { status: 404 });
  return new Response(resolveImageMarkers(file.content), { headers: siteHeaders(file.content_type, 60) });
}
