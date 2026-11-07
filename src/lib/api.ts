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

export function errorResponse(e: unknown) {
  const code = (e as { code?: string })?.code ?? "error";
  const message = e instanceof Error ? e.message : String(e);
  const status = code === "ai_not_configured" ? 503 : code === "invalid_state" ? 409 : 500;
  return fail(code, message, status);
}
