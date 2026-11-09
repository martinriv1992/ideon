import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeProspects, type Prospect } from "./core";

/**
 * Prospección con IA para los CRM de los clientes: Claude busca en la web
 * empresas que encajan con lo pedido y recoge sus datos de contacto
 * corporativos publicados (web oficial, directorios de empresas), citando la
 * fuente de cada una. No usa LinkedIn ni redes sociales como fuente.
 *
 * Modelo: fila `prospect` de model_policies si existe; si no, Claude Opus 5.5.
 * Coste: tokens + búsquedas web (10 USD por 1.000) y lecturas de páginas; se registra en ai_usage.
 */

const DEFAULT_MODEL = "claude-opus-5-5";
const BLOCKED = ["linkedin.com", "instagram.com", "facebook.com", "tiktok.com", "x.com", "twitter.com"];
const PRICE: Record<string, { in: number; out: number }> = {
  "claude-opus-5-5": { in: 4, out: 20 },
  "claude-sonnet-5-5": { in: 2, out: 10 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5 },
};

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));

const SYSTEM = `Eres un investigador comercial B2B. Encuentras empresas REALES que encajan con lo que pide el usuario y reúnes sus datos de contacto corporativos.
Método: usa la búsqueda web (varias consultas si hace falta) y abre la web oficial de cada empresa o un directorio público de empresas para confirmar los datos.
Reglas:
- Solo datos de contacto del NEGOCIO publicados por la propia empresa o por directorios públicos de empresas: correo comercial o genérico, teléfono, WhatsApp, web y dirección. No incluyas datos personales de particulares ni perfiles de LinkedIn o redes sociales.
- No inventes nada: si no encuentras un dato, déjalo vacío (""). Cada empresa debe llevar en "fuente" la URL exacta donde verificaste sus datos.
- Empresas distintas, activas y de la zona pedida.
Responde SOLO con un JSON, sin texto antes ni después:
{"empresas":[{"empresa":"","sector":"","ciudad":"","direccion":"","telefono":"","whatsapp":"","correo":"","web":"","fuente":"","nota":"una frase útil para el vendedor"}]}`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{"); const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(body.slice(start, end + 1)); } catch { return null; }
}

async function modelFor() {
  const { data } = await createAdminClient().from("model_policies").select("model").eq("task", "prospect").maybeSingle();
  return data?.model || DEFAULT_MODEL;
}

export interface ProspectResult { results: Prospect[]; model: string; searches: number; fetches: number; costUsd: number }

export async function prospect(args: { query: string; location?: string; max: number; locale: string }): Promise<ProspectResult> {
  const model = await modelFor();
  const user = `Busca hasta ${args.max} empresas: ${args.query}${args.location ? ` en ${args.location}` : ""}.${args.locale === "en" ? " Write the «nota» field in English." : ""}`;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
  let input = 0, output = 0, searches = 0, fetches = 0, text = "";
  let withFetch = true;
  const call = () => getClient().messages.stream({
    model, max_tokens: 16000, system: SYSTEM, messages,
    output_config: { effort: "medium" },
    tools: withFetch
      ? [{ type: "web_search_20260209", name: "web_search", max_uses: 8, blocked_domains: BLOCKED }, { type: "web_fetch_20260209", name: "web_fetch", max_uses: 10, blocked_domains: BLOCKED }]
      : [{ type: "web_search_20260209", name: "web_search", max_uses: 8, blocked_domains: BLOCKED }],
  }).finalMessage();
  // Las herramientas del servidor pueden pausar el turno (pause_turn): se reenvía para que continúe.
  for (let i = 0; i < 4; i++) {
    let res: Anthropic.Message;
    try { res = await call(); }
    catch (e) {
      // Si la cuenta o el entorno no permiten leer páginas (web_fetch), se busca solo con web_search.
      if (withFetch && e instanceof Anthropic.BadRequestError && /web_fetch/i.test(e.message)) { withFetch = false; res = await call(); }
      else throw e;
    }
    input += res.usage.input_tokens + (res.usage.cache_read_input_tokens ?? 0) + (res.usage.cache_creation_input_tokens ?? 0);
    output += res.usage.output_tokens;
    searches += res.usage.server_tool_use?.web_search_requests ?? 0;
    fetches += res.usage.server_tool_use?.web_fetch_requests ?? 0;
    if (res.stop_reason === "refusal") throw Object.assign(new Error("La búsqueda fue rechazada."), { code: "refusal" });
    text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  const price = PRICE[model] ?? PRICE[DEFAULT_MODEL];
  const costUsd = (input * price.in + output * price.out) / 1e6 + searches * 0.01;
  return { results: normalizeProspects(extractJson(text), args.max), model, searches, fetches, costUsd };
}
