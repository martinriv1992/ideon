import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { appAiRequestSchema, parseJsonLoose } from "@/features/appdata/core";
import { appFail, appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * IA para las apps publicadas (db.ai / db.ai.json del SDK): solo usuarios con sesión.
 * «quick» usa Haiku 5.5 y «default» Sonnet 5.5. Tope diario de llamadas por app
 * (`app_ai_daily_limit` en Ajustes, por defecto 100). El coste se registra en ai_usage.
 */
const MODELS = {
  quick: { model: "claude-haiku-5-5", in: 0.1, out: 0.5 },
  default: { model: "claude-sonnet-5-5", in: 2, out: 10 },
} as const;
const DEFAULT_DAILY = 100;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

export async function POST(req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const body = appAiRequestSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) return appFail("invalid", 400);
  if (!process.env.ANTHROPIC_API_KEY) return appFail("not_configured", 503);

  const db = createAdminClient();
  const [{ data: setting }, { count }] = await Promise.all([
    db.from("platform_settings").select("value").eq("key", "app_ai_daily_limit").maybeSingle(),
    db.from("rate_limits").select("id", { count: "exact", head: true }).eq("bucket", "app_ai").eq("ip_hash", projectId)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString()),
  ]);
  const limit = Number(setting?.value ?? DEFAULT_DAILY);
  if ((count ?? 0) >= (Number.isFinite(limit) ? limit : DEFAULT_DAILY)) return appFail("ai_limit", 429);
  const { data: slot } = await db.from("rate_limits").insert({ bucket: "app_ai", ip_hash: projectId }).select("id").single();

  const m = MODELS[body.data.tier];
  const system = [
    body.data.system,
    body.data.json ? "Responde SOLO con JSON válido, sin texto antes ni después y sin bloques de código." : undefined,
  ].filter(Boolean).join("\n") || undefined;
  try {
    // Igual que los agentes: en streaming, y sin razonamiento solo en Haiku (rápido y barato).
    const res = await getClient().messages.stream({
      model: m.model, max_tokens: 8000, system,
      ...(body.data.tier === "quick" ? { thinking: { type: "disabled" as const } } : { output_config: { effort: "low" as const } }),
      messages: [{ role: "user", content: body.data.prompt }],
    }).finalMessage();
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    const input = res.usage.input_tokens, output = res.usage.output_tokens;
    const { data: project } = await db.from("projects").select("organization_id").eq("id", projectId).single();
    if (project) await db.from("ai_usage").insert({ organization_id: project.organization_id, project_id: projectId, provider: "anthropic", model: m.model, input_tokens: input, output_tokens: output, cost_usd: Number(((input * m.in + output * m.out) / 1e6).toFixed(6)) });
    if (!body.data.json) return appJson({ text });
    const json = parseJsonLoose(text);
    if (json === undefined) return appFail("ai_bad_json", 502);
    return appJson({ json });
  } catch (e) {
    const detail = e instanceof Error ? e.message.slice(0, 300) : String(e);
    console.error("app ai failed", projectId, detail);
    if (slot) await db.from("rate_limits").delete().eq("id", slot.id);
    // El motivo ayuda a diagnosticar (no contiene secretos: es el mensaje de la API de IA).
    return appJson({ error: { code: "ai_failed", detail } }, 502);
  }
}
