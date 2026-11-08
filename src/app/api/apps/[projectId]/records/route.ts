import { createAdminClient } from "@/lib/supabase/admin";
import { batchSchema, LIMITS, toClient, type RecordRow } from "@/features/appdata/core";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";
const COLS = "id,collection,data,created_at,updated_at,deleted_at,created_by,updated_by";

/**
 * Lectura: sin ?since, todos los registros vigentes; con ?since=<ISO>, los
 * cambiados desde entonces (incluidos los borrados) para sincronizar.
 */
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const since = new URL(req.url).searchParams.get("since");
  // Margen de 2 s para no perder escrituras simultáneas a la lectura (el SDK descarta duplicados).
  const now = new Date(Date.now() - 2000).toISOString();
  const db = createAdminClient();
  const rows: RecordRow[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("app_records").select(COLS).eq("project_id", projectId).order("updated_at", { ascending: true }).range(from, from + 999);
    q = since && !Number.isNaN(Date.parse(since)) ? q.gt("updated_at", since) : q.is("deleted_at", null);
    const { data, error } = await q;
    if (error) return appFail("db", 500);
    rows.push(...((data ?? []) as unknown as RecordRow[]));
    if (!data || data.length < 1000 || rows.length >= LIMITS.recordsPerProject) break;
  }
  return appJson({ records: rows.map(toClient), now });
}

/** Escritura en lote: insert, update (fusión), remove (borrado lógico) e increment (atómico). */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const body = batchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appJson({ error: { code: "invalid", detail: body.error.issues[0]?.message } }, 400);
  const db = createAdminClient();
  const uid = g.user.id;

  if (body.data.ops.some((o) => o.op === "insert")) {
    const { count } = await db.from("app_records").select("id", { count: "exact", head: true }).eq("project_id", projectId).is("deleted_at", null);
    if ((count ?? 0) >= LIMITS.recordsPerProject) return appFail("quota_exceeded", 413);
  }

  const results: (ReturnType<typeof toClient> | { id: string; error: string })[] = [];
  for (const op of body.data.ops) {
    if (op.op === "insert") {
      const { error } = await db.from("app_records").insert({ id: op.id, project_id: projectId, collection: op.collection, data: op.data as Json, created_by: uid, updated_by: uid });
      // Reintento del SDK tras un corte: el registro ya existe y se devuelve tal cual.
      if (error && error.code !== "23505") { results.push({ id: op.id, error: "insert_failed" }); continue; }
      const { data: row } = await db.from("app_records").select(COLS).eq("project_id", projectId).eq("collection", op.collection).eq("id", op.id).maybeSingle();
      results.push(row ? toClient(row as unknown as RecordRow) : { id: op.id, error: "not_found" });
    } else if (op.op === "update") {
      const { data } = await db.rpc("app_record_patch", { p_project: projectId, p_collection: op.collection, p_id: op.id, p_patch: op.patch as Json, p_user: uid });
      const row = (data as unknown as RecordRow[] | null)?.[0];
      results.push(row ? toClient(row) : { id: op.id, error: "not_found" });
    } else if (op.op === "increment") {
      const { data, error } = await db.rpc("app_record_increment", { p_project: projectId, p_collection: op.collection, p_id: op.id, p_field: op.field, p_delta: op.delta, p_user: uid });
      const row = (data as unknown as RecordRow[] | null)?.[0];
      results.push(row ? toClient(row) : { id: op.id, error: error ? "not_numeric" : "not_found" });
    } else {
      const { data } = await db.from("app_records").update({ deleted_at: new Date().toISOString(), updated_by: uid }).eq("project_id", projectId).eq("collection", op.collection).eq("id", op.id).is("deleted_at", null).select(COLS).maybeSingle();
      results.push(data ? toClient(data as unknown as RecordRow) : { id: op.id, error: "not_found" });
    }
  }
  return appJson({ results });
}
