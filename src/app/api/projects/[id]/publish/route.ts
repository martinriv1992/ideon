import { z } from "zod";
import { requireProjectAccess, requireUnlocked, json, fail, errorResponse } from "@/lib/api";
import { publishProject } from "@/features/deploy/publish";
import { requestPublish } from "@/features/deploy/review";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * Publica la versión actual (o la indicada). En Ideon, con revisión manual activa,
 * el cliente crea una solicitud que un administrador aprueba; Vercel es solo para administradores.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const locked = await requireUnlocked(access);
  if (locked) return locked;
  const body = z.object({ target: z.enum(["ideon", "vercel"]).default("ideon"), slug: z.string().max(40).optional(), versionId: z.string().uuid().optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  if (body.data.target === "vercel") {
    // Crear proyectos en la cuenta de Vercel de la plataforma es una herramienta interna.
    const { data: profile } = await access.supabase.from("profiles").select("is_platform_admin").eq("id", access.user.id).maybeSingle();
    if (!profile?.is_platform_admin) return fail("forbidden", "No disponible", 403);
  }
  try {
    if (body.data.target === "vercel") return json(await publishProject(id, access.user.id, body.data));
    return json(await requestPublish(id, access.user.id, { slug: body.data.slug, versionId: body.data.versionId, origin: "client" }));
  } catch (e) {
    return errorResponse(e);
  }
}
