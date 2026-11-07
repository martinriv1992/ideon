"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveProjectName, slugify } from "@/lib/utils";
import { getCurrentContext } from "@/features/organizations/queries";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

const createProjectSchema = z.object({
  name: z.string().trim().max(120).optional(),
  idea: z.string().trim().min(10, "ideaTooShort").max(8000, "ideaTooLong"),
  kind: z.enum(["web", "crm", "inventory", "erp", "dashboard", "portal", "app", "other"]).default("web"),
});

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name") ?? undefined,
    idea: formData.get("idea"),
    kind: formData.get("kind") ?? "web",
  });
  if (!parsed.success) {
    return { fieldErrors: { idea: parsed.error.issues[0]?.message ?? "invalid" } };
  }

  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const locale = await getLocale();
  const supabase = await createClient();

  const name = parsed.data.name || deriveProjectName(parsed.data.idea, locale === "en" ? "New project" : "Nuevo proyecto");
  const slug = `${slugify(name) || "proyecto"}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      organization_id: ctx.organization.id,
      created_by: ctx.user.id,
      name,
      slug,
      initial_idea: parsed.data.idea,
      kind: parsed.data.kind,
      locale,
      status: "draft",
    })
    .select("*")
    .single();
  if (error || !project) return { error: error?.message ?? "insert_failed" };

  // Conversación inicial con el consultor + primer mensaje del usuario
  const { data: conversation } = await supabase
    .from("conversations")
    .insert({ project_id: project.id, agent_type: "consultant", title: name })
    .select("*")
    .single();

  if (conversation) {
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      role: "user",
      content: parsed.data.idea,
      author_id: ctx.user.id,
    });
  }

  await supabase.from("project_events").insert({
    project_id: project.id,
    actor_id: ctx.user.id,
    actor_type: "user",
    type: "project.created",
    payload: { name, locale },
  });

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/projects`);
  redirect({ href: `/projects/${project.id}`, locale });
  return { ok: true };
}

export async function setCurrentVersionAction(projectId: string, versionId: string) {
  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const supabase = await createClient();
  const { data: v } = await supabase.from("project_versions").select("id,number").eq("id", versionId).eq("project_id", projectId).maybeSingle();
  if (!v) return { error: "not_found" };
  const { error } = await supabase.from("projects").update({ current_version_id: versionId }).eq("id", projectId);
  if (error) return { error: error.message };
  await supabase.from("project_events").insert({ project_id: projectId, actor_id: ctx.user.id, actor_type: "user", type: "version.restored", payload: { number: v.number } });
  const locale = await getLocale();
  revalidatePath(`/${locale}/projects/${projectId}`);
  return { ok: true };
}

export async function setProjectArchivedAction(projectId: string, archived: boolean) {
  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId);
  if (error) return { error: error.message };

  await supabase.from("project_events").insert({
    project_id: projectId,
    actor_id: ctx.user.id,
    actor_type: "user",
    type: archived ? "project.archived" : "project.restored",
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/projects/${projectId}`);
  revalidatePath(`/${locale}/projects`);
  revalidatePath(`/${locale}/dashboard`);
  return { ok: true };
}
