"use client";

import { createClient } from "@/lib/supabase/client";
import { MAX_UPLOAD_BYTES, classifyUpload, labelFromName, type UploadKind } from "@/lib/uploads";

/**
 * Subida desde el navegador en tres pasos: el servidor valida y firma la subida,
 * el archivo va directo a Supabase Storage y el servidor la verifica y registra.
 */

export class UploadError extends Error {}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new UploadError(data?.error?.message || "No se pudo subir el archivo");
  return data as T;
}

/** Redimensiona fotos grandes (máx. 1600 px). JPEG sigue en JPEG; PNG/WebP pasan a WebP para conservar la transparencia. SVG y GIF no se tocan. */
export async function prepareImage(file: File): Promise<{ blob: Blob; type: string; name: string; width: number | null; height: number | null }> {
  if (file.type === "image/svg+xml") return { blob: file, type: file.type, name: file.name, width: null, height: null };
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new UploadError("No se pudo leer la imagen")); i.src = url;
    });
    if (file.type === "image/gif") return { blob: file, type: file.type, name: file.name, width: im.naturalWidth, height: im.naturalHeight };
    const max = 1600; const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
    const c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d")!.drawImage(im, 0, 0, w, h);
    const keepAlpha = file.type === "image/png" || file.type === "image/webp";
    const type = keepAlpha ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new UploadError("No se pudo procesar la imagen"))), type, 0.85));
    // Si el navegador no sabe codificar WebP devuelve PNG: se respeta el tipo real.
    return { blob, type: blob.type || type, name: file.name, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface UploadOptions { label?: string; useReference?: boolean; useSite?: boolean }

/** Sube una imagen o un archivo al proyecto y devuelve la fila creada. */
export async function uploadToProject<T = unknown>(projectId: string, file: File, opts: UploadOptions = {}): Promise<{ kind: UploadKind; row: T }> {
  const kind = classifyUpload(file);
  if (!kind) throw new UploadError(`Tipo de archivo no admitido: ${file.name}`);
  let blob: Blob = file; let type = file.type; let width: number | null = null; let height: number | null = null;
  if (kind === "image") ({ blob, type, width, height } = await prepareImage(file));
  if (blob.size > MAX_UPLOAD_BYTES) throw new UploadError(`«${file.name}» supera los 10 MB`);

  const signed = await post<{ uploadId: string; bucket: string; path: string; token: string }>(
    `/api/projects/${projectId}/uploads`, { kind, name: file.name, type, size: blob.size });
  const { error } = await createClient().storage.from(signed.bucket).uploadToSignedUrl(signed.path, signed.token, blob, { contentType: type || "application/octet-stream" });
  if (error) throw new UploadError(error.message || "Falló la subida a Storage");
  const row = await post<T>(`/api/projects/${projectId}/uploads/complete`, {
    kind, uploadId: signed.uploadId, path: signed.path, name: file.name, label: opts.label ?? labelFromName(file.name),
    width, height, useReference: opts.useReference, useSite: opts.useSite,
  });
  return { kind, row };
}
