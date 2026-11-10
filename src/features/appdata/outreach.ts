import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import {
  cadenceFrom, emailHtml, itemId, nextStep, outreachConfigFrom, templateMessage,
  type Item, type Lead,
} from "./outreach-core";

/**
 * Motor de cadencias de una app (CRM): crea los mensajes que tocan hoy y envía por correo
 * los aprobados, hasta el límite diario. WhatsApp queda en una cola para enviar con un clic.
 * Lo ejecuta la tarea diaria (/api/cron/outreach) o el botón «Ejecutar ahora» del CRM.
 */
type Row = { id: string; collection: string; data: Record<string, unknown> };
const FROM_DOMAIN = "ideonapp.com";

const secret = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const unsubscribeToken = (projectId: string, leadId: string) => createHmac("sha256", secret()).update(`${projectId}:${leadId}`).digest("base64url").slice(0, 32);
export function checkUnsubscribe(projectId: string, leadId: string, token: string) {
  const a = Buffer.from(unsubscribeToken(projectId, leadId)), b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function sendOutreachEmail(a: { from: string; to: string; replyTo?: string; subject: string; texto: string; unsub: string }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Correo no configurado (RESEND_API_KEY)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: a.from, to: [a.to], subject: a.subject, text: `${a.texto}\n\n—\nPara no recibir más mensajes: ${a.unsub}`, html: emailHtml(a.texto, a.unsub),
        ...(a.replyTo ? { reply_to: a.replyTo } : {}),
        headers: { "List-Unsubscribe": `<${a.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (res.ok) return { ok: true as const };
    return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) }; }
}

/** Remitente: «Nombre <firma@ideonapp.com>» (dominio verificado en Resend). */
export function senderFor(cfg: { remitente: string; firma: string }) {
  const local = cfg.firma.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") || "hola";
  return `${cfg.remitente} <${local}@${FROM_DOMAIN}>`;
}
export const unsubscribeUrl = (projectId: string, leadId: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || "https://ideonapp.com"}/api/apps/${projectId}/unsubscribe?l=${encodeURIComponent(leadId)}&t=${unsubscribeToken(projectId, leadId)}`;

export interface OutreachSummary { activo: boolean; creados: number; enviados: number; whatsapp: number; errores: number; omitidos: number; limiteRestante: number }

export async function runOutreach(projectId: string, opts: { force?: boolean } = {}): Promise<OutreachSummary> {
  const db = createAdminClient();
  const { data } = await db.from("app_records").select("id,collection,data").eq("project_id", projectId).is("deleted_at", null)
    .in("collection", ["settings", "leads", "outreach"]).limit(30000);
  const rows = (data ?? []) as unknown as Row[];
  const setting = (id: string) => rows.find((r) => r.collection === "settings" && r.id === id)?.data;
  const cfg = outreachConfigFrom(setting("outreach"));
  const summary: OutreachSummary = { activo: cfg.activo, creados: 0, enviados: 0, whatsapp: 0, errores: 0, omitidos: 0, limiteRestante: 0 };
  if (!cfg.activo && !opts.force) return summary;

  const cad = cadenceFrom(setting("templates"));
  const leads = rows.filter((r) => r.collection === "leads").map((r) => ({ ...(r.data as object), id: r.id }) as Lead & { historial?: unknown[] });
  const items = rows.filter((r) => r.collection === "outreach").map((r) => ({ ...(r.data as object), id: r.id }) as Item);
  const now = new Date(), nowIso = now.toISOString();
  const patch = (collection: string, id: string, p: Record<string, unknown>) => db.rpc("app_record_patch", { p_project: projectId, p_collection: collection, p_id: id, p_patch: p as Json, p_user: null as unknown as string });

  // 1) Detener: pendientes de prospectos que respondieron, se cerraron o se dieron de baja.
  for (const it of items.filter((i) => ["borrador", "aprobado", "whatsapp"].includes(i.estado))) {
    const l = leads.find((x) => x.id === it.leadId);
    if (!l || l.baja || ["Respondió", "Reunión", "Propuesta", "Cliente", "Perdido"].includes(l.etapa ?? "")) {
      await patch("outreach", it.id, { estado: "omitido", nota: "Cadencia detenida (respondió, se cerró o se dio de baja)" }); it.estado = "omitido"; summary.omitidos++;
    }
  }

  // 2) Crear los mensajes que tocan hoy.
  const nuevos: Item[] = [];
  for (const l of leads) {
    const step = nextStep(l, cad, items, cfg, now);
    if (!step) continue;
    const msg = templateMessage(l, step.paso, step.canal, cfg.firma);
    const estado = step.canal === "WhatsApp" ? "whatsapp" : cfg.modo === "auto" ? "aprobado" : "borrador";
    const it: Item = { id: itemId(l.id, step.paso), leadId: l.id, paso: step.paso, canal: step.canal, estado, asunto: msg.asunto, texto: msg.texto, creado: nowIso, enviadoEn: null };
    const { id, ...rest } = it;
    const { error } = await db.from("app_records").insert({ id, project_id: projectId, collection: "outreach", data: { ...rest, empresa: l.empresa ?? "", destino: step.canal === "Correo" ? l.correo : l.telefono } as Json });
    if (!error) { nuevos.push(it); items.push(it); summary.creados++; if (estado === "whatsapp") summary.whatsapp++; }
  }

  // 3) Enviar por correo los aprobados, hasta el límite del día (hora de Colombia).
  const today = new Date(now.getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  const sentToday = items.filter((i) => i.estado === "enviado" && i.canal === "Correo" && i.enviadoEn && new Date(new Date(i.enviadoEn).getTime() - 5 * 3600_000).toISOString().slice(0, 10) === today).length;
  let quota = Math.max(0, cfg.limiteDiario - sentToday);
  const from = senderFor(cfg);
  // Sin «Responder a» no se envía: las respuestas de los prospectos se perderían.
  if (!cfg.responderA) quota = 0;
  for (const it of items.filter((i) => i.estado === "aprobado" && i.canal === "Correo").sort((a, b) => (a.creado ?? "").localeCompare(b.creado ?? ""))) {
    if (quota <= 0) break;
    const l = leads.find((x) => x.id === it.leadId);
    if (!l?.correo) continue;
    const r = await sendOutreachEmail({ from, to: l.correo, replyTo: cfg.responderA || undefined, subject: it.asunto || `Ideonapp para ${l.empresa ?? ""}`, texto: it.texto ?? "", unsub: unsubscribeUrl(projectId, l.id) });
    if (r.ok) {
      quota--; summary.enviados++;
      await patch("outreach", it.id, { estado: "enviado", enviadoEn: new Date().toISOString(), error: null });
      const hist = Array.isArray(l.historial) ? l.historial : [];
      const nextDay = cad[it.paso + 1] ? cad[it.paso + 1].dia - cad[it.paso].dia : null;
      await patch("leads", l.id, {
        historial: [...hist, { fecha: new Date().toISOString(), tipo: "Correo", texto: `[Cadencia paso ${it.paso + 1}] ${it.asunto ?? ""}` }],
        ...(l.etapa === "Nuevo" || !l.etapa ? { etapa: "Contactado" } : {}),
        ...(nextDay ? { proximo: new Date(Date.now() + nextDay * 86_400_000).toISOString().slice(0, 10) } : {}),
      });
    } else {
      summary.errores++;
      await patch("outreach", it.id, { estado: "error", error: r.error ?? "Error al enviar" });
    }
  }
  summary.limiteRestante = quota;
  return summary;
}

/** Proyectos con la automatización activada (para la tarea diaria). */
export async function outreachProjects() {
  const { data } = await createAdminClient().from("app_records").select("project_id").eq("collection", "settings").eq("id", "outreach").is("deleted_at", null).eq("data->>activo", "true");
  return [...new Set((data ?? []).map((r) => r.project_id as string))];
}
