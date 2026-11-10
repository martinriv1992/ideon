import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database.types";
import { isEmail, outreachConfigFrom, parseReplyLocal, stripQuoted } from "@/features/appdata/outreach-core";
import { checkReplySig, logMessage, sendOutreachEmail } from "@/features/appdata/outreach";

export const dynamic = "force-dynamic";

/** Verificación de la firma Svix que usa Resend en sus webhooks (RESEND_WEBHOOK_SECRET = whsec_…). */
function verify(req: Request, body: string) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;
  const id = req.headers.get("svix-id"), ts = req.headers.get("svix-timestamp"), sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 600) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => { const b = Buffer.from(s.replace(/^v1,/, ""), "base64"); return b.length === expected.length && timingSafeEqual(b, expected); });
}

type Received = { email_id?: string; id?: string; from?: string; to?: string[] | string; cc?: string[] | string; subject?: string; text?: string; html?: string };
const list = (v: unknown) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
const htmlToText = (h: string) => h.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/**
 * Respuestas de los prospectos (Resend Inbound, evento email.received).
 * La dirección «r.<proyecto>.<prospecto>.<firma>@INBOUND_DOMAIN» identifica a quién respondió: se guarda en su
 * conversación, pasa a «Respondió» (la cadencia se detiene), queda pendiente de respuesta y se avisa por correo.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verify(req, raw)) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  const evt = JSON.parse(raw) as { type?: string; data?: Received };
  if (evt.type !== "email.received" || !evt.data) return NextResponse.json({ ok: true, ignored: true });
  let d = evt.data;
  const emailId = d.email_id || d.id;
  // El aviso trae solo los metadatos: el contenido se pide a la API de recepción.
  if (!d.text && !d.html && emailId && process.env.RESEND_API_KEY) {
    const r = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } }).catch(() => null);
    if (r?.ok) d = { ...d, ...((await r.json()) as Received) };
  }
  const db = createAdminClient();
  const fromAddr = (String(d.from || "").match(/[^\s<>"]+@[^\s<>"]+/) || [""])[0].toLowerCase();
  let handled = 0;
  for (const addr of [...list(d.to), ...list(d.cc)]) {
    const p = parseReplyLocal(addr);
    if (!p) continue;
    const { data: proj } = await db.from("projects").select("id,name").gte("id", `${p.p8}-0000-0000-0000-000000000000`).lte("id", `${p.p8}-ffff-ffff-ffff-ffffffffffff`).limit(5);
    const project = (proj ?? []).find((x) => checkReplySig(x.id, p.leadId, p.sig));
    if (!project) continue;
    const { data: rows } = await db.from("app_records").select("id,data").eq("project_id", project.id).eq("collection", "leads").is("deleted_at", null).ilike("id", p.leadId).limit(1);
    const row = rows?.[0];
    if (!row) continue;
    const lead = row.data as { empresa?: string; nombre?: string; etapa?: string; historial?: unknown[]; correo?: string };
    const texto = stripQuoted(d.text || htmlToText(d.html || "")) || "(respuesta sin texto)";
    await logMessage(project.id, { leadId: row.id, dir: "entrante", canal: "Correo", asunto: d.subject ?? "", texto, de: fromAddr || lead.correo || "" });
    const hist = Array.isArray(lead.historial) ? lead.historial : [];
    await db.rpc("app_record_patch", { p_project: project.id, p_collection: "leads", p_id: row.id, p_user: null as unknown as string, p_patch: {
      pendiente: true, ultimaRespuesta: new Date().toISOString(),
      historial: [...hist, { fecha: new Date().toISOString(), tipo: "respuesta", texto: `Respondió por correo: ${texto.slice(0, 140)}` }],
      ...(!lead.etapa || ["Nuevo", "Contactado"].includes(lead.etapa) ? { etapa: "Respondió" } : {}),
    } as Json });
    // Aviso a la persona responsable (el «Responder a» de la automatización).
    const { data: cfgRow } = await db.from("app_records").select("data").eq("project_id", project.id).eq("collection", "settings").eq("id", "outreach").maybeSingle();
    const cfg = outreachConfigFrom(cfgRow?.data);
    if (cfg.responderA) {
      await sendOutreachEmail({ from: "Ideonapp CRM <no-reply@ideonapp.com>", to: cfg.responderA, replyTo: isEmail(fromAddr) ? fromAddr : undefined,
        subject: `💬 ${lead.empresa || lead.nombre || fromAddr} respondió: ${d.subject ?? ""}`.slice(0, 150),
        texto: `${lead.empresa || lead.nombre || fromAddr} respondió a tu correo:\n\n${texto}\n\nYa está en su conversación del CRM y quedó en «Respondió», pendiente de respuesta.`, unsub: "https://ideonapp.com" });
    }
    handled++;
  }
  return NextResponse.json({ ok: true, handled });
}
