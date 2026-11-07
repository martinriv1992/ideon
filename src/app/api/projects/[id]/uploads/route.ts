import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMAGE_TYPES, MAX_ASSETS, MAX_IMAGES, MAX_UPLOAD_BYTES, assetTypeFor } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const body = z.object({
  kind: z.enum(["image", "asset"]),
  name: z.string().trim().min(1).max(200),
  type: z.string().max(120).default(""),
  size: z.number().int().positive(),
});

/**
 * Paso 1 de una subida: valida tipo, tamaño y cupo, y devuelve una URL firmada
 * para que el navegador suba el archivo directamente a Storage (sin pasar por
 * la función, que en Vercel admite como máximo 4,5 MB por petición).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", "Parámetros no válidos");
  const { kind, name, type, size } = parsed.data;
  if (size > MAX_UPLOAD_BYTES) return fail("too_large", "Máximo 10 MB por archivo");

  let ext: string;
  let bucket: string;
  if (kind === "image") {
    const e = IMAGE_TYPES[type];
    if (!e) return fail("invalid", "Formato de imagen no admitido (JPEG, PNG, WebP, GIF o SVG)");
    const { count } = await access.supabase.from("project_images").select("id", { count: "exact", head: true }).eq("project_id", id);
    if ((count ?? 0) >= MAX_IMAGES) return fail("limit", `Máximo ${MAX_IMAGES} imágenes por proyecto`);
    ext = e; bucket = "project-images";
  } else {
    const t = assetTypeFor(name);
    if (!t) return fail("invalid", "Tipo de archivo no admitido");
    const { count } = await access.supabase.from("project_assets").select("id", { count: "exact", head: true }).eq("project_id", id);
    if ((count ?? 0) >= MAX_ASSETS) return fail("limit", `Máximo ${MAX_ASSETS} archivos por proyecto`);
    ext = t.ext; bucket = "project-files";
  }

  const uploadId = crypto.randomUUID();
  const path = `${id}/${uploadId}.${ext}`;
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data) return fail("storage", error?.message ?? "No se pudo preparar la subida", 500);
  return json({ uploadId, bucket, path, token: data.token });
}
