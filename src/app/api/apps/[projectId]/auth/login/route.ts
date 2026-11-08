import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/features/auth/abuse";
import { loginSchema } from "@/features/appdata/core";
import { startSession, verifyPassword, type AppUser } from "@/features/appdata/server";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

/** Inicio de sesión de un usuario de la app (equipo del cliente). */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, false);
  if ("error" in g) return g.error;
  if (!(await rateLimit(`app_login:${projectId}`, 10, 15 * 60_000))) return appFail("rate_limited", 429);
  const body = loginSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("invalid_credentials", 401);
  const { data: u } = await createAdminClient().from("app_users").select("id,project_id,email,name,role,active,password_hash")
    .eq("project_id", projectId).eq("email", body.data.email).maybeSingle();
  // Misma respuesta si el correo no existe o la contraseña no coincide.
  if (!u || !u.active || !(await verifyPassword(body.data.password, u.password_hash))) return appFail("invalid_credentials", 401);
  const user: AppUser = { id: u.id, project_id: u.project_id, email: u.email, name: u.name, role: u.role as AppUser["role"] };
  await startSession(user);
  return appJson({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
