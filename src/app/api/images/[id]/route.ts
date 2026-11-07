import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/api";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Streaming de una imagen de proyecto desde Storage. El identificador es un UUID
 * no adivinable; sirve tanto a la vista previa como a los sitios publicados.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", "No encontrado", 404);
  const db = createAdminClient();
  const { data: img } = await db.from("project_images").select("storage_path").eq("id", id).maybeSingle();
  if (!img) return fail("not_found", "No encontrado", 404);
  const { data: blob, error } = await db.storage.from("project-images").download(img.storage_path);
  if (error || !blob) return fail("not_found", "No encontrado", 404);
  return new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg", "Cache-Control": "public, max-age=86400, immutable" } });
}
