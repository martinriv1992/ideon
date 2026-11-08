import { endSession } from "@/features/appdata/server";
import { appJson } from "@/features/appdata/guard";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await endSession(projectId);
  return appJson({ ok: true });
}
