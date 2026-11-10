import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import Anthropic from "@anthropic-ai/sdk";
import {
  aiMessagePrompt, cadenceFrom, emailHtml, itemId, nextStep, outreachConfigFrom, sectorCopy, signatureFrom, signatureText, stripSignoff, templateMessage,
  type Canal, type Item, type Lead, type Signature,
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

const BASE = () => (process.env.NEXT_PUBLIC_APP_URL || "https://ideonapp.com").replace(/\/$/, "");
/** Recursos del correo con diseño: banner del sector, logo y botón para agendar. */
export function emailDesignFor(lead: Pick<Lead, "sector" | "empresa">, diseno: "pieza" | "texto") {
  return { diseno, banner: `${BASE()}/email/${sectorCopy(lead).key}.jpg`, logo: `${BASE()}/email/logo.png`, link: `${BASE()}/es`, ctaUrl: process.env.NEXT_PUBLIC_BOOKING_URL || `${BASE()}/es/contact`, ctaText: "Agendar 15 minutos" };
}
export function signatureFor(company: unknown, mine: unknown, fallbackName: string): Signature {
  return { ...signatureFrom(company, mine, fallbackName), logo: `${BASE()}/email/isotipo.png` };
}

export async function sendOutreachEmail(a: { from: string; to: string; replyTo?: string; subject: string; texto: string; unsub: string; lead?: Pick<Lead, "sector" | "empresa">; diseno?: "pieza" | "texto"; sig?: Signature }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Correo no configurado (RESEND_API_KEY)" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: a.from, to: [a.to], subject: a.subject,
        text: `${a.sig ? `${stripSignoff(a.texto, a.sig.nombre)}\n\n${signatureText(a.sig)}` : a.texto}\n\n—\nPara no recibir más mensajes: ${a.unsub}`,
        html: emailHtml(a.texto, a.unsub, a.lead ? emailDesignFor(a.lead, a.diseno ?? "pieza") : {}, a.sig),
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
/**
 * Respuestas: si hay dominio de recepción (INBOUND_DOMAIN, p. ej. respuestas.ideonapp.com o el *.resend.app
 * de la cuenta), cada correo lleva una dirección de respuesta única por prospecto. Así la respuesta vuelve al CRM.
 */
const replySig = (projectId: string, leadId: string) => createHmac("sha256", secret()).update(`reply:${projectId}:${leadId}`).digest("hex").slice(0, 10);
export function replyAddress(projectId: string, leadId: string) {
  const dom = (process.env.INBOUND_DOMAIN || "").trim().toLowerCase();
  if (!dom || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(dom) || !/^[a-z0-9_-]{1,40}$/i.test(leadId)) return null;
  return `r.${projectId.slice(0, 8)}.${leadId.toLowerCase()}.${replySig(projectId, leadId.toLowerCase())}@${dom}`;
}
export const checkReplySig = (projectId: string, leadId: string, sig: string) => replySig(projectId, leadId) === sig;

/** Guarda un mensaje en la conversación del prospecto (colección «mensajes»). */
export async function logMessage(projectId: string, m: { leadId: string; dir: "saliente" | "entrante"; canal: "Correo" | "WhatsApp"; asunto?: string; texto: string; de?: string }) {
  const id = `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await createAdminClient().from("app_records").insert({ id, project_id: projectId, collection: "mensajes", data: { ...m, fecha: new Date().toISOString(), leido: m.dir === "saliente" } as Json });
}

export const unsubscribeUrl = (projectId: string, leadId: string) =>
  `${process.env.NEXT_PUBLIC_APP_URL || "https://ideonapp.com"}/api/apps/${projectId}/unsubscribe?l=${encodeURIComponent(leadId)}&t=${unsubscribeToken(projectId, leadId)}`;

let ai: Anthropic | null = null;
/** Redacta con IA (Haiku) un paso de la cadencia; null si falla (se usa la plantilla). */
async function aiMessage(projectId: string, orgId: string | null, lead: Lead, paso: number, canal: Canal, firma: string, descripcion: string) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    ai ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await ai.messages.create({ model: "claude-haiku-5-5", max_tokens: 700, thinking: { type: "disabled" }, messages: [{ role: "user", content: aiMessagePrompt(lead, paso, canal, firma, descripcion) }] });
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    if (orgId) await createAdminClient().from("ai_usage").insert({ organization_id: orgId, project_id: projectId, provider: "anthropic", model: "claude-haiku-5-5", input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, cost_usd: Number(((res.usage.input_tokens * 0.1 + res.usage.output_tokens * 0.5) / 1e6).toFixed(6)) });
    const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
    const j = JSON.parse(m[0]) as { asunto?: string; mensaje?: string };
    if (!j.mensaje || j.mensaje.length < 20) return null;
    return { asunto: canal === "Correo" ? String(j.asunto || "").slice(0, 120) : "", texto: String(j.mensaje).replace(/\\n/g, "\n").slice(0, 3000) };
  } catch { return null; }
}

export interface OutreachSummary { activo: boolean; creados: number; enviados: number; whatsapp: number; errores: number; omitidos: number; limiteRestante: number }

export async function runOutreach(projectId: string, opts: { force?: boolean } = {}): Promise<OutreachSummary> {
  const db = createAdminClient();
  const { data } = await db.from("app_records").select("id,collection,data").eq("project_id", projectId).is("deleted_at", null)
    .in("collection", ["settings", "leads", "outreach", "firmas"]).limit(30000);
  const rows = (data ?? []) as unknown as Row[];
  const setting = (id: string) => rows.find((r) => r.collection === "settings" && r.id === id)?.data;
  const cfg = outreachConfigFrom(setting("outreach"));
  const summary: OutreachSummary = { activo: cfg.activo, creados: 0, enviados: 0, whatsapp: 0, errores: 0, omitidos: 0, limiteRestante: 0 };
  if (!cfg.activo && !opts.force) return summary;

  const cad = cadenceFrom(setting("templates"));
  const orgId = cfg.usarIA ? ((await db.from("projects").select("organization_id").eq("id", projectId).maybeSingle()).data?.organization_id ?? null) : null;
  const sig = signatureFor(setting("firma"), null, cfg.firma);
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
    const msg = (cfg.usarIA ? await aiMessage(projectId, orgId, l, step.paso, step.canal, cfg.firma, String(setting("general")?.descripcion ?? "")) : null) ?? templateMessage(l, step.paso, step.canal, cfg.firma);
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
    const r = await sendOutreachEmail({ from, to: l.correo, replyTo: replyAddress(projectId, l.id) ?? (cfg.responderA || undefined), subject: it.asunto || `Ideonapp para ${l.empresa ?? ""}`, texto: it.texto ?? "", unsub: unsubscribeUrl(projectId, l.id), lead: l, diseno: cfg.diseno, sig });
    if (r.ok) {
      quota--; summary.enviados++;
      await patch("outreach", it.id, { estado: "enviado", enviadoEn: new Date().toISOString(), error: null });
      await logMessage(projectId, { leadId: l.id, dir: "saliente", canal: "Correo", asunto: it.asunto ?? "", texto: it.texto ?? "", de: sig.nombre });
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
