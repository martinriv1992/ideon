import { requireProjectAccess, json, fail, errorResponse } from "@/lib/api";
import { runBuild } from "@/features/agents/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Reintenta la construcción (tras un fallo) o genera una versión nueva desde la especificación. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const { project } = access;
  if (!["approved", "in_development", "review"].includes(project.status)) return fail("invalid_state", "El proyecto no está aprobado para construir", 409);
  if (project.active_run_id) return fail("busy", "Hay una ejecución en curso", 409);
  try {
    await runBuild(id, project.current_version_id ? "Regeneración desde la especificación" : "Primera versión");
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
