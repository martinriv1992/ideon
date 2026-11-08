import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Correos transaccionales (Resend). Sin RESEND_API_KEY no falla: devuelve false
 * y el flujo sigue (todo queda visible en el panel y el backoffice).
 */
export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export const escapeHtml = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Destinatarios internos: LEADS_NOTIFY_EMAIL o, si no está, los administradores de la plataforma. */
export async function adminEmails(): Promise<string[]> {
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

export async function userEmail(userId: string | null | undefined) {
  if (!userId) return null;
  const { data } = await createAdminClient().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

export async function sendEmail(args: { to: string[]; subject: string; html: string; replyTo?: string }) {
  if (!emailConfigured() || !args.to.length) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.LEADS_FROM_EMAIL || "Ideonapp <no-reply@ideonapp.com>", to: args.to, subject: args.subject, html: args.html, ...(args.replyTo ? { reply_to: args.replyTo } : {}) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
