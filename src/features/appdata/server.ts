import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingFromSettings, subscriptionState } from "@/features/billing/pricing";
import { siteBaseUrl } from "@/features/deploy/serve";
import { LIMITS, sessionCookieName } from "./core";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: PARAMS.maxmem });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface AppUser { id: string; project_id: string; email: string; name: string; role: "admin" | "member" }

/** Abre una sesión y deja la cookie (httpOnly, por proyecto). */
export async function startSession(user: AppUser) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + LIMITS.sessionDays * 86_400_000);
  const db = createAdminClient();
  await db.from("app_sessions").insert({ user_id: user.id, project_id: user.project_id, token_hash: sha256(token), expires_at: expires.toISOString() });
  await db.from("app_users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id);
  (await cookies()).set(sessionCookieName(user.project_id), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires,
  });
}

export async function endSession(projectId: string) {
  const jar = await cookies();
  const token = jar.get(sessionCookieName(projectId))?.value;
  if (token) await createAdminClient().from("app_sessions").delete().eq("token_hash", sha256(token));
  jar.delete(sessionCookieName(projectId));
}

/** Usuario de la app con sesión válida (o null). */
export async function sessionUser(projectId: string): Promise<AppUser | null> {
  const token = (await cookies()).get(sessionCookieName(projectId))?.value;
  if (!token) return null;
  const db = createAdminClient();
  const { data: s } = await db.from("app_sessions").select("user_id,expires_at").eq("token_hash", sha256(token)).eq("project_id", projectId).maybeSingle();
  if (!s || new Date(s.expires_at) < new Date()) return null;
  const { data: u } = await db.from("app_users").select("id,project_id,email,name,role,active").eq("id", s.user_id).maybeSingle();
  if (!u || !u.active) return null;
  return { id: u.id, project_id: u.project_id, email: u.email, name: u.name, role: u.role as AppUser["role"] };
}

/** La app solo guarda datos si el proyecto está activado y su plan no está suspendido. */
export async function appAvailable(projectId: string): Promise<"ok" | "not_found" | "not_active" | "suspended"> {
  const db = createAdminClient();
  const { data: p } = await db.from("projects").select("id,paid_at").eq("id", projectId).maybeSingle();
  if (!p) return "not_found";
  if (!p.paid_at) return "not_active";
  const { data: sub } = await db.from("subscriptions").select("current_period_end").eq("project_id", projectId).eq("plan", "hosting_domain").maybeSingle();
  if (sub) {
    const { data: rows } = await db.from("platform_settings").select("key,value").in("key", ["renewal_grace_days"]);
    if (subscriptionState(sub.current_period_end, billingFromSettings(rows ?? []).graceDays) === "suspended") return "suspended";
  }
  return "ok";
}

/** Dirección pública de la app: dominio propio verificado o sitios.ideonapp.com/s/<slug>. */
export async function appUrl(projectId: string) {
  const { data: site } = await createAdminClient().from("published_sites").select("slug,custom_domain,domain_status").eq("project_id", projectId).maybeSingle();
  if (!site) return null;
  return site.custom_domain && site.domain_status === "verified" ? `https://${site.custom_domain}` : `${siteBaseUrl()}/s/${site.slug}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Correo con el acceso a la app (Resend). Devuelve false si el correo no está configurado o falla. */
export async function sendAccessEmail(args: { to: string; name: string; appName: string; url: string; password: string; locale: string }) {
  if (!process.env.RESEND_API_KEY) return false;
  const en = args.locale === "en";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">
<h2 style="margin:0 0 12px">${en ? "Your access to" : "Tu acceso a"} ${esc(args.appName)}</h2>
<p>${en ? "Hi" : "Hola"} ${esc(args.name)},</p>
<p>${en ? "You've been given access to the application. Sign in with:" : "Te dieron acceso a la aplicación. Entra con:"}</p>
<p style="background:#f4f4f5;padding:12px 16px;border-radius:8px">${en ? "Address" : "Dirección"}: <a href="${esc(args.url)}">${esc(args.url)}</a><br>${en ? "Email" : "Correo"}: <b>${esc(args.to)}</b><br>${en ? "Temporary password" : "Contraseña temporal"}: <b style="font-family:monospace">${esc(args.password)}</b></p>
<p style="color:#666;font-size:13px">${en ? "You can change your password from the round button at the bottom right of the app." : "Puedes cambiar tu contraseña desde el botón redondo abajo a la derecha de la aplicación."}</p></div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.LEADS_FROM_EMAIL || "Ideonapp <no-reply@ideonapp.com>", to: [args.to], subject: `${en ? "Your access to" : "Tu acceso a"} ${args.appName}`, html }),
    });
    return res.ok;
  } catch { return false; }
}

/** Saldo de prospección del proyecto: prueba gratis, plan prepago vigente y búsquedas sueltas. */
export async function prospectBalance(projectId: string) {
  const { prospectPricingFrom } = await import("./core");
  const db = createAdminClient();
  const [{ data: p }, { data: rows }] = await Promise.all([
    db.from("projects").select("prospect_plan_until,prospect_plan_since,prospect_plan_granted,prospect_credits_bought").eq("id", projectId).single(),
    db.from("platform_settings").select("key,value").like("key", "prospect_%"),
  ]);
  const pricing = prospectPricingFrom(rows ?? []);
  const count = async (pool: string, since?: string | null) => {
    let q = db.from("rate_limits").select("id", { count: "exact", head: true }).eq("bucket", `prospect:${pool}`).eq("ip_hash", projectId);
    if (since) q = q.gte("created_at", since);
    return (await q).count ?? 0;
  };
  const active = Boolean(p?.prospect_plan_until && new Date(p.prospect_plan_until) > new Date());
  const [trialUsed, planUsed, creditUsed] = await Promise.all([count("trial"), active ? count("plan", p?.prospect_plan_since) : Promise.resolve(0), count("credit")]);
  return {
    pricing,
    balance: {
      trial: { total: pricing.trialSearches, used: trialUsed },
      plan: { active, until: p?.prospect_plan_until ?? null, searches: active ? p?.prospect_plan_granted ?? 0 : 0, used: planUsed },
      credits: { bought: p?.prospect_credits_bought ?? 0, used: creditUsed },
    },
  };
}
