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
});

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name") ?? undefined,
    idea: formData.get("idea"),
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

const sendMessageSchema = z.object({
  projectId: z.string().uuid(),
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1).max(20000),
});

export async function sendMessageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };

  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const supabase = await createClient();

  const { error } = await supabase.from("messages").insert({
    conversation_id: parsed.data.conversationId,
    role: "user",
    content: parsed.data.content,
    author_id: ctx.user.id,
  });
  if (error) return { error: error.message };

  await supabase.from("project_events").insert({
    project_id: parsed.data.projectId,
    actor_id: ctx.user.id,
    actor_type: "user",
    type: "message.sent",
    payload: { length: parsed.data.content.length },
  });

  // Fase 2: aquí se encola la ejecución del agente consultor (agent_runs).

  const locale = await getLocale();
  revalidatePath(`/${locale}/projects/${parsed.data.projectId}`);
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
