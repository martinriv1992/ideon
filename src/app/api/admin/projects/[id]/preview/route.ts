import { getCurrentContext } from "@/features/organizations/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVersionFile, injectDataSdk, resolveImageMarkers, siteHeaders, withPreviewBadge } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Vista previa de cualquier versión para la revisión del administrador (datos de ejemplo, sin red). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCurrentContext();
  if (!ctx?.profile.is_platform_admin) return new Response("forbidden", { status: 403 });
  const v = new URL(req.url).searchParams.get("v");
  const db = createAdminClient();
  const { data: version } = v
    ? await db.from("project_versions").select("id").eq("id", v).eq("project_id", id).maybeSingle()
    : { data: null };
  if (!version) return new Response("Versión no encontrada", { status: 404 });
  const file = await getVersionFile(version.id);
  if (!file) return new Response("Archivo no encontrado", { status: 404 });
  const html = injectDataSdk(resolveImageMarkers(file.content), { mode: "demo", projectId: id });
  return new Response(withPreviewBadge(html, "Revisión · Ideonapp"), { headers: siteHeaders(file.content_type) });
}
