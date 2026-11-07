import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

/** Utilidades comunes de los route handlers. */
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Devuelve el usuario y el proyecto si el usuario es miembro (RLS). */
export async function requireProjectAccess(projectId: string) {
  if (!isSupabaseConfigured) return { error: fail("not_configured", "Supabase no está configurado", 503) };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: fail("unauthenticated", "Inicia sesión", 401) };
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return { error: fail("not_found", "Proyecto no encontrado", 404) };
  return { user, project, supabase };
}

/** Como requireProjectAccess, pero exige rol 'member' o superior (para escribir). */
export async function requireProjectMember(projectId: string) {
  const access = await requireProjectAccess(projectId);
  if ("error" in access) return access;
  const { data: ok } = await access.supabase.rpc("is_org_member", { org_id: access.project.organization_id, min_role: "member" });
  if (!ok) return { error: fail("forbidden", "No tienes permiso para modificar este proyecto", 403) };
  return access;
}

/** Bloquea acciones de pago (publicar, descargar, dominio) durante la vista previa gratuita. */
export async function requireUnlocked(access: { user: { id: string }; project: { paid_at: string | null }; supabase: Awaited<ReturnType<typeof createClient>> }) {
  if (access.project.paid_at) return null;
  const { data: profile } = await access.supabase.from("profiles").select("is_platform_admin").eq("id", access.user.id).maybeSingle();
  if (profile?.is_platform_admin) return null;
  return fail("payment_required", "Esta acción está disponible al activar el proyecto. Revisa la pestaña Publicar.", 402);
}

export function errorResponse(e: unknown) {
  const code = (e as { code?: string })?.code ?? "error";
  const message = e instanceof Error ? e.message : String(e);
  const status = code === "ai_not_configured" || code === "not_configured" ? 503 : code === "invalid_state" ? 409 : code === "payment_required" ? 402 : 500;
  return fail(code, message, status);
}
