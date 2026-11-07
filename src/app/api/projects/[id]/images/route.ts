import { z } from "zod";
import { requireProjectAccess, json, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Imágenes del proyecto. La subida va por /uploads (URL firmada directa a Storage);
 * aquí se borran (DELETE {imageId}) y se renombran (PATCH {imageId, label}).
 */
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
