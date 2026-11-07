import { createClient } from "@/lib/supabase/server";
import type { Conversation, Message, Project, ProjectEvent } from "@/types/database.types";

export const ACTIVE_STATUSES = ["approved", "in_development", "review", "ready_to_deploy"] as const;
export const LIVE_STATUSES = ["live", "maintenance"] as const;
export const DRAFT_STATUSES = ["draft", "discovery", "specification", "proposal"] as const;

export async function listProjects(
  organizationId: string,
  filter: "all" | "active" | "archived" = "active",
): Promise<Project[]> {
  const supabase = await createClient();
  let query = supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (filter === "active") query = query.is("archived_at", null);
  if (filter === "archived") query = query.not("archived_at", "is", null);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface ProjectDetail {
  project: Project;
  conversation: Conversation | null;
  messages: Message[];
  events: ProjectEvent[];
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const [{ data: conversations }, { data: events }] = await Promise.all([
    supabase
      .from("conversations")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("project_events")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const conversation = conversations?.[0] ?? null;
  let messages: Message[] = [];
  if (conversation) {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(500);
    messages = data ?? [];
  }

  return { project, conversation, messages, events: events ?? [] };
}

export function projectStats(projects: Project[]) {
  const visible = projects.filter((p) => !p.archived_at);
  return {
    all: visible.length,
    active: visible.filter((p) => (ACTIVE_STATUSES as readonly string[]).includes(p.status)).length,
    live: visible.filter((p) => (LIVE_STATUSES as readonly string[]).includes(p.status)).length,
    draft: visible.filter((p) => (DRAFT_STATUSES as readonly string[]).includes(p.status)).length,
  };
}
