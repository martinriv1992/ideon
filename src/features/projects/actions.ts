"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { deriveProjectName, slugify } from "@/lib/utils";
import { getCurrentContext } from "@/features/organizations/queries";
import { getPackage } from "@/features/packages/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/features/auth/abuse";

export interface ActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
  /** Solo cuando el formulario trae adjuntos: el cliente los sube y después navega. */
  projectId?: string;
}

const createProjectSchema = z.object({
  name: z.string().trim().max(120).optional(),
  idea: z.string().trim().min(10, "ideaTooShort").max(8000, "ideaTooLong"),
  kind: z.enum(["web", "crm", "inventory", "erp", "dashboard", "portal", "app", "other"]).default("web"),
  package: z.enum(["inventory", "crm", "suite"]).nullable().default(null),
});

export async function createProjectAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name") ?? undefined,
    idea: formData.get("idea"),
    kind: formData.get("kind") ?? "web",
    package: formData.get("package") || null,
  });
  if (!parsed.success) {
    return { fieldErrors: { idea: parsed.error.issues[0]?.message ?? "invalid" } };
  }

  const ctx = await getCurrentContext();
  if (!ctx) return { error: "unauthenticated" };
  const locale = await getLocale();
  const supabase = await createClient();

  // Antiabuso: proyectos nuevos por conexión en 24 h (cada uno puede generar una vista previa con IA).
  // Cubre también las cuentas creadas con Google, que no pasan por el límite de registros.
  const { data: profile } = await supabase.from("profiles").select("is_platform_admin").eq("id", ctx.user.id).maybeSingle();
  if (!profile?.is_platform_admin) {
    const { data: setting } = await createAdminClient().from("platform_settings").select("value").eq("key", "max_projects_per_ip_day").maybeSingle();
    const max = Math.max(1, Math.floor(Number(setting?.value ?? 3)) || 3);
    if (!(await rateLimit("project_create", max, 86_400_000))) {
      return { error: locale === "en"
        ? `You've reached today's limit of ${max} new projects from this connection. Try again tomorrow, or write to us and we'll help you.`
        : `Llegaste al límite de ${max} proyectos nuevos por día desde esta conexión. Inténtalo mañana o escríbenos y te ayudamos.` };
    }
  }

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
      // Un paquete empresarial fija el tipo de solución.
      kind: getPackage(parsed.data.package)?.kind ?? parsed.data.kind,
      package_key: parsed.data.package,
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
    payload: { name, locale, package: parsed.data.package },
  });

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/projects`);
  // Con adjuntos, el navegador los sube antes de abrir el proyecto (así el
  // consultor los tiene desde su primera pregunta).
  if (formData.get("hasAttachments") === "1") return { ok: true, projectId: project.id };
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
