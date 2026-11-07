import { z } from "zod";
import { requireProjectAccess, json, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Imágenes del proyecto. POST multipart {file, label, width, height}: sube a Storage
 * (bucket project-images, carpeta <projectId>/) y registra la fila. DELETE {id}.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("invalid", "Falta el archivo");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail("invalid", "Formato no admitido (JPEG, PNG o WebP)");
  if (file.size > 2 * 1024 * 1024) return fail("too_large", "Máximo 2 MB por imagen (se redimensiona en el navegador)");
  const { count } = await access.supabase.from("project_images").select("id", { count: "exact", head: true }).eq("project_id", id);
  if ((count ?? 0) >= 12) return fail("limit", "Máximo 12 imágenes por proyecto");

  const label = String(form?.get("label") || file.name.replace(/\.[^.]+$/, "")).slice(0, 80) || "foto";
  const width = Number(form?.get("width")) || null; const height = Number(form?.get("height")) || null;
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const imageId = crypto.randomUUID();
  const path = `${id}/${imageId}.${ext}`;
  const { error: upErr } = await access.supabase.storage.from("project-images").upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return fail("storage", upErr.message, 500);
  const { data, error } = await access.supabase.from("project_images").insert({ id: imageId, project_id: id, label, storage_path: path, width, height, size: file.size, created_by: access.user.id }).select("*").single();
  if (error) return fail("db", error.message, 500);
  await access.supabase.from("project_events").insert({ project_id: id, actor_id: access.user.id, actor_type: "user", type: "image.uploaded", payload: { label } });
  return json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const body = z.object({ imageId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  const { data: img } = await access.supabase.from("project_images").select("storage_path").eq("id", body.data.imageId).eq("project_id", id).maybeSingle();
  if (!img) return fail("not_found", "Imagen no encontrada", 404);
  await access.supabase.storage.from("project-images").remove([img.storage_path]);
  await access.supabase.from("project_images").delete().eq("id", body.data.imageId);
  return json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const body = z.object({ imageId: z.string().uuid(), label: z.string().trim().min(1).max(80) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  // RLS de project_images no permite update a usuarios: se hace con service_role tras comprobar pertenencia.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("project_images").update({ label: body.data.label }).eq("id", body.data.imageId).eq("project_id", id);
  return json({ ok: true });
}
