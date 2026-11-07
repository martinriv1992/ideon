import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractText } from "@/features/assets/extract";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, assetTypeFor, extOf, labelFromName } from "@/lib/uploads";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // extracción de texto de PDFs grandes

const body = z.object({
  kind: z.enum(["image", "asset"]),
  uploadId: z.string().uuid(),
  path: z.string().max(200),
  name: z.string().trim().min(1).max(200),
  label: z.string().trim().max(80).optional(),
  width: z.number().int().positive().max(20000).nullable().optional(),
  height: z.number().int().positive().max(20000).nullable().optional(),
  useReference: z.boolean().optional(),
  useSite: z.boolean().optional(),
});

/** Comprueba la firma real del archivo: el tipo declarado por el navegador no es fiable. */
function sniff(ext: string, b: Uint8Array): boolean {
  const head = (n: number) => Array.from(b.slice(0, n));
  const ascii = (s: string, at = 0) => s.split("").every((c, i) => b[at + i] === c.charCodeAt(0));
  switch (ext) {
    case "jpg": return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "png": return head(4).join() === [0x89, 0x50, 0x4e, 0x47].join();
    case "gif": return ascii("GIF8");
    case "webp": return ascii("RIFF") && ascii("WEBP", 8);
    case "pdf": return ascii("%PDF");
    case "docx": case "xlsx": case "pptx": case "zip": return b[0] === 0x50 && b[1] === 0x4b;
    case "ico": return head(4).join() === [0, 0, 1, 0].join();
    case "mp3": return ascii("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
    case "svg": { const t = new TextDecoder().decode(b.slice(0, 2048)).toLowerCase(); return t.includes("<svg"); }
    default: return !b.slice(0, 4096).includes(0); // texto: sin bytes nulos
  }
}

/**
 * Paso 2 de una subida: verifica el objeto ya subido a Storage (tamaño y tipo
 * real), extrae el texto de los documentos y registra la fila.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", "Parámetros no válidos");
  const p = parsed.data;
  const ext = extOf(p.path);
  if (p.path !== `${id}/${p.uploadId}.${ext}`) return fail("invalid", "Ruta no válida");

  const bucket = p.kind === "image" ? "project-images" : "project-files";
  const db = createAdminClient();
  const discard = async (code: string, msg: string) => { await db.storage.from(bucket).remove([p.path]); return fail(code, msg); };

  const { data: blob, error: dlErr } = await db.storage.from(bucket).download(p.path);
  if (dlErr || !blob) return fail("not_found", "No se encontró el archivo subido", 404);
  if (blob.size > MAX_UPLOAD_BYTES) return discard("too_large", "Máximo 10 MB por archivo");
  const data = await blob.arrayBuffer();
  if (!sniff(ext, new Uint8Array(data))) return discard("invalid", "El contenido del archivo no coincide con su tipo");

  const label = (p.label || labelFromName(p.name)).slice(0, 80);

  if (p.kind === "image") {
    if (!Object.values(IMAGE_TYPES).includes(ext)) return discard("invalid", "Formato de imagen no admitido");
    const { data: row, error } = await db.from("project_images").insert({
      id: p.uploadId, project_id: id, label, storage_path: p.path, width: p.width ?? null, height: p.height ?? null, size: blob.size, created_by: access.user.id,
    }).select("*").single();
    if (error) return discard("db", error.message);
    await db.from("project_events").insert({ project_id: id, actor_id: access.user.id, actor_type: "user", type: "image.uploaded", payload: { label } });
    return json(row);
  }

  const type = assetTypeFor(p.name);
  if (!type || type.ext !== ext) return discard("invalid", "Tipo de archivo no admitido");
  const extracted = type.reference ? await extractText(ext, data) : { status: "unsupported" as const, text: null };
  const { data: row, error } = await db.from("project_assets").insert({
    id: p.uploadId, project_id: id, name: p.name.slice(0, 200), label, storage_path: p.path, mime: type.mime, size: blob.size,
    use_reference: type.reference && (p.useReference ?? true) && extracted.status === "ok",
    use_site: type.site && (p.useSite ?? type.defaultSite),
    text_content: extracted.text, text_chars: extracted.text?.length ?? 0, extract_status: extracted.status, created_by: access.user.id,
  }).select("*").single();
  if (error) return discard("db", error.message);
  await db.from("project_events").insert({ project_id: id, actor_id: access.user.id, actor_type: "user", type: "asset.uploaded", payload: { label, ext, extract: extracted.status } as Json });
  return json(row);
}
