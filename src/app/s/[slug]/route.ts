import { createAdminClient } from "@/lib/supabase/admin";
import { getVersionFile, resolveImageMarkers, siteHeaders } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Sitio publicado en Ideon: público, sirve la versión publicada del proyecto. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = createAdminClient();
  const { data: site } = await db.from("published_sites").select("version_id").eq("slug", slug.toLowerCase()).maybeSingle();
  if (!site) return new Response("<!doctype html><meta charset=utf-8><title>No encontrado</title><p style='font-family:system-ui;padding:40px'>Este sitio no existe o no está publicado.</p>", { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const file = await getVersionFile(site.version_id);
  if (!file) return new Response("Sin contenido", { status: 404 });
  return new Response(resolveImageMarkers(file.content), { headers: siteHeaders(file.content_type, 60) });
}
