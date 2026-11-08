import { createAdminClient } from "@/lib/supabase/admin";
import { passwordChangeSchema } from "@/features/appdata/core";
import { hashPassword, verifyPassword } from "@/features/appdata/server";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

/** El usuario de la app cambia su propia contraseña. */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const body = passwordChangeSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("weak_password", 400);
  const db = createAdminClient();
  const { data: u } = await db.from("app_users").select("password_hash").eq("id", g.user.id).single();
  if (!u || !(await verifyPassword(body.data.current, u.password_hash))) return appFail("wrong_password", 400);
  await db.from("app_users").update({ password_hash: await hashPassword(body.data.next) }).eq("id", g.user.id);
  return appJson({ ok: true });
}
