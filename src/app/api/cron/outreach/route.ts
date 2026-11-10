import { NextResponse } from "next/server";
import { outreachProjects, runOutreach } from "@/features/appdata/outreach";
import { appAvailable } from "@/features/appdata/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Tarea diaria (Vercel Cron): ejecuta las cadencias de las apps que las tienen activadas. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const fromCron = (req.headers.get("user-agent") ?? "").startsWith("vercel-cron/");
  if (secret ? auth !== `Bearer ${secret}` : !fromCron) return NextResponse.json({ error: { code: "forbidden" } }, { status: 403 });
  const out: Record<string, unknown> = {};
  for (const id of await outreachProjects()) {
    if ((await appAvailable(id)) !== "ok") continue;
    try { out[id] = await runOutreach(id); } catch (e) { out[id] = { error: e instanceof Error ? e.message : String(e) }; }
  }
  return NextResponse.json({ ok: true, projects: out });
}
