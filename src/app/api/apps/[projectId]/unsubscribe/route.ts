import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkUnsubscribe } from "@/features/appdata/outreach";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

const page = (title: string, text: string, status = 200) => new Response(
  `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:grid;place-items:center;min-height:100vh;margin:0"><div style="max-width:420px;padding:32px;text-align:center"><h1 style="font-size:22px">${title}</h1><p style="color:#a1a1aa;line-height:1.5">${text}</p></div></body></html>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

async function unsubscribe(req: Request, projectId: string) {
  const u = new URL(req.url);
  const leadId = u.searchParams.get("l") ?? "", token = u.searchParams.get("t") ?? "";
  if (!z.string().uuid().safeParse(projectId).success || !leadId || !checkUnsubscribe(projectId, leadId, token)) return page("Enlace no válido", "Este enlace no es válido o está incompleto.", 400);
  await createAdminClient().rpc("app_record_patch", { p_project: projectId, p_collection: "leads", p_id: leadId, p_patch: { baja: true, bajaEn: new Date().toISOString() } as Json, p_user: null as unknown as string });
  return page("Listo, no te escribiremos más", "Tu dirección quedó dada de baja de nuestros mensajes. Disculpa la molestia.");
}

/** Baja de las cadencias (enlace en cada correo y cabecera List-Unsubscribe de un clic). */
export async function GET(req: Request, { params }: { params: Promise<{ projectId: string }> }) { return unsubscribe(req, (await params).projectId); }
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) { return unsubscribe(req, (await params).projectId); }
