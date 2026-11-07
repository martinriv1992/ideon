import { z } from "zod";
import { requireProjectAccess, json, fail, errorResponse } from "@/lib/api";
import { handleUserMessage } from "@/features/agents/orchestrator";

export const maxDuration = 300; // los agentes pueden tardar minutos (Vercel Fluid / Pro)
export const dynamic = "force-dynamic";

const schema = z.object({ content: z.string().trim().min(1).max(20000) });

/** Registra un mensaje del cliente y ejecuta el agente que corresponda. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Mensaje no válido");
  const { supabase, user, project } = access;
  if (project.active_run_id) return fail("busy", "Hay una ejecución en curso", 409);

  const { data: conv } = await supabase.from("conversations").select("id").eq("project_id", id).order("created_at").limit(1);
  if (!conv?.[0]) return fail("invalid_state", "El proyecto no tiene conversación", 409);
  const { error } = await supabase.from("messages").insert({ conversation_id: conv[0].id, role: "user", content: body.data.content, author_id: user.id });
  if (error) return fail("db", error.message, 500);
  await supabase.from("project_events").insert({ project_id: id, actor_id: user.id, actor_type: "user", type: "message.sent", payload: { length: body.data.content.length } });

  try {
    await handleUserMessage(id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
