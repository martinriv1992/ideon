import { requireProjectMember } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Copia de seguridad de los datos de la app (JSON por colección). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const db = createAdminClient();
  const collections: Record<string, unknown[]> = {};
  for (let from = 0; ; from += 1000) {
    const { data } = await db.from("app_records").select("id,collection,data,created_at,updated_at").eq("project_id", id).is("deleted_at", null).order("created_at").range(from, from + 999);
    for (const r of data ?? []) if (!r.collection.startsWith("__")) (collections[r.collection] ??= []).push({ id: r.id, ...(r.data as object), createdAt: r.created_at, updatedAt: r.updated_at });
    if (!data || data.length < 1000) break;
  }
  const body = JSON.stringify({ project: access.project.name, exportedAt: new Date().toISOString(), collections }, null, 2);
  const name = access.project.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "app";
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-datos-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}
