import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { billingFromSettings } from "@/features/billing/pricing";

/**
 * Antiabuso del registro (cada cuenta nueva puede generar vistas previas gratis
 * que cuestan IA): correos desechables y número de cuentas nuevas por conexión.
 */

let disposable: Set<string> | null = null;
async function disposableDomains() {
  if (!disposable) disposable = new Set((await import("disposable-email-domains")).default as string[]);
  return disposable;
}

/** Correo de un servicio desechable (mailinator, 10minutemail…), incluidos sus subdominios. */
export async function isDisposableEmail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  const list = await disposableDomains();
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (list.has(parts.slice(i).join("."))) return true;
  return false;
}

export async function clientIpHash() {
  const h = await headers();
  const ip = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
  if (!ip) return null;
  // Se guarda solo un hash con sal secreta: nunca la IP en claro.
  const salt = process.env.IP_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "ideon";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** ¿Esta conexión ya alcanzó el máximo de cuentas nuevas en 24 h? Si no, registra el intento. */
export async function checkAndRecordSignup(): Promise<"ok" | "too_many"> {
  const ipHash = await clientIpHash();
  if (!ipHash) return "ok";
  const db = createAdminClient();
  const { data: rows } = await db.from("platform_settings").select("key,value").eq("key", "max_signups_per_ip_day");
  const max = billingFromSettings(rows ?? []).maxSignupsPerIpDay;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from("signup_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= max) return "too_many";
  await db.from("signup_attempts").insert({ ip_hash: ipHash });
  return "ok";
}

/** Límite genérico por conexión para endpoints públicos. Devuelve false si se superó. */
export async function rateLimit(bucket: string, max: number, windowMs: number): Promise<boolean> {
  const ipHash = await clientIpHash();
  if (!ipHash) return true;
  const db = createAdminClient();
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await db.from("rate_limits").select("id", { count: "exact", head: true }).eq("bucket", bucket).eq("ip_hash", ipHash).gte("created_at", since);
  if ((count ?? 0) >= max) return false;
  await db.from("rate_limits").insert({ bucket, ip_hash: ipHash });
  return true;
}
