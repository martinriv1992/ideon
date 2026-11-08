import { randomBytes } from "node:crypto";
import { requireProjectMember, requireUnlocked, json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUserSchema, generatePassword, LIMITS } from "@/features/appdata/core";
import { appUrl, hashPassword, sendAccessEmail } from "@/features/appdata/server";
import { usesIdeonData } from "@/features/appdata/core";
import { getVersionFile } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";
const COLS = "id,email,name,role,active,last_login_at,created_at";

/** Equipo de la app publicada (usuarios finales del cliente). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const db = createAdminClient();
  const { data } = await db.from("app_users").select(COLS).eq("project_id", id).order("created_at");
  const { count } = await db.from("app_records").select("id", { count: "exact", head: true }).eq("project_id", id).is("deleted_at", null).not("collection", "like", "\\_\\_%");
  const file = access.project.current_version_id ? await getVersionFile(access.project.current_version_id) : null;
  return json({ users: data ?? [], url: await appUrl(id), usesData: Boolean(file && usesIdeonData(file.content)), records: count ?? 0 });
}

/** Da acceso a una persona: contraseña indicada o temporal (se muestra una sola vez) y, opcionalmente, correo de acceso. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const locked = await requireUnlocked(access);
  if (locked) return locked;
  const body = appUserSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", body.error.issues[0]?.path[0] === "password" ? "La contraseña debe tener al menos 8 caracteres." : "Revisa el nombre y el correo.");
  const db = createAdminClient();
  const { count } = await db.from("app_users").select("id", { count: "exact", head: true }).eq("project_id", id);
  if ((count ?? 0) >= LIMITS.usersPerProject) return fail("limit", `Máximo ${LIMITS.usersPerProject} usuarios por aplicación.`, 409);
  const password = body.data.password ?? generatePassword((n) => randomBytes(n));
  const { data: user, error } = await db.from("app_users").insert({
    project_id: id, email: body.data.email, name: body.data.name, role: body.data.role, password_hash: await hashPassword(password), created_by: access.user.id,
  }).select(COLS).single();
  if (error) return fail(error.code === "23505" ? "duplicate" : "db", error.code === "23505" ? "Ya existe un usuario con ese correo." : error.message, error.code === "23505" ? 409 : 500);
  let emailed = false;
  const url = await appUrl(id);
  if (body.data.sendEmail && url) emailed = await sendAccessEmail({ to: body.data.email, name: body.data.name, appName: access.project.name, url, password, locale: access.project.locale });
  await db.from("project_events").insert({ project_id: id, actor_id: access.user.id, actor_type: "user", type: "app_user.created", payload: { email: body.data.email, role: body.data.role } });
  return json({ user, password, emailed, url });
}
