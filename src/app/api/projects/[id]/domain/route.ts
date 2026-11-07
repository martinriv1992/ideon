import { z } from "zod";
import { requireProjectAccess, json, fail, errorResponse } from "@/lib/api";
import { removeCustomDomain, setCustomDomain, verifyCustomDomain } from "@/features/deploy/publish";

export const dynamic = "force-dynamic";

/** Dominio propio: POST {domain} lo asocia; PUT lo verifica por DNS; DELETE lo quita. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  const body = z.object({ domain: z.string().min(4).max(253) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Dominio no válido");
  try { return json(await setCustomDomain(id, access.user.id, body.data.domain)); } catch (e) { return errorResponse(e); }
}
export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  try { return json(await verifyCustomDomain(id)); } catch (e) { return errorResponse(e); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectAccess(id);
  if ("error" in access) return access.error;
  try { await removeCustomDomain(id); return json({ ok: true }); } catch (e) { return errorResponse(e); }
}
