import { z } from "zod";
import { requireProjectAccess, json, fail, errorResponse } from "@/lib/api";
import { approveProposal } from "@/features/agents/orchestrator";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** El cliente aprueba la propuesta: arranca la construcción. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const body = z.object({ proposalId: z.string().uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Propuesta no válida");
  try {
    await approveProposal(id, body.data.proposalId, access.user.id);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
