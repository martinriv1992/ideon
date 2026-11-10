import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiProviderName } from "@/lib/ai/provider";
import { billingFromSettings } from "@/features/billing/pricing";
import type {
  AgentRun, Conversation, Deployment, DomainOrder, Message, Subscription, Project, ProjectAsset, ProjectEvent, ProjectImage, ProjectVersion, Proposal, PublishedSite, Specification,
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
  /** Último pedido de dominio (no anulado) y paquete anual hosting + dominio. */
  domainOrder: Omit<DomainOrder, "contact"> | null;
  subscription: Subscription | null;
  /** Vista previa gratuita: cambios incluidos y si el usuario es administrador de la plataforma. */
  freeChanges: number;
  isPlatformAdmin: boolean;
  /** Un administrador de la plataforma viendo el proyecto de un cliente (no es miembro de su organización). */
  adminView: { clientName: string } | null;
  /** Autores de mensajes que son del equipo de Ideonapp (se muestran como «Equipo Ideonapp»). */
  teamAuthorIds: string[];
  /** Paquete anual: cambios incluidos por año, paquetes en venta y moneda de cobro. */
  includedChanges: number;
  changePacks: { qty: number; price: number }[];
  billingCurrency: string;
  /** Revisión manual antes de publicar: ¿activa?, y última solicitud de publicación del proyecto. */
  reviewRequired: boolean;
  publishReview: { id: string; decision: string; note: string | null; versionNumber: number | null; createdAt: string; decidedAt: string | null } | null;
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
  const [{ data: domainOrder }, { data: subscription }, { data: settings }, { data: { user } }] = await Promise.all([
    supabase.from("domain_orders").select("id,organization_id,project_id,payment_id,domain,years,cost_usd,status,vercel_order_id,error,expires_at,created_at,updated_at")
      .eq("project_id", projectId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("subscriptions").select("*").eq("project_id", projectId).eq("plan", "hosting_domain").maybeSingle(),
    supabase.from("platform_settings").select("key,value"),
    supabase.auth.getUser(),
  ]);
  const { data: profile } = user ? await supabase.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle() : { data: null };
  const { data: review } = await supabase.from("approvals").select("id,decision,payload,created_at,decided_at").eq("project_id", projectId).eq("kind", "deploy")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const reviewPayload = (review?.payload ?? {}) as { note?: string; version_number?: number; superseded?: boolean };
  const reviewSetting = (settings ?? []).find((r) => r.key === "publish_review_required")?.value;

  const conversation = conversations?.[0] ?? null;
  let messages: Message[] = [];
  if (conversation) {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(500);
    messages = data ?? [];
  }
  // Equipo de Ideonapp: quién de los autores es administrador y si el que mira es del equipo y no del cliente.
  const admin = createAdminClient();
  const authorIds = [...new Set(messages.filter((m) => m.role === "user" && m.author_id).map((m) => m.author_id as string))];
  const [{ data: team }, { data: membership }, { data: org }] = await Promise.all([
    authorIds.length ? admin.from("profiles").select("id").in("id", authorIds).eq("is_platform_admin", true) : Promise.resolve({ data: [] as { id: string }[] }),
    profile?.is_platform_admin && user ? admin.from("organization_members").select("user_id").eq("organization_id", project.organization_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    profile?.is_platform_admin ? admin.from("organizations").select("name").eq("id", project.organization_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const adminView = profile?.is_platform_admin && !membership ? { clientName: org?.name ?? "—" } : null;

  let activeRun: AgentRun | null = null;
  if (project.active_run_id) {
    const { data } = await supabase.from("agent_runs").select("*").eq("id", project.active_run_id).maybeSingle();
    activeRun = data ?? null;
  }

  return {
    project, conversation, messages, events: events ?? [],
    proposal: proposals?.[0] ?? null, specification: specs?.[0] ?? null, versions: versions ?? [], images: images ?? [], assets: assets ?? [], domainOrder: domainOrder ?? null, subscription: subscription ?? null, freeChanges: billingFromSettings(settings ?? []).freeChanges, isPlatformAdmin: Boolean(profile?.is_platform_admin), adminView, teamAuthorIds: (team ?? []).map((r) => r.id),
    includedChanges: billingFromSettings(settings ?? []).includedChanges, changePacks: billingFromSettings(settings ?? []).changePacks, billingCurrency: billingFromSettings(settings ?? []).currency,
    reviewRequired: reviewSetting !== false && reviewSetting !== "false",
    publishReview: review && !reviewPayload.superseded ? { id: review.id, decision: review.decision, note: reviewPayload.note ?? null, versionNumber: reviewPayload.version_number ?? null, createdAt: review.created_at, decidedAt: review.decided_at } : null,
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
