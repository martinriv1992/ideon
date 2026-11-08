import "server-only";
import { adminEmails, emailConfigured, escapeHtml as esc, sendEmail } from "@/lib/notify";
import { publicEnv } from "@/lib/env";
import type { Lead } from "@/types/database.types";

/**
 * Aviso al fundador cuando entra un lead. Adaptador de correo: usa la API de
 * Resend si RESEND_API_KEY está configurada (remitente LEADS_FROM_EMAIL o
 * no-reply@ideonapp.com, ya verificado). Destinatarios: LEADS_NOTIFY_EMAIL o,
 * si no existe, los administradores de la plataforma.
 * Sin configuración no falla: el lead queda guardado y visible en /admin/leads.
 */
export { emailConfigured } from "@/lib/notify";

export async function notifyNewLead(lead: Lead): Promise<"sent" | "not_configured" | "failed"> {
  if (!emailConfigured()) return "not_configured";
  const to = await adminEmails();
  if (!to.length) return "not_configured";
  const base = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const rows: [string, string | null][] = [
    ["Empresa", lead.company], ["Contacto", lead.full_name], ["Correo", lead.email], ["País", lead.country], ["Web", lead.website],
    ["Solución", lead.solution], ["Presupuesto", lead.budget], ["Plazo", lead.timeframe], ["Quiere reunión", lead.wants_meeting ? "Sí" : "No"],
    ["Origen", [lead.source, lead.medium, lead.campaign].filter(Boolean).join(" / ") || "directo"], ["Página", lead.landing_page], ["Idioma", lead.locale],
  ];
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="margin:0 0 12px">Nuevo lead: ${esc(lead.company)}</h2>
<table style="border-collapse:collapse;font-size:14px">${rows.filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:14px;white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px">${esc(lead.problem)}</p>
<p><a href="${base}/es/admin/leads?id=${lead.id}">Abrir en el backoffice</a></p></div>`;
  const sent = await sendEmail({ to, replyTo: lead.email, subject: `Nuevo lead · ${lead.company} (${lead.country})`, html });
  return sent ? "sent" : "failed";
}
