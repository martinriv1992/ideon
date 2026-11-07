import { createClient } from "@/lib/supabase/server";
import { aiProviderName } from "@/lib/ai/provider";
import type {
  AgentRun, Conversation, Deployment, Message, Project, ProjectAsset, ProjectEvent, ProjectImage, ProjectVersion, Proposal, PublishedSite, Specification,
} from "@/types/database.types";

export const ACTIVE_STATUSES = ["approved", "in_development", "review", "ready_to_deploy"] as const;
export const LIVE_STATUSES = ["live", "maintenance"] as const;
export const DRAFT_STATUSES = ["draft", "discovery", "specification", "proposal"] as const;

export async function listProjects(organizationId: string, filter: "all" | "active" | "archived" = "active"): Promise<Project[]> {
  const supabase = await createClient();
  let query = supabase.from("projects").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false });
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
  proposal: Proposal | null;
  specification: Specification | null;
  versions: ProjectVersion[];
  images: ProjectImage[];
  /** Archivos del proyecto (sin el texto extraído, que solo usan los agentes). */
  assets: Omit<ProjectAsset, "text_content">[];
  deployments: Deployment[];
  site: PublishedSite | null;
  activeRun: AgentRun | null;
  aiConfigured: boolean;
  vercelConfigured: boolean;
  stripeConfigured: boolean;
  payments: { id: string; status: string; amount: number; currency: string; proposal_id: string | null }[];
  siteBaseUrl: string;
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetail | null> {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return null;

  const [{ data: conversations }, { data: events }, { data: proposals }, { data: specs }, { data: versions }, { data: images }, { data: deployments }, { data: site }] = await Promise.all([
    supabase.from("conversations").select("*").eq("project_id", projectId).order("created_at", { ascending: true }).limit(1),
    supabase.from("project_events").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(60),
    supabase.from("proposals").select("*").eq("project_id", projectId).in("status", ["sent", "approved"]).order("created_at", { ascending: false }).limit(1),
    supabase.from("specifications").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1),
    supabase.from("project_versions").select("*").eq("project_id", projectId).order("number", { ascending: false }).limit(50),
    supabase.from("project_images").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("deployments").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(20),
    supabase.from("published_sites").select("*").eq("project_id", projectId).maybeSingle(),
  ]);
  const { data: assets } = await supabase.from("project_assets")
    .select("id,project_id,name,label,storage_path,mime,size,use_reference,use_site,text_chars,extract_status,created_by,created_at")
    .eq("project_id", projectId).order("created_at", { ascending: true });

  const conversation = conversations?.[0] ?? null;
  let messages: Message[] = [];
  if (conversation) {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(500);
    messages = data ?? [];
  }
  let activeRun: AgentRun | null = null;
  if (project.active_run_id) {
    const { data } = await supabase.from("agent_runs").select("*").eq("id", project.active_run_id).maybeSingle();
    activeRun = data ?? null;
  }

  return {
    project, conversation, messages, events: events ?? [],
    proposal: proposals?.[0] ?? null, specification: specs?.[0] ?? null, versions: versions ?? [], images: images ?? [], assets: assets ?? [],
    deployments: deployments ?? [], site: site ?? null, activeRun,
    aiConfigured: aiProviderName() !== null,
    vercelConfigured: Boolean(process.env.VERCEL_TOKEN),
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    payments: (await supabase.from("payments").select("id,status,amount,currency,proposal_id").eq("project_id", projectId).order("created_at", { ascending: false }).limit(10)).data ?? [],
    siteBaseUrl: (process.env.NEXT_PUBLIC_SITE_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, ""),
  };
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
