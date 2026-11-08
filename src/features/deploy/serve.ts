import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

import { safeFileName } from "@/lib/uploads";
import { usesIdeonData } from "@/features/appdata/core";
import fs from "node:fs/promises";
import path from "node:path";

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
 * Ideon Data: carga el SDK de datos antes de los scripts de la app (solo si la app lo usa).
 * live = app publicada (datos en la nube) · demo = vista previa · local = archivo descargado.
 */
export function injectDataSdk(html: string, opts: { mode: "live" | "demo" | "local"; projectId?: string; src?: string }) {
  if (!usesIdeonData(html)) return html;
  const tag = `<script src="${opts.src ?? "/ideon-data.js"}" data-ideon-data data-mode="${opts.mode}"${opts.projectId ? ` data-project="${opts.projectId}"` : ""}></script>`;
  const head = html.search(/<\/head>/i);
  const firstScript = html.search(/<script[\s>]/i);
  const at = firstScript >= 0 && (head < 0 || firstScript < head) ? firstScript : head;
  return at >= 0 ? html.slice(0, at) + tag + html.slice(at) : tag + html;
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
  // App con Ideon Data: el archivo descargado funciona sin servidor (datos en el navegador).
  if (usesIdeonData(html)) {
    const sdk = await fs.readFile(path.join(process.cwd(), "public", "ideon-data.js"));
    assets.push({ path: "ideon-data.js", data: new Uint8Array(sdk), contentType: "text/javascript" });
    html = injectDataSdk(html, { mode: "local", src: "ideon-data.js" });
  }
  return { html, assets };
}

export async function getVersionFile(versionId: string, path = "index.html") {
  const db = createAdminClient();
  const { data } = await db.from("project_files").select("content,content_type").eq("version_id", versionId).eq("path", path).maybeSingle();
  return data;
}

/**
 * Cabeceras de seguridad para contenido generado (aislado del panel).
 * connect-src solo se abre ('self') en apps publicadas que usan Ideon Data, nunca en la vista previa.
 */
export function siteHeaders(contentType: string, cacheSeconds = 0, opts: { connect?: "self" | "none" } = {}) {
  return {
    "Content-Type": contentType.startsWith("text/html") ? "text/html; charset=utf-8" : contentType,
    "Cache-Control": cacheSeconds ? `public, max-age=${cacheSeconds}` : "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline'; connect-src ${opts.connect === "self" ? "'self'" : "'none'"}; frame-ancestors 'self'; form-action 'self'`,
  };
}

export function siteBaseUrl() {
  return (process.env.NEXT_PUBLIC_SITE_BASE_URL || publicEnv.NEXT_PUBLIC_APP_URL).replace(/\/$/, "");
}

export function slugify(input: string, max = 40) {
  return input.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}
