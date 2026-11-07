import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Servicio de archivos de una versión: resuelve los marcadores de imagen
 * {{IMG:id}} a la ruta pública de streaming y devuelve el contenido listo para servir.
 */
export function resolveImageMarkers(html: string, base = "") {
  return html.replace(/\{\{IMG:([a-z0-9-]+)\}\}/gi, (_m, id) => `${base}/api/images/${id}`);
}

export async function getVersionFile(versionId: string, path = "index.html") {
  const db = createAdminClient();
  const { data } = await db.from("project_files").select("content,content_type").eq("version_id", versionId).eq("path", path).maybeSingle();
  return data;
}

/** Cabeceras de seguridad para contenido generado (aislado del panel). */
export function siteHeaders(contentType: string, cacheSeconds = 0) {
  return {
    "Content-Type": contentType.startsWith("text/html") ? "text/html; charset=utf-8" : contentType,
    "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src 'none'; frame-ancestors 'self'; form-action 'self'",
  };
}

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_BASE_URL || publicEnv.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
}

export function slugify(input: string, max = 40) {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}
