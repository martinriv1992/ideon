import { notFound } from "next/navigation";
import { z } from "zod";
import { getProjectDetail } from "@/features/projects/queries";
import { Workspace } from "@/components/workspace/workspace";

export default async function ProjectWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  // RLS garantiza que solo se devuelven proyectos de la organización del usuario.
  const detail = await getProjectDetail(id);
  if (!detail) notFound();

  return <Workspace detail={detail} />;
}
