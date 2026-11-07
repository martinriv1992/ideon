import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

import { safeFileName } from "@/lib/uploads";

/**
 * Servicio de archivos de una versión: resuelve los marcadores {{IMG:id}} y
 * {{FILE:id}} a las rutas públicas de streaming y devuelve el contenido listo para servir.
 */
export function resolveImageMarkers(html: string, base = "") {
  return html
    .replace(/\{\{IMG:([a-z0-9-]+)\}\}/gi, (_m, id) => `${base}/api/images/${id}`)
    .replace(/\{\{FILE:([a-z0-9-]+)\}\}/gi, (_m, id) => `${base}/api/files/${id}`);
}

/** Marca «Vista previa» que se añade a la vista previa mientras el proyecto no está activado. */
export function withPreviewBadge(html: string, label = "Vista previa · Ideon") {
  const badge = `<div style="position:fixed;z-index:2147483647;right:12px;bottom:12px;padding:6px 12px;border-radius:999px;background:rgba(17,17,20,.86);color:#fff;font:600 12px/1.4 system-ui,sans-serif;letter-spacing:.02em;box-shadow:0 4px 18px rgba(0,0,0,.25);pointer-events:none">${label}</div>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, `${badge}</body>`) : html + badge;
}

/**
 * Para exportar el sitio como archivos estáticos (ZIP o Vercel): descarga las
 * imágenes y archivos referenciados, los coloca en images/ y files/ y reescribe
 * los marcadores a rutas relativas. Los marcadores sin archivo se eliminan.
 */
export async function bundleStaticAssets(projectId: string, html: string) {
  const db = createAdminClient();
  const assets: { path: string; data: Uint8Array; contentType: string }[] = [];
  const { data: images } = await db.from("project_images").select("id,storage_path").eq("project_id", projectId);
  for (const img of images ?? []) {
    if (!html.includes(`{{IMG:${img.id}}}`)) continue;
    const { data: blob } = await db.storage.from("project-images").download(img.storage_path);
    if (!blob) continue;
    const ext = img.storage_path.split(".").pop() || "jpg";
    const path = `images/${img.id}.${ext}`;
    assets.push({ path, data: new Uint8Array(await blob.arrayBuffer()), contentType: blob.type || "application/octet-stream" });
    html = html.split(`{{IMG:${img.id}}}`).join(path);
  }
  const { data: files } = await db.from("project_assets").select("id,storage_path,name,mime").eq("project_id", projectId).eq("use_site", true);
  for (const f of files ?? []) {
    if (!html.includes(`{{FILE:${f.id}}}`)) continue;
    const { data: blob } = await db.storage.from("project-files").download(f.storage_path);
    if (!blob) continue;
    const path = `files/${f.id.slice(0, 8)}-${safeFileName(f.name)}`;
    assets.push({ path, data: new Uint8Array(await blob.arrayBuffer()), contentType: f.mime });
    html = html.split(`{{FILE:${f.id}}}`).join(path);
  }
  html = html.replace(/\{\{(?:IMG|FILE):[a-z0-9-]+\}\}/gi, "");
  return { html, assets };
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
