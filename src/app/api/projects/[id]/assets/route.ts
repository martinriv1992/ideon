import { z } from "zod";
import { requireProjectMember, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { assetTypeFor } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/** Cambia el nombre visible o los usos (la IA lo lee / se publica en el sitio) de un archivo. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const body = z.object({
    assetId: z.string().uuid(),
    label: z.string().trim().min(1).max(80).optional(),
    useReference: z.boolean().optional(),
    useSite: z.boolean().optional(),
  }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  const db = createAdminClient();
  const { data: asset } = await db.from("project_assets").select("*").eq("id", body.data.assetId).eq("project_id", id).maybeSingle();
  if (!asset) return fail("not_found", "Archivo no encontrado", 404);
  const type = assetTypeFor(asset.name);
  const patch: { label?: string; use_reference?: boolean; use_site?: boolean } = {};
  if (body.data.label) patch.label = body.data.label;
  if (body.data.useReference !== undefined) {
    if (body.data.useReference && asset.extract_status !== "ok") return fail("invalid", "No se pudo leer el texto de este archivo");
    patch.use_reference = body.data.useReference;
  }
  if (body.data.useSite !== undefined) {
    if (body.data.useSite && !type?.site) return fail("invalid", "Este tipo de archivo no se puede publicar en el sitio");
    patch.use_site = body.data.useSite;
  }
  const { data, error } = await db.from("project_assets").update(patch).eq("id", asset.id).select("*").single();
  if (error) return fail("db", error.message, 500);
  return json(data);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const body = z.object({ assetId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  const db = createAdminClient();
  const { data: asset } = await db.from("project_assets").select("storage_path,label").eq("id", body.data.assetId).eq("project_id", id).maybeSingle();
  if (!asset) return fail("not_found", "Archivo no encontrado", 404);
  await db.storage.from("project-files").remove([asset.storage_path]);
  await db.from("project_assets").delete().eq("id", body.data.assetId);
  await db.from("project_events").insert({ project_id: id, actor_id: access.user.id, actor_type: "user", type: "asset.deleted", payload: { label: asset.label } });
  return json({ ok: true });
}
