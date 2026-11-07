import JSZip from "jszip";
import { requireProjectAccess, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVersionFile, slugify } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Descarga la versión actual como ZIP (index.html + carpeta images/). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const url = new URL(req.url);
  const versionId = url.searchParams.get("v") || access.project.current_version_id;
  if (!versionId) return fail("not_found", "Sin versión", 404);
  const file = await getVersionFile(versionId);
  if (!file) return fail("not_found", "Archivo no encontrado", 404);

  const db = createAdminClient();
  const { data: images } = await db.from("project_images").select("id,storage_path").eq("project_id", id);
  const zip = new JSZip();
  let html = file.content;
  for (const img of images ?? []) {
    if (!html.includes(`{{IMG:${img.id}}}`)) continue;
    const { data: blob } = await db.storage.from("project-images").download(img.storage_path);
    if (!blob) continue;
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const name = `images/${img.id}.${ext}`;
    zip.file(name, await blob.arrayBuffer());
    html = html.split(`{{IMG:${img.id}}}`).join(name);
  }
  html = html.replace(/\{\{IMG:[a-z0-9-]+\}\}/gi, "");
  zip.file("index.html", html);
  zip.file("README.txt", `Sitio generado por Ideon para «${access.project.name}».\nSube el contenido de esta carpeta a cualquier hosting estático (index.html en la raíz).\n`);
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slugify(access.project.name) || "sitio"}.zip"` } });
}
