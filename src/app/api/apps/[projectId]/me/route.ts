import { appJson, guardApp } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

/** Sesión actual (401 si hay que iniciar sesión). */
export async function GET(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const g = await guardApp(projectId, true);
  if ("error" in g) return g.error;
  const { id, name, email, role } = g.user;
  return appJson({ user: { id, name, email, role } });
}
