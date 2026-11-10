import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";
import { isEmail, outreachConfigFrom } from "@/features/appdata/outreach-core";
import { logMessage, replyAddress, sendOutreachEmail, senderFor, signatureFor, unsubscribeUrl } from "@/features/appdata/outreach";

export const dynamic = "force-dynamic";

const schema = z.object({
  leadId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(10000),
  /** Días hasta el próximo seguimiento (opcional). */
  nextDays: z.number().int().min(1).max(90).optional(),
  tag: z.string().max(80).optional(),
  /** «pieza»: banner de la marca + botón; «texto»: correo sencillo. Ambos llevan la firma corporativa. */
  design: z.enum(["pieza", "texto"]).default("pieza"),
});
const DAILY = 300;

/**
 * Envía un correo a un prospecto del CRM desde la propia app (Resend, dominio ideonapp.com).
 * Solo a prospectos de la app (nunca a direcciones sueltas), respeta las bajas y deja el envío
 * en el historial del prospecto. Remitente y «Responder a» salen de settings/outreach.
 */
export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("invalid", 400);

  const db = createAdminClient();
  const [{ data: lead }, { data: cfgRow }, { count }, { data: firmaRows }] = await Promise.all([
    db.from("app_records").select("data").eq("project_id", projectId).eq("collection", "leads").eq("id", body.data.leadId).is("deleted_at", null).maybeSingle(),
    db.from("app_records").select("data").eq("project_id", projectId).eq("collection", "settings").eq("id", "outreach").is("deleted_at", null).maybeSingle(),
    db.from("rate_limits").select("id", { count: "exact", head: true }).eq("bucket", "app_mail").eq("ip_hash", projectId).gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
    db.from("app_records").select("collection,id,data").eq("project_id", projectId).is("deleted_at", null)
      .or(`and(collection.eq.settings,id.eq.firma),and(collection.eq.firmas,id.eq.${g.user.id})`),
  ]);
  const l = (lead?.data ?? null) as { correo?: string; baja?: boolean; etapa?: string; historial?: unknown[]; sector?: string; empresa?: string } | null;
  if (!l) return appFail("not_found", 404);
  if (l.baja) return appFail("unsubscribed", 409);
  if (!isEmail(l.correo)) return appFail("no_email", 400);
  const cfg = outreachConfigFrom(cfgRow?.data);
  // Las respuestas llegan a quien envía (su correo de acceso); si no es válido, al «Responder a» general.
  const replyTo = isEmail(g.user.email) ? g.user.email : cfg.responderA;
  if (!replyTo) return appFail("no_reply_to", 400);
  if ((count ?? 0) >= DAILY) return appFail("mail_limit", 429);

  // Firma corporativa: datos de la empresa + los del usuario que envía (nombre de su cuenta por defecto).
  const company = firmaRows?.find((r) => r.collection === "settings")?.data, mine = firmaRows?.find((r) => r.collection === "firmas")?.data;
  const sig = signatureFor(company, mine, g.user.name);
  const r = await sendOutreachEmail({ from: senderFor({ remitente: `${sig.nombre} de ${sig.empresa}`, firma: sig.nombre }), to: l.correo!.trim(), replyTo: replyAddress(projectId, body.data.leadId) ?? replyTo, subject: body.data.subject, texto: body.data.text, unsub: unsubscribeUrl(projectId, body.data.leadId), lead: l, diseno: body.data.design, sig });
  if (!r.ok) return appJson({ error: { code: "send_failed", detail: r.error } }, 502);
  await db.from("rate_limits").insert({ bucket: "app_mail", ip_hash: projectId });

  const now = new Date();
  const hist = Array.isArray(l.historial) ? l.historial : [];
  await logMessage(projectId, { leadId: body.data.leadId, dir: "saliente", canal: "Correo", asunto: body.data.subject, texto: body.data.text, de: sig.nombre });
  const patch: Record<string, unknown> = {
    pendiente: false,
    historial: [...hist, { fecha: now.toISOString(), tipo: "Correo", texto: `${body.data.tag ? `[${body.data.tag}] ` : ""}${body.data.subject} · enviado por ${g.user.name}` }],
    ...(!l.etapa || l.etapa === "Nuevo" ? { etapa: "Contactado" } : {}),
    ...(body.data.nextDays ? { proximo: new Date(now.getTime() + body.data.nextDays * 86_400_000).toISOString().slice(0, 10) } : {}),
  };
  const { data: rows } = await db.rpc("app_record_patch", { p_project: projectId, p_collection: "leads", p_id: body.data.leadId, p_patch: patch as Json, p_user: null as unknown as string });
  return appJson({ ok: true, lead: (rows as unknown as { data: unknown }[] | null)?.[0]?.data ?? null });
}
