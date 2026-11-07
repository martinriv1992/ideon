-- =============================================================================
-- Ideon · Migración 0001 · Fundación (Fase 1)
-- Esquema núcleo: perfiles, organizaciones, proyectos, conversaciones,
-- mensajes, auditoría, catálogo de categorías y planes. RLS en todas las tablas.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.org_type as enum ('personal', 'company');

create type public.project_status as enum (
  'draft', 'discovery', 'specification', 'proposal', 'approved',
  'in_development', 'review', 'ready_to_deploy', 'live', 'maintenance',
  'on_hold', 'cancelled'
);
create type public.project_complexity as enum ('starter', 'pro', 'custom');

create type public.agent_type as enum (
  'consultant', 'architect', 'designer', 'developer', 'qa', 'deploy'
);
create type public.conversation_status as enum ('open', 'closed');
create type public.message_role as enum ('user', 'assistant', 'system', 'tool');
create type public.actor_type as enum ('user', 'agent', 'system');

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  locale text not null default 'es' check (locale in ('es', 'en')),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_user_meta_data ->> 'locale', 'es')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- organizations / organization_members
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  type public.org_type not null default 'personal',
  country text,
  tax_id text,
  billing_email text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

-- El creador de una organización pasa a ser owner automáticamente
create or replace function public.handle_new_organization()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger on_organization_created
  after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- Función auxiliar para RLS: ¿es el usuario actual miembro con rol mínimo?
create or replace function public.is_org_member(org_id uuid, min_role public.org_role default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and (
        case m.role
          when 'owner' then 4 when 'admin' then 3 when 'member' then 2 else 1 end
      ) >= (
        case min_role
          when 'owner' then 4 when 'admin' then 3 when 'member' then 2 else 1 end
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Catálogos
-- -----------------------------------------------------------------------------
create table public.solution_categories (
  key text primary key,
  name_es text not null,
  name_en text not null,
  description_es text,
  description_en text,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.pricing_plans (
  key text primary key,
  name_es text not null,
  name_en text not null,
  description_es text,
  description_en text,
  price_from numeric(12,2),          -- null = "según alcance" (configurar desde admin)
  currency text not null default 'USD',
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);
create trigger pricing_plans_updated_at before update on public.pricing_plans
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null,
  initial_idea text not null check (char_length(initial_idea) between 1 and 8000),
  category_key text references public.solution_categories(key) on delete set null,
  status public.project_status not null default 'draft',
  complexity public.project_complexity,
  locale text not null default 'es' check (locale in ('es', 'en')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);
create index projects_org_idx on public.projects(organization_id, created_at desc);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- conversations / messages
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text,
  agent_type public.agent_type not null default 'consultant',
  status public.conversation_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_project_idx on public.conversations(project_id, created_at);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role public.message_role not null,
  content text not null check (char_length(content) between 1 and 20000),
  content_json jsonb,
  author_id uuid references public.profiles(id) on delete set null,
  agent_type public.agent_type,
  token_usage jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- project_events (auditoría / historial)
-- -----------------------------------------------------------------------------
create table public.project_events (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_type public.actor_type not null default 'user',
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_events_project_idx on public.project_events(project_id, created_at desc);

-- Función auxiliar: organización de un proyecto (para políticas)
create or replace function public.project_org(p_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.projects where id = p_id;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.solution_categories enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.project_events enable row level security;

-- profiles
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and is_platform_admin = (select p.is_platform_admin from public.profiles p where p.id = auth.uid()));

-- organizations
create policy "orgs: read if member" on public.organizations
  for select using (public.is_org_member(id, 'viewer'));
create policy "orgs: insert by authenticated" on public.organizations
  for insert with check (auth.uid() is not null and created_by = auth.uid());
create policy "orgs: update by admin" on public.organizations
  for update using (public.is_org_member(id, 'admin'));

-- organization_members
create policy "members: read same org" on public.organization_members
  for select using (public.is_org_member(organization_id, 'viewer'));
create policy "members: manage by admin" on public.organization_members
  for all using (public.is_org_member(organization_id, 'admin'))
  with check (public.is_org_member(organization_id, 'admin'));

-- catálogos: lectura pública de activos; escritura solo service_role
create policy "categories: public read" on public.solution_categories
  for select using (is_active);
create policy "plans: public read" on public.pricing_plans
  for select using (is_active);

-- projects
create policy "projects: read if member" on public.projects
  for select using (public.is_org_member(organization_id, 'viewer'));
create policy "projects: insert if member" on public.projects
  for insert with check (public.is_org_member(organization_id, 'member') and created_by = auth.uid());
create policy "projects: update if member" on public.projects
  for update using (public.is_org_member(organization_id, 'member'));
create policy "projects: delete if admin" on public.projects
  for delete using (public.is_org_member(organization_id, 'admin'));

-- conversations
create policy "conversations: read if member" on public.conversations
  for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "conversations: write if member" on public.conversations
  for insert with check (public.is_org_member(public.project_org(project_id), 'member'));
create policy "conversations: update if member" on public.conversations
  for update using (public.is_org_member(public.project_org(project_id), 'member'));

-- messages
create policy "messages: read if member" on public.messages
  for select using (
    public.is_org_member(public.project_org((select c.project_id from public.conversations c where c.id = conversation_id)), 'viewer')
  );
create policy "messages: insert user messages if member" on public.messages
  for insert with check (
    role = 'user' and author_id = auth.uid() and
    public.is_org_member(public.project_org((select c.project_id from public.conversations c where c.id = conversation_id)), 'member')
  );

-- project_events
create policy "events: read if member" on public.project_events
  for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "events: insert if member" on public.project_events
  for insert with check (
    actor_type = 'user' and actor_id = auth.uid() and
    public.is_org_member(public.project_org(project_id), 'member')
  );

-- -----------------------------------------------------------------------------
-- Realtime (workspace en vivo) — opcional, activar en el panel de Supabase
-- -----------------------------------------------------------------------------
-- alter publication supabase_realtime add table public.messages, public.project_events;
