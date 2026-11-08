import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";
import { appAvailable, sessionUser, type AppUser } from "./server";

/** Respuestas de la API de apps: siempre sin caché. */
export function appJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function appFail(code: string, status: number) {
  return appJson({ error: { code } }, status);
}

/** Proyecto válido y activo; con `auth`, además un usuario de la app con sesión. */
export async function guardApp(projectId: string, auth: true): Promise<{ user: AppUser } | { error: NextResponse }>;
export async function guardApp(projectId: string, auth: false): Promise<{ user: null } | { error: NextResponse }>;
export async function guardApp(projectId: string, auth: boolean) {
  if (!z.string().uuid().safeParse(projectId).success) return { error: appFail("not_found", 404) };
  const state = await appAvailable(projectId);
  if (state === "not_found") return { error: appFail("not_found", 404) };
  if (state === "not_active") return { error: appFail("not_active", 403) };
  if (state === "suspended") return { error: appFail("suspended", 402) };
  if (!auth) return { user: null };
  const user = await sessionUser(projectId);
  if (!user) return { error: appFail("unauthenticated", 401) };
  return { user };
}
