import { requireProjectAccess, json, fail, errorResponse } from "@/lib/api";
import { runConsultant } from "@/features/agents/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Arranca el consultor sobre la idea inicial (primer turno, sin mensaje nuevo). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const { project, supabase } = access;
  if (project.active_run_id) return fail("busy", "Hay una ejecución en curso", 409);
  if (!["draft", "discovery"].includes(project.status)) return fail("invalid_state", "El proyecto ya avanzó", 409);
  const { data: conv } = await supabase.from("conversations").select("id").eq("project_id", id).limit(1);
  const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv?.[0]?.id ?? "").eq("role", "assistant");
  if ((count ?? 0) > 0) return fail("invalid_state", "El consultor ya respondió", 409);
  try { await runConsultant(id); return json({ ok: true }); } catch (e) { return errorResponse(e); }
}
