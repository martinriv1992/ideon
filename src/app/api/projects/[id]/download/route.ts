import JSZip from "jszip";
import { requireProjectAccess, requireUnlocked, fail } from "@/lib/api";
import { bundleStaticAssets, getVersionFile, slugify } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Descarga la versión actual como ZIP (index.html + carpetas images/ y files/). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const locked = await requireUnlocked(access);
  if (locked) return locked;
  const url = new URL(req.url);
  const versionId = url.searchParams.get("v") || access.project.current_version_id;
  if (!versionId) return fail("not_found", "Sin versión", 404);
  const file = await getVersionFile(versionId);
  if (!file) return fail("not_found", "Archivo no encontrado", 404);

  const zip = new JSZip();
  const { html, assets } = await bundleStaticAssets(id, file.content);
  for (const a of assets) zip.file(a.path, a.data);
  zip.file("index.html", html);
  zip.file("README.txt", `Sitio generado por Ideon para «${access.project.name}».\nSube el contenido de esta carpeta a cualquier hosting estático (index.html en la raíz).\n`);
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Response(buf, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slugify(access.project.name) || "sitio"}.zip"` } });
}
