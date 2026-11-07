import { after } from "next/server";
import { headers } from "next/headers";
import { json, fail } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientIpHash, rateLimit } from "@/features/auth/abuse";
import { leadSchema, looksLikeSpam } from "@/features/leads/schema";
import { notifyNewLead } from "@/features/leads/notify";

export const dynamic = "force-dynamic";

/** Formulario de contacto comercial (público): valida, filtra spam, guarda y avisa al fundador. */
export async function POST(req: Request) {
  const parsed = leadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    // Mensajes como claves de traducción (site.lead.errors.*); un campo ausente usa la clave de su campo.
    const KEYS = new Set(["name", "company", "email", "country", "website", "solution", "problem", "timeframe", "consent"]);
    const fields = Object.fromEntries(parsed.error.issues.map((i) => {
      const f = String(i.path[0] ?? "form");
      const fallback = f === "fullName" ? "name" : KEYS.has(f) ? f : "generic";
      return [f, KEYS.has(i.message) ? i.message : fallback];
    }));
    return NextResponseInvalid(fields);
  }
  const d = parsed.data;
  // Envío automático: respondemos como si fuera correcto para no dar pistas, pero no se guarda.
  if (looksLikeSpam(d)) return json({ ok: true });
  if (!(await rateLimit("lead", 5, 3_600_000))) return fail("rate_limited", "too_many", 429);

  const h = await headers();
  const a = d.attribution;
  const db = createAdminClient();
  const { data: lead, error } = await db.from("leads").insert({
    full_name: d.fullName, company: d.company, email: d.email, country: d.country, website: d.website ?? null,
    solution: d.solution, problem: d.problem, budget: d.budget ?? null, timeframe: d.timeframe, locale: d.locale,
    consent: d.consent, wants_meeting: d.wantsMeeting,
    source: a.source ?? null, medium: a.medium ?? null, campaign: a.campaign ?? null, term: a.term ?? null, content: a.content ?? null,
    referrer: a.referrer ?? h.get("referer")?.slice(0, 500) ?? null, landing_page: a.landing_page ?? null,
    ip_hash: await clientIpHash(),
  }).select("*").single();
  if (error || !lead) return fail("db", "save_failed", 500);

  after(async () => {
    const r = await notifyNewLead(lead);
    if (r === "sent") await createAdminClient().from("leads").update({ notified_at: new Date().toISOString() }).eq("id", lead.id);
  });
  return json({ ok: true, id: lead.id });
}

function NextResponseInvalid(fields: Record<string, string>) {
  return Response.json({ error: { code: "invalid", message: "invalid", fields } }, { status: 400 });
}
