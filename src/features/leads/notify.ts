import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import type { Lead } from "@/types/database.types";

/**
 * Aviso al fundador cuando entra un lead. Adaptador de correo: usa la API de
 * Resend si RESEND_API_KEY está configurada (remitente LEADS_FROM_EMAIL o
 * no-reply@ideonapp.com, ya verificado). Destinatarios: LEADS_NOTIFY_EMAIL o,
 * si no existe, los administradores de la plataforma.
 * Sin configuración no falla: el lead queda guardado y visible en /admin/leads.
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

async function recipients(): Promise<string[]> {
  const fixed = (process.env.LEADS_NOTIFY_EMAIL ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (fixed.length) return fixed;
  const db = createAdminClient();
  const { data: admins } = await db.from("profiles").select("id").eq("is_platform_admin", true);
  const emails: string[] = [];
  for (const a of admins ?? []) {
    const { data } = await db.auth.admin.getUserById(a.id);
    if (data.user?.email) emails.push(data.user.email);
  }
  return emails;
}

const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function notifyNewLead(lead: Lead): Promise<"sent" | "not_configured" | "failed"> {
  if (!emailConfigured()) return "not_configured";
  const to = await recipients();
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
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.LEADS_FROM_EMAIL || "Ideonapp <no-reply@ideonapp.com>",
        to, reply_to: lead.email,
        subject: `Nuevo lead · ${lead.company} (${lead.country})`,
        html,
      }),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
