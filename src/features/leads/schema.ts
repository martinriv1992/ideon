import { z } from "zod";

/**
 * Captación comercial (módulo puro, compartido por cliente y servidor).
 * Las etiquetas visibles viven en messages/{es,en}.json → site.lead.*
 */

export const SOLUTIONS = ["inventory", "crm", "business", "custom", "ai", "web", "automation", "other"] as const;
export const BUDGETS = ["lt1k", "1k-3k", "3k-10k", "gt10k", "unknown"] as const;
export const TIMEFRAMES = ["asap", "1-3m", "3-6m", "exploring"] as const;
export const STAGES = ["new", "researched", "contacted", "interested", "meeting", "proposal", "negotiation", "won", "lost"] as const;
export type LeadStage = (typeof STAGES)[number];

/** Parámetros de campaña que se guardan con el lead (primer contacto). */
export const ATTRIBUTION_KEYS = ["source", "medium", "campaign", "term", "content", "referrer", "landing_page"] as const;
export type Attribution = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

const short = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

/** Formulario público. Los mensajes de error son claves de traducción (site.lead.errors.*). */
export const leadSchema = z.object({
  fullName: z.string().trim().min(2, "name").max(120, "name"),
  company: z.string().trim().min(1, "company").max(160, "company"),
  email: z.string().trim().toLowerCase().email("email").max(160, "email"),
  country: z.string().trim().min(2, "country").max(60, "country"),
  website: z.string().trim().max(200).optional().transform((v) => v || undefined)
    .refine((v) => !v || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v), "website"),
  solution: z.enum(SOLUTIONS, { message: "solution" }),
  problem: z.string().trim().min(20, "problem").max(4000, "problem"),
  budget: z.enum(BUDGETS).optional(),
  timeframe: z.enum(TIMEFRAMES, { message: "timeframe" }),
  consent: z.literal(true, { message: "consent" }),
  wantsMeeting: z.boolean().default(false),
  locale: z.enum(["es", "en"]).default("es"),
  attribution: z.object(Object.fromEntries(ATTRIBUTION_KEYS.map((k) => [k, short(500)])) as Record<(typeof ATTRIBUTION_KEYS)[number], ReturnType<typeof short>>).partial().default({}),
  /** Antispam: campo trampa (debe venir vacío) y tiempo desde que se abrió el formulario. */
  hp: z.string().max(200).optional(),
  elapsedMs: z.number().int().nonnegative().optional(),
});
export type LeadInput = z.input<typeof leadSchema>;

/** ¿Parece un envío automático? (campo trampa relleno o enviado en menos de 3 s). */
export function looksLikeSpam(input: { hp?: string; elapsedMs?: number }) {
  return Boolean(input.hp && input.hp.trim()) || (input.elapsedMs != null && input.elapsedMs < 3000);
}

/** Gestión del fundador desde el backoffice. */
export const leadUpdateSchema = z.object({
  stage: z.enum(STAGES),
  estimatedValue: z.union([z.number().nonnegative(), z.null()]).optional(),
  estimatedCurrency: z.string().trim().length(3).toUpperCase().optional().or(z.literal("").transform(() => undefined)),
  lastContactAt: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
  nextFollowUpAt: z.string().optional().transform((v) => (v ? new Date(v).toISOString() : null)),
  notes: z.string().max(10000).optional().transform((v) => v ?? null),
});

/** Seguimiento vencido: hay fecha de próximo contacto ya pasada y el lead sigue abierto. */
export function isOverdue(lead: { stage: string; next_follow_up_at: string | null }, now = new Date()) {
  return lead.stage !== "won" && lead.stage !== "lost" && Boolean(lead.next_follow_up_at) && new Date(lead.next_follow_up_at!) < now;
}

/** CSV seguro para hojas de cálculo (comillas escapadas y sin inyección de fórmulas). */
export function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const cell = (v: unknown) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [columns.join(","), ...rows.map((r) => columns.map((c) => cell(r[c])).join(","))].join("\n");
}
