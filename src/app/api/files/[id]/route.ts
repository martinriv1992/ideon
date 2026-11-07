import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/api";
import { safeFileName } from "@/lib/uploads";

export const dynamic = "force-dynamic";

/**
 * Sirve un archivo marcado «publicar en el sitio» (vista previa y sitios en /s/<slug>).
 * El id es un UUID no adivinable; los documentos solo de referencia no se sirven.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return fail("not_found", "No encontrado", 404);
  const db = createAdminClient();
  const { data: asset } = await db.from("project_assets").select("storage_path,mime,name,use_site").eq("id", id).maybeSingle();
  if (!asset?.use_site) return fail("not_found", "No encontrado", 404);
  const { data: blob, error } = await db.storage.from("project-files").download(asset.storage_path);
  if (error || !blob) return fail("not_found", "No encontrado", 404);
  const filename = safeFileName(asset.name);
  return new Response(blob, {
    headers: {
      "Content-Type": asset.mime,
      "Content-Disposition": `${asset.mime === "application/pdf" || asset.mime.startsWith("image/") || asset.mime.startsWith("audio/") ? "inline" : "attachment"}; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      // Un SVG abierto directamente no puede ejecutar scripts en el dominio de la plataforma.
      // (Al PDF no se le aplica: el visor de Chrome no carga documentos en sandbox.)
      ...(asset.mime === "image/svg+xml" ? { "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox" } : {}),
    },
  });
}
