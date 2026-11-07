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
  created_at: string;
  updated_at: string;
};

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
        Insert: Insert<Project, "id" | "created_by" | "category_key" | "status" | "complexity" | "locale" | "archived_at" | "created_at" | "updated_at">;
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
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { org_id: string; min_role?: OrgRole };
        Returns: boolean;
      };
      project_org: { Args: { p_id: string }; Returns: string };
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
    };
    CompositeTypes: Record<string, never>;
  };
};
