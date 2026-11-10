import { appFail, appJson, guardApp } from "@/features/appdata/guard";
import { runOutreach } from "@/features/appdata/outreach";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «Ejecutar ahora» desde el CRM (solo administradores de la app). */
export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  if (g.user.role !== "admin") return appFail("forbidden", 403);
  try { return appJson({ summary: await runOutreach(projectId, { force: false }) }); }
  catch (e) { return appJson({ error: { code: "outreach_failed", detail: e instanceof Error ? e.message : String(e) } }, 500); }
}
