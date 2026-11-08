import { createAdminClient } from "@/lib/supabase/admin";
import { appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

/** Equipo de la app (para asignar responsables): solo id, nombre y rol. */
export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const { data } = await createAdminClient().from("app_users").select("id,name,role").eq("project_id", projectId).eq("active", true).order("name");
  return appJson({ users: data ?? [] });
}
