import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireProjectMember, requireUnlocked, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/features/appdata/core";
import { appUrl, hashPassword, sendAccessEmail } from "@/features/appdata/server";
import type { AppUserRow } from "@/types/database.types";

export const dynamic = "force-dynamic";
const COLS = "id,email,name,role,active,last_login_at,created_at";
const patchSchema = z.object({
  role: z.enum(["admin", "member"]).optional(),
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  resetPassword: z.boolean().optional(),
  sendEmail: z.boolean().optional(),
});

async function guard(id: string, uid: string) {
  const access = await requireProjectMember(id);
  if ("error" in access) return access;
  const locked = await requireUnlocked(access);
  if (locked) return { error: locked };
  if (!z.string().uuid().safeParse(uid).success) return { error: fail("not_found", "Usuario no encontrado", 404) };
  return access;
}

/** Cambiar rol, activar/desactivar o generar una contraseña nueva. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const { id, uid } = await params;
  const access = await guard(id, uid);
  if ("error" in access) return access.error;
  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Datos no válidos");
  const db = createAdminClient();
  const update: Partial<AppUserRow> = {};
  if (body.data.role) update.role = body.data.role;
  if (body.data.active !== undefined) update.active = body.data.active;
  if (body.data.name) update.name = body.data.name;
  let password: string | undefined;
  if (body.data.resetPassword) { password = generatePassword((n) => randomBytes(n)); update.password_hash = await hashPassword(password); }
  const { data: user } = await db.from("app_users").update(update).eq("id", uid).eq("project_id", id).select(COLS).maybeSingle();
  if (!user) return fail("not_found", "Usuario no encontrado", 404);
  // Contraseña nueva o acceso desactivado: se cierran sus sesiones abiertas.
  if (password || body.data.active === false) await db.from("app_sessions").delete().eq("user_id", uid);
  let emailed = false;
  const url = await appUrl(id);
  if (password && body.data.sendEmail && url) emailed = await sendAccessEmail({ to: user.email, name: user.name, appName: access.project.name, url, password, locale: access.project.locale });
  return json({ user, password, emailed });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; uid: string }> }) {
  const { id, uid } = await params;
  const access = await guard(id, uid);
  if ("error" in access) return access.error;
  const { data } = await createAdminClient().from("app_users").delete().eq("id", uid).eq("project_id", id).select("id").maybeSingle();
  if (!data) return fail("not_found", "Usuario no encontrado", 404);
  return json({ ok: true });
}
