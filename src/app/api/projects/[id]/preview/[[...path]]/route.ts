import { requireProjectAccess, fail } from "@/lib/api";
import { getVersionFile, resolveImageMarkers, siteHeaders } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Vista previa privada de una versión (por defecto la actual; ?v=<id> para otra). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const url = new URL(req.url);
  const versionId = url.searchParams.get("v") || access.project.current_version_id;
  if (!versionId) return fail("not_found", "Sin versión", 404);
  // Comprobar que la versión pertenece al proyecto (RLS vía cliente de usuario)
  const { data: version } = await access.supabase.from("project_versions").select("id").eq("id", versionId).eq("project_id", id).maybeSingle();
  if (!version) return fail("not_found", "Versión no encontrada", 404);
  const file = await getVersionFile(versionId, (path ?? []).join("/") || "index.html");
  if (!file) return fail("not_found", "Archivo no encontrado", 404);
  return new Response(file.content_type.startsWith("text/html") ? resolveImageMarkers(file.content) : file.content, { headers: siteHeaders(file.content_type) });
}
