import { z } from "zod";

/**
 * Ideon Data · núcleo puro (sin dependencias de servidor), probado de forma aislada.
 * Las apps guardan registros JSON en colecciones; las operaciones llegan en lotes
 * desde el SDK del navegador (public/ideon-data.js).
 */

export const LIMITS = {
  recordsPerProject: 25_000,
  recordBytes: 32 * 1024,
  opsPerBatch: 100,
  usersPerProject: 50,
  sessionDays: 30,
};

export const COLLECTION = /^[a-z_][a-z0-9_]{0,39}$/;
const FIELD = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/;
/** Campos que pone el sistema: no se guardan dentro de data. */
export const RESERVED = ["id", "createdAt", "updatedAt", "createdBy", "updatedBy"] as const;

const jsonSize = (v: unknown) => new TextEncoder().encode(JSON.stringify(v ?? null)).length;

const dataObject = z.record(z.string(), z.unknown())
  .refine((o) => jsonSize(o) <= LIMITS.recordBytes, { message: "record_too_large" })
  .transform((o) => { const c = { ...o }; for (const k of RESERVED) delete c[k]; return c; });

/** Id de registro: UUID en los nuevos; legible («p1») en los datos iniciales. */
export const RECORD_ID = /^[A-Za-z0-9_-]{1,64}$/;
const recordId = z.string().regex(RECORD_ID, "invalid_id");
const collection = z.string().regex(COLLECTION, "invalid_collection");

export const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("insert"), collection, id: recordId, data: dataObject }),
  z.object({ op: z.literal("update"), collection, id: recordId, patch: dataObject }),
  z.object({ op: z.literal("remove"), collection, id: recordId }),
  z.object({ op: z.literal("increment"), collection, id: recordId, field: z.string().regex(FIELD, "invalid_field").refine((f) => !(RESERVED as readonly string[]).includes(f), "invalid_field"), delta: z.number().finite() }),
]);
export type AppOp = z.infer<typeof opSchema>;
export const batchSchema = z.object({ ops: z.array(opSchema).min(1).max(LIMITS.opsPerBatch) });

export interface RecordRow { id: string; collection: string; data: Record<string, unknown>; created_at: string; updated_at: string; deleted_at: string | null; created_by: string | null; updated_by: string | null }

/** Forma en que el SDK recibe un registro. */
export function toClient(r: RecordRow) {
  return { id: r.id, collection: r.collection, data: r.data, createdAt: r.created_at, updatedAt: r.updated_at, createdBy: r.created_by, deleted: Boolean(r.deleted_at) };
}

export const appUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(160),
  role: z.enum(["admin", "member"]).default("member"),
  password: z.string().min(8).max(200).optional(),
  sendEmail: z.boolean().default(false),
});

export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160), password: z.string().min(1).max(200) });
export const passwordChangeSchema = z.object({ current: z.string().min(1).max(200), next: z.string().min(8).max(200) });

/** Contraseña temporal legible (sin caracteres ambiguos), p. ej. «Kp7m-Rx4t-Qz9w». */
export function generatePassword(random: (n: number) => Uint8Array) {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = random(12);
  const chars = [...bytes].map((b) => abc[b % abc.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

/** Nombre de la cookie de sesión de una app (una por proyecto, para que convivan varias apps). */
export function sessionCookieName(projectId: string) {
  return `ideon_app_${projectId.replace(/-/g, "").slice(0, 16)}`;
}

/** ¿El HTML de la versión usa Ideon Data? */
export function usesIdeonData(html: string) {
  return /\bIdeonDB\s*\.\s*ready\s*\(/.test(html);
}

// ------------------------------------------------------------------ Prospección con IA
/** Búsqueda de empresas: qué tipo de negocio y dónde (p. ej. «ferreterías», «Medellín»). */
export const prospectRequestSchema = z.object({
  query: z.string().trim().min(3, "query").max(200, "query"),
  location: z.string().trim().max(120).optional().transform((v) => v || undefined),
  max: z.number().int().min(1).max(20).default(10),
});

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const EMAIL = /^[^\s@<>()[\]",;:]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Teléfono razonable (7 a 15 dígitos), conservando un + inicial. */
export function cleanPhone(v: unknown) {
  const s = clean(v, 40);
  const digits = s.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  return (s.trim().startsWith("+") ? "+" : "") + digits;
}

export function cleanUrl(v: unknown) {
  const s = clean(v, 300);
  if (!s) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch { return ""; }
}

export interface Prospect { empresa: string; sector: string; ciudad: string; direccion: string; telefono: string; whatsapp: string; correo: string; web: string; fuente: string; nota: string }

/**
 * Normaliza lo que devuelve la IA: descarta empresas sin nombre o sin fuente,
 * correos y teléfonos mal formados, perfiles de LinkedIn como fuente y
 * duplicados (misma web o mismo nombre).
 */
export function normalizeProspects(raw: unknown, max: number): Prospect[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" && Array.isArray((raw as { empresas?: unknown }).empresas) ? (raw as { empresas: unknown[] }).empresas : [];
  const out: Prospect[] = [];
  const seen = new Set<string>();
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const empresa = clean(o.empresa ?? o.nombre ?? o.name, 160);
    const fuente = cleanUrl(o.fuente ?? o.source);
    if (!empresa || !fuente || /linkedin\.com/i.test(fuente)) continue;
    const web = cleanUrl(o.web ?? o.website);
    const correo = clean(o.correo ?? o.email, 160).toLowerCase();
    const key = (web ? new URL(web).hostname.replace(/^www\./, "") : empresa.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      empresa, fuente, web,
      sector: clean(o.sector, 80), ciudad: clean(o.ciudad ?? o.city, 80), direccion: clean(o.direccion ?? o.address, 200),
      telefono: cleanPhone(o.telefono ?? o.phone), whatsapp: cleanPhone(o.whatsapp),
      correo: EMAIL.test(correo) ? correo : "",
      nota: clean(o.nota ?? o.note, 240),
    });
    if (out.length >= max) break;
  }
  return out;
}
