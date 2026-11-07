/**
 * Reglas de subida compartidas por cliente y servidor (módulo puro).
 * Imágenes → tabla project_images (bucket project-images).
 * Archivos → tabla project_assets (bucket project-files): documentos que lee la IA
 * y/o archivos que se publican en el sitio.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_IMAGES = 30;
export const MAX_ASSETS = 20;

export type UploadKind = "image" | "asset";

/** Imágenes admitidas. Las rasterizadas se redimensionan en el navegador; SVG y GIF se suben tal cual. */
export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

interface AssetType { ext: string; mime: string; reference: boolean; site: boolean; defaultSite: boolean }

/** Archivos admitidos: si la IA puede leerlos (reference) y si pueden publicarse en el sitio (site). */
export const ASSET_TYPES: AssetType[] = [
  { ext: "pdf", mime: "application/pdf", reference: true, site: true, defaultSite: false },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", reference: true, site: true, defaultSite: false },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", reference: true, site: true, defaultSite: false },
  { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", reference: true, site: true, defaultSite: false },
  { ext: "txt", mime: "text/plain", reference: true, site: true, defaultSite: false },
  { ext: "md", mime: "text/markdown", reference: true, site: false, defaultSite: false },
  { ext: "csv", mime: "text/csv", reference: true, site: true, defaultSite: false },
  { ext: "json", mime: "application/json", reference: true, site: false, defaultSite: false },
  { ext: "zip", mime: "application/zip", reference: false, site: true, defaultSite: true },
  { ext: "svg", mime: "image/svg+xml", reference: false, site: true, defaultSite: true },
  { ext: "ico", mime: "image/x-icon", reference: false, site: true, defaultSite: true },
  { ext: "mp3", mime: "audio/mpeg", reference: false, site: true, defaultSite: true },
];

export const ASSET_ACCEPT = ASSET_TYPES.map((t) => `.${t.ext}`).join(",");
export const IMAGE_ACCEPT = Object.keys(IMAGE_TYPES).join(",");

export function extOf(name: string) {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return m ? m[1].toLowerCase() : "";
}

/** Tipo de archivo por extensión (el MIME del navegador no es fiable para docx/csv/md). */
export function assetTypeFor(name: string): AssetType | null {
  const ext = extOf(name);
  return ASSET_TYPES.find((t) => t.ext === ext) ?? null;
}

/** Decide si un archivo elegido por el usuario es imagen o archivo. */
export function classifyUpload(file: { name: string; type: string }): UploadKind | null {
  if (IMAGE_TYPES[file.type]) return "image";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(extOf(file.name))) return "image";
  return assetTypeFor(file.name) ? "asset" : null;
}

/** Nombre legible a partir del nombre de archivo: «carta_2025-v2.pdf» → «carta 2025 v2». */
export function labelFromName(name: string, max = 80) {
  return name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "archivo";
}

/** Nombre seguro para publicar el archivo como ruta estática. */
export function safeFileName(name: string) {
  const ext = extOf(name);
  const base = name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "archivo";
  return ext ? `${base}.${ext}` : base;
}

/** Estimación de tokens del texto (≈ 4 caracteres por token en español/inglés). */
export function estimateTokens(chars: number) {
  return Math.ceil(chars / 4);
}
