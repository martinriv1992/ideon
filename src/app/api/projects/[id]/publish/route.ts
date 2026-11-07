import { z } from "zod";
import { requireProjectAccess, requireUnlocked, json, fail, errorResponse } from "@/lib/api";
import { publishProject } from "@/features/deploy/publish";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Publica la versión actual (o la indicada) en Ideon o Vercel. La llamada del cliente es la autorización. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const locked = await requireUnlocked(access);
  if (locked) return locked;
  const body = z.object({ target: z.enum(["ideon", "vercel"]).default("ideon"), slug: z.string().max(40).optional(), versionId: z.string().uuid().optional() }).safeParse(await req.json().catch(() => ({})));
  if (!body.success) return fail("invalid", "Parámetros no válidos");
  try {
    return json(await publishProject(id, access.user.id, body.data));
  } catch (e) {
    return errorResponse(e);
  }
}
