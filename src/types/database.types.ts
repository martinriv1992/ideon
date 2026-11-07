/**
 * Tipos de la base de datos (Fase 1). Mantener sincronizado con
 * `supabase/migrations`. Cuando el proyecto Supabase exista, regenerar con:
 *   npx supabase gen types typescript --project-id <id> > src/types/database.types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type OrgRole = "owner" | "admin" | "member" | "viewer";
export type OrgType = "personal" | "company";
export type ProjectStatus =
  | "draft"
  | "discovery"
  | "specification"
  | "proposal"
  | "approved"
  | "in_development"
  | "review"
  | "ready_to_deploy"
  | "live"
  | "maintenance"
  | "on_hold"
  | "cancelled";
export type ProjectComplexity = "starter" | "pro" | "custom";
export type AgentType =
  | "consultant"
  | "architect"
  | "designer"
  | "developer"
  | "qa"
  | "deploy";
export type ConversationStatus = "open" | "closed";
export type MessageRole = "user" | "assistant" | "system" | "tool";
export type ActorType = "user" | "agent" | "system";
export type ProjectKind = "web" | "crm" | "inventory" | "erp" | "dashboard" | "portal" | "app" | "other";
export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type ProposalStatus = "draft" | "sent" | "approved" | "rejected" | "expired";
export type DeploymentStatus = "pending" | "building" | "live" | "failed" | "rolled_back";
export type DeploymentTarget = "ideon" | "vercel";
export type ApprovalKind = "deploy" | "custom_domain" | "external_integration" | "spend_over_limit";
export type ApprovalDecision = "pending" | "approved" | "rejected";
export type PaymentProvider = "stripe" | "wompi" | "manual" | "epayco";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";
export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

type Row<T> = T;
type Insert<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  locale: string;
  is_platform_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  country: string | null;
  tax_id: string | null;
  billing_email: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationMember = {
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};

export type SolutionCategory = {
  key: string;
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type PricingPlan = {
  key: string;
  name_es: string;
  name_en: string;
  description_es: string | null;
  description_en: string | null;
  price_from: number | null;
  currency: string;
  features: Json;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};

export type Project = {
  id: string;
  organization_id: string;
  created_by: string | null;
  name: string;
  slug: string;
  initial_idea: string;
  category_key: string | null;
  status: ProjectStatus;
  complexity: ProjectComplexity | null;
  locale: string;
  archived_at: string | null;
  kind: ProjectKind;
  brief: Json | null;
  current_version_id: string | null;
  active_run_id: string | null;
  /** Pago de lanzamiento confirmado: fin de la vista previa gratuita. */
  paid_at: string | null;
  free_changes_used: number;
  /** Paquete empresarial del que parte el proyecto (inventory | crm | suite). */
  package_key: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRun = { id: string; project_id: string; conversation_id: string | null; agent_type: AgentType; step: string; provider: string; model: string | null; status: RunStatus; input: Json | null; output: Json | null; error: string | null; input_tokens: number; output_tokens: number; cost_usd: number; started_at: string | null; finished_at: string | null; created_at: string };
export type AiUsage = { id: number; organization_id: string; project_id: string | null; run_id: string | null; provider: string; model: string; input_tokens: number; output_tokens: number; cost_usd: number; created_at: string };
export type ModelPolicyRow = { task: string; provider: string; model: string; max_output_tokens: number; input_cost_per_mtok: number; output_cost_per_mtok: number; updated_at: string };
export type Specification = { id: string; project_id: string; version: number; content: Json; run_id: string | null; created_at: string };
export type Proposal = { id: string; project_id: string; specification_id: string | null; plan_key: string | null; complexity: ProjectComplexity; title: string; summary: string | null; items: Json; estimated_days: number | null; price: number | null; currency: string; external_costs: Json; maintenance_option: Json | null; status: ProposalStatus; approved_by: string | null; approved_at: string | null; created_at: string };
export type ProjectVersion = { id: string; project_id: string; number: number; summary: string | null; run_id: string | null; qa_report: Json | null; created_at: string };
export type ProjectFile = { id: string; version_id: string; path: string; content: string; content_type: string; size: number };
export type DomainOrderStatus = "awaiting_payment" | "purchasing" | "configuring" | "active" | "failed" | "cancelled";
export type DomainOrder = { id: string; organization_id: string; project_id: string; payment_id: string | null; domain: string; years: number; cost_usd: number; status: DomainOrderStatus; vercel_order_id: string | null; contact: Json; error: string | null; expires_at: string | null; created_at: string; updated_at: string };
export type ProjectAsset = { id: string; project_id: string; name: string; label: string; storage_path: string; mime: string; size: number; use_reference: boolean; use_site: boolean; text_content: string | null; text_chars: number; extract_status: "none" | "ok" | "empty" | "failed" | "unsupported"; created_by: string | null; created_at: string };
export type ProjectImage = { id: string; project_id: string; label: string; storage_path: string; width: number | null; height: number | null; size: number | null; created_by: string | null; created_at: string };
export type Approval = { id: string; project_id: string; kind: ApprovalKind; payload: Json; decision: ApprovalDecision; requested_by: string | null; decided_by: string | null; decided_at: string | null; created_at: string };
export type Deployment = { id: string; project_id: string; version_id: string; target: DeploymentTarget; status: DeploymentStatus; slug: string | null; url: string | null; external_id: string | null; logs: string | null; approval_id: string | null; created_by: string | null; created_at: string; finished_at: string | null };
export type PublishedSite = { project_id: string; slug: string; version_id: string; custom_domain: string | null; domain_status: string | null; domain_verification: Json | null; published_at: string; updated_at: string };
export type Payment = { id: string; organization_id: string; project_id: string | null; proposal_id: string | null; provider: PaymentProvider; external_id: string | null; amount: number; currency: string; status: PaymentStatus; metadata: Json; created_at: string; paid_at: string | null };
export type Lead = {
  id: string; full_name: string; company: string; email: string; country: string; website: string | null; solution: string; problem: string;
  budget: string | null; timeframe: string; locale: string; consent: boolean; wants_meeting: boolean;
  source: string | null; medium: string | null; campaign: string | null; term: string | null; content: string | null; referrer: string | null; landing_page: string | null;
  stage: string; estimated_value: number | null; estimated_currency: string | null; last_contact_at: string | null; next_follow_up_at: string | null; notes: string | null;
  ip_hash: string | null; notified_at: string | null; created_at: string; updated_at: string;
};
export type Subscription = { id: string; organization_id: string; project_id: string | null; provider: PaymentProvider; external_id: string | null; plan: string; amount: number; currency: string; period: string; status: SubscriptionStatus; current_period_end: string | null; domain: string | null; renewal_amount: number | null; changes_used: number; extra_changes: number; created_at: string };
export type Invoice = { id: string; organization_id: string; payment_id: string | null; number: string; amount: number; currency: string; issued_at: string; pdf_url: string | null };
export type SupportTicket = { id: string; organization_id: string; project_id: string | null; created_by: string | null; subject: string; body: string; status: TicketStatus; created_at: string; updated_at: string };
export type PlatformSetting = { key: string; value: Json; updated_at: string };

export type Conversation = {
  id: string;
  project_id: string;
  title: string | null;
  agent_type: AgentType;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  content_json: Json | null;
  author_id: string | null;
  agent_type: AgentType | null;
  token_usage: Json | null;
  created_at: string;
};

export type ProjectEvent = {
  id: number;
  project_id: string;
  actor_id: string | null;
  actor_type: ActorType;
  type: string;
  payload: Json;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Row<Profile>;
        Insert: Insert<Profile, "full_name" | "avatar_url" | "locale" | "is_platform_admin" | "created_at" | "updated_at">;
        Update: Partial<Profile>;
        Relationships: [];
      };
      organizations: {
        Row: Row<Organization>;
        Insert: Insert<Organization, "id" | "type" | "country" | "tax_id" | "billing_email" | "created_by" | "created_at" | "updated_at">;
        Update: Partial<Organization>;
        Relationships: [];
      };
      organization_members: {
        Row: Row<OrganizationMember>;
        Insert: Insert<OrganizationMember, "role" | "created_at">;
        Update: Partial<OrganizationMember>;
        Relationships: [];
      };
      solution_categories: {
        Row: Row<SolutionCategory>;
        Insert: Insert<SolutionCategory, "description_es" | "description_en" | "icon" | "sort_order" | "is_active">;
        Update: Partial<SolutionCategory>;
        Relationships: [];
      };
      pricing_plans: {
        Row: Row<PricingPlan>;
        Insert: Insert<PricingPlan, "description_es" | "description_en" | "price_from" | "currency" | "features" | "is_active" | "sort_order" | "updated_at">;
        Update: Partial<PricingPlan>;
        Relationships: [];
      };
      projects: {
        Row: Row<Project>;
        Insert: Insert<Project, "id" | "created_by" | "category_key" | "status" | "complexity" | "locale" | "archived_at" | "kind" | "brief" | "current_version_id" | "active_run_id" | "paid_at" | "free_changes_used" | "package_key" | "created_at" | "updated_at">;
        Update: Partial<Project>;
        Relationships: [];
      };
      conversations: {
        Row: Row<Conversation>;
        Insert: Insert<Conversation, "id" | "title" | "agent_type" | "status" | "created_at" | "updated_at">;
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: Row<Message>;
        Insert: Insert<Message, "id" | "content_json" | "author_id" | "agent_type" | "token_usage" | "created_at">;
        Update: Partial<Message>;
        Relationships: [];
      };
      project_events: {
        Row: Row<ProjectEvent>;
        Insert: Insert<ProjectEvent, "id" | "actor_id" | "actor_type" | "payload" | "created_at">;
        Update: Partial<ProjectEvent>;
        Relationships: [];
      };
      agent_runs: { Row: AgentRun; Insert: Insert<AgentRun, "id" | "conversation_id" | "provider" | "model" | "status" | "input" | "output" | "error" | "input_tokens" | "output_tokens" | "cost_usd" | "started_at" | "finished_at" | "created_at">; Update: Partial<AgentRun>; Relationships: [] };
      ai_usage: { Row: AiUsage; Insert: Insert<AiUsage, "id" | "project_id" | "run_id" | "input_tokens" | "output_tokens" | "cost_usd" | "created_at">; Update: Partial<AiUsage>; Relationships: [] };
      model_policies: { Row: ModelPolicyRow; Insert: Insert<ModelPolicyRow, "provider" | "max_output_tokens" | "input_cost_per_mtok" | "output_cost_per_mtok" | "updated_at">; Update: Partial<ModelPolicyRow>; Relationships: [] };
      specifications: { Row: Specification; Insert: Insert<Specification, "id" | "version" | "run_id" | "created_at">; Update: Partial<Specification>; Relationships: [] };
      proposals: { Row: Proposal; Insert: Insert<Proposal, "id" | "specification_id" | "plan_key" | "complexity" | "summary" | "items" | "estimated_days" | "price" | "currency" | "external_costs" | "maintenance_option" | "status" | "approved_by" | "approved_at" | "created_at">; Update: Partial<Proposal>; Relationships: [] };
      project_versions: { Row: ProjectVersion; Insert: Insert<ProjectVersion, "id" | "summary" | "run_id" | "qa_report" | "created_at">; Update: Partial<ProjectVersion>; Relationships: [] };
      project_files: { Row: ProjectFile; Insert: Insert<ProjectFile, "id" | "content_type" | "size">; Update: Partial<ProjectFile>; Relationships: [] };
      project_images: { Row: ProjectImage; Insert: Insert<ProjectImage, "id" | "width" | "height" | "size" | "created_by" | "created_at">; Update: Partial<ProjectImage>; Relationships: [] };
      domain_orders: { Row: DomainOrder; Insert: Insert<DomainOrder, "id" | "payment_id" | "years" | "status" | "vercel_order_id" | "error" | "expires_at" | "created_at" | "updated_at">; Update: Partial<DomainOrder>; Relationships: [] };
      leads: { Row: Lead; Insert: Insert<Lead, "id" | "website" | "budget" | "locale" | "wants_meeting" | "source" | "medium" | "campaign" | "term" | "content" | "referrer" | "landing_page" | "stage" | "estimated_value" | "estimated_currency" | "last_contact_at" | "next_follow_up_at" | "notes" | "ip_hash" | "notified_at" | "created_at" | "updated_at">; Update: Partial<Lead>; Relationships: [] };
      rate_limits: { Row: { id: number; bucket: string; ip_hash: string; created_at: string }; Insert: { bucket: string; ip_hash: string; created_at?: string }; Update: Partial<{ bucket: string }>; Relationships: [] };
      signup_attempts: { Row: { id: number; ip_hash: string; created_at: string }; Insert: { ip_hash: string; created_at?: string }; Update: Partial<{ ip_hash: string }>; Relationships: [] };
      project_assets: { Row: ProjectAsset; Insert: Insert<ProjectAsset, "id" | "size" | "use_reference" | "use_site" | "text_content" | "text_chars" | "extract_status" | "created_by" | "created_at">; Update: Partial<ProjectAsset>; Relationships: [] };
      approvals: { Row: Approval; Insert: Insert<Approval, "id" | "payload" | "decision" | "requested_by" | "decided_by" | "decided_at" | "created_at">; Update: Partial<Approval>; Relationships: [] };
      deployments: { Row: Deployment; Insert: Insert<Deployment, "id" | "target" | "status" | "slug" | "url" | "external_id" | "logs" | "approval_id" | "created_by" | "created_at" | "finished_at">; Update: Partial<Deployment>; Relationships: [] };
      published_sites: { Row: PublishedSite; Insert: Insert<PublishedSite, "custom_domain" | "domain_status" | "domain_verification" | "published_at" | "updated_at">; Update: Partial<PublishedSite>; Relationships: [] };
      payments: { Row: Payment; Insert: Insert<Payment, "id" | "project_id" | "proposal_id" | "external_id" | "currency" | "status" | "metadata" | "created_at" | "paid_at">; Update: Partial<Payment>; Relationships: [] };
      subscriptions: { Row: Subscription; Insert: Insert<Subscription, "id" | "project_id" | "external_id" | "currency" | "period" | "status" | "current_period_end" | "domain" | "renewal_amount" | "changes_used" | "extra_changes" | "created_at">; Update: Partial<Subscription>; Relationships: [] };
      invoices: { Row: Invoice; Insert: Insert<Invoice, "id" | "payment_id" | "currency" | "issued_at" | "pdf_url">; Update: Partial<Invoice>; Relationships: [] };
      support_tickets: { Row: SupportTicket; Insert: Insert<SupportTicket, "id" | "project_id" | "created_by" | "status" | "created_at" | "updated_at">; Update: Partial<SupportTicket>; Relationships: [] };
      platform_settings: { Row: PlatformSetting; Insert: Insert<PlatformSetting, "updated_at">; Update: Partial<PlatformSetting>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { org_id: string; min_role?: OrgRole };
        Returns: boolean;
      };
      project_org: { Args: { p_id: string }; Returns: string };
      free_preview_spend_today: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      org_role: OrgRole;
      org_type: OrgType;
      project_status: ProjectStatus;
      project_complexity: ProjectComplexity;
      agent_type: AgentType;
      conversation_status: ConversationStatus;
      message_role: MessageRole;
      actor_type: ActorType;
      project_kind: ProjectKind;
      run_status: RunStatus;
      proposal_status: ProposalStatus;
      deployment_status: DeploymentStatus;
      deployment_target: DeploymentTarget;
      approval_kind: ApprovalKind;
      approval_decision: ApprovalDecision;
      payment_provider: PaymentProvider;
      payment_status: PaymentStatus;
      subscription_status: SubscriptionStatus;
      ticket_status: TicketStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
