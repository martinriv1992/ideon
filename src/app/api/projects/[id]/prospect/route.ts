import { requireProjectMember, json } from "@/lib/api";
import { prospectBalance } from "@/features/appdata/server";
import { remainingSearches } from "@/features/appdata/core";
import { getVersionFile } from "@/features/deploy/serve";

export const dynamic = "force-dynamic";

/** Saldo y precios de la prospección con IA del proyecto (para la tarjeta de Publicar). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireProjectMember(id);
  if ("error" in access) return access.error;
  const { pricing, balance } = await prospectBalance(id);
  const file = access.project.current_version_id ? await getVersionFile(access.project.current_version_id) : null;
  return json({ pricing, balance, remaining: remainingSearches(balance), usesProspect: Boolean(file && /\.prospect\s*\(/.test(file.content)) });
}
