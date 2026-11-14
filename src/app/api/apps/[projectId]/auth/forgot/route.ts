import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/features/auth/abuse";
import { generatePassword } from "@/features/appdata/core";
import { appUrl, hashPassword, sendAccessEmail } from "@/features/appdata/server";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

/**
 * «Olvidé mi contraseña» de una app publicada: si el correo tiene acceso, se le envía una contraseña
 * temporal nueva y se cierran sus sesiones. La respuesta es siempre la misma (no revela si el correo existe).
 * Límites: 5 intentos por conexión cada 15 min y 2 envíos por correo cada 24 h.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, false);
  if ("error" in g) return g.error;
  if (!(await rateLimit(`app_forgot:${projectId}`, 5, 15 * 60_000))) return appFail("rate_limited", 429);
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("invalid", 400);

  const db = createAdminClient();
  const { data: u } = await db.from("app_users").select("id,email,name,active").eq("project_id", projectId).ilike("email", body.data.email).maybeSingle();
  if (u?.active) {
    const key = createHash("sha256").update(`forgot:${projectId}:${u.id}`).digest("hex");
    const { count } = await db.from("rate_limits").select("id", { count: "exact", head: true }).eq("bucket", "app_forgot_user").eq("ip_hash", key)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());
    const [{ data: project }, url] = await Promise.all([db.from("projects").select("name,locale").eq("id", projectId).single(), appUrl(projectId)]);
    if ((count ?? 0) < 2 && project && url) {
      const password = generatePassword((n) => randomBytes(n));
      // Solo se cambia la contraseña si el correo salió: así nadie se queda sin acceso por un fallo de envío.
      const sent = await sendAccessEmail({ to: u.email, name: u.name, appName: project.name, url, password, locale: project.locale });
      if (sent) {
        await db.from("rate_limits").insert({ bucket: "app_forgot_user", ip_hash: key });
        await db.from("app_users").update({ password_hash: await hashPassword(password) }).eq("id", u.id);
        await db.from("app_sessions").delete().eq("user_id", u.id);
      }
    }
  }
  return appJson({ ok: true });
}
