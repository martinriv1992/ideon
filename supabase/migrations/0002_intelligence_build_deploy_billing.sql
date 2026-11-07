-- =============================================================================
-- Ideon · Migración 0002 · Fases 2-5
-- Inteligencia (runs, uso, especificaciones, propuestas), construcción
-- (versiones, archivos, imágenes), publicación (despliegues, aprobaciones,
-- dominios) y comercialización (pagos, suscripciones, facturas, tickets, ajustes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.run_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.proposal_status as enum ('draft', 'sent', 'approved', 'rejected', 'expired');
create type public.deployment_status as enum ('pending', 'building', 'live', 'failed', 'rolled_back');
create type public.deployment_target as enum ('ideon', 'vercel');
create type public.approval_kind as enum ('deploy', 'custom_domain', 'external_integration', 'spend_over_limit');
create type public.approval_decision as enum ('pending', 'approved', 'rejected');
create type public.payment_provider as enum ('stripe', 'wompi', 'manual');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved', 'closed');
create type public.project_kind as enum ('web', 'crm', 'inventory', 'erp', 'dashboard', 'portal', 'app', 'other');

alter table public.projects add column if not exists kind public.project_kind not null default 'web';
alter table public.projects add column if not exists brief jsonb;
alter table public.projects add column if not exists current_version_id uuid;
alter table public.projects add column if not exists active_run_id uuid;

-- -----------------------------------------------------------------------------
-- Inteligencia
-- -----------------------------------------------------------------------------
create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  agent_type public.agent_type not null,
  step text not null,                      -- consultant | architect | developer | qa | modify | proposal
  provider text not null default 'anthropic',
  model text,
  status public.run_status not null default 'queued',
  input jsonb,
  output jsonb,
  error text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index agent_runs_project_idx on public.agent_runs(project_id, created_at desc);
create index agent_runs_status_idx on public.agent_runs(status) where status in ('queued','running');

create table public.ai_usage (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_org_idx on public.ai_usage(organization_id, created_at desc);

create table public.model_policies (
  task text primary key,                   -- consultant | architect | developer | modify | summary
  provider text not null default 'anthropic',
  model text not null,
  max_output_tokens int not null default 8192,
  input_cost_per_mtok numeric(10,4) not null default 3,
  output_cost_per_mtok numeric(10,4) not null default 15,
  updated_at timestamptz not null default now()
);

create table public.specifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version int not null default 1,
  content jsonb not null,
  run_id uuid references public.agent_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  specification_id uuid references public.specifications(id) on delete set null,
  plan_key text references public.pricing_plans(key),
  complexity public.project_complexity not null default 'starter',
  title text not null,
  summary text,
  items jsonb not null default '[]'::jsonb,         -- [{name, description, effort_days}]
  estimated_days int,
  price numeric(12,2),                               -- null = según alcance (pendiente de configurar)
  currency text not null default 'USD',
  external_costs jsonb not null default '[]'::jsonb, -- [{name, amount, currency, period}]
  maintenance_option jsonb,                           -- {price, currency, period, includes[]}
  status public.proposal_status not null default 'sent',
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index proposals_project_idx on public.proposals(project_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Construcción
-- -----------------------------------------------------------------------------
create table public.project_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  summary text,
  run_id uuid references public.agent_runs(id) on delete set null,
  qa_report jsonb,                                   -- [{level, text}]
  created_at timestamptz not null default now(),
  unique (project_id, number)
);

create table public.project_files (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.project_versions(id) on delete cascade,
  path text not null,
  content text not null,
  content_type text not null default 'text/html',
  size int not null default 0,
  unique (version_id, path)
);

create table public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  storage_path text not null,                        -- bucket project-images
  width int, height int, size int,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index project_images_project_idx on public.project_images(project_id);

alter table public.projects
  add constraint projects_current_version_fk foreign key (current_version_id) references public.project_versions(id) on delete set null;
alter table public.projects
  add constraint projects_active_run_fk foreign key (active_run_id) references public.agent_runs(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Publicación
-- -----------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind public.approval_kind not null,
  payload jsonb not null default '{}'::jsonb,
  decision public.approval_decision not null default 'pending',
  requested_by uuid references public.profiles(id),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version_id uuid not null references public.project_versions(id) on delete cascade,
  target public.deployment_target not null default 'ideon',
  status public.deployment_status not null default 'pending',
  slug text,                                         -- ideon: <slug> → /s/<slug>
  url text,
  external_id text,
  logs text,
  approval_id uuid references public.approvals(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index deployments_project_idx on public.deployments(project_id, created_at desc);

-- Sitio publicado (uno por proyecto): lo que sirve /s/<slug>
create table public.published_sites (
  project_id uuid primary key references public.projects(id) on delete cascade,
  slug text not null unique,
  version_id uuid not null references public.project_versions(id) on delete cascade,
  custom_domain text unique,
  domain_status text,                                -- pending_dns | verified | error
  domain_verification jsonb,
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger published_sites_updated_at before update on public.published_sites
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Comercialización
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  proposal_id uuid references public.proposals(id) on delete set null,
  provider public.payment_provider not null,
  external_id text,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  status public.payment_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_org_idx on public.payments(organization_id, created_at desc);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider public.payment_provider not null,
  external_id text,
  plan text not null,                                -- hosting | maintenance | ai_credits
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  period text not null default 'month',
  status public.subscription_status not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  number text not null unique,
  amount numeric(12,2) not null,
  currency text not null default 'USD',
  issued_at timestamptz not null default now(),
  pdf_url text
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  created_by uuid references public.profiles(id),
  subject text not null,
  body text not null,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger support_tickets_updated_at before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.agent_runs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.model_policies enable row level security;
alter table public.specifications enable row level security;
alter table public.proposals enable row level security;
alter table public.project_versions enable row level security;
alter table public.project_files enable row level security;
alter table public.project_images enable row level security;
alter table public.approvals enable row level security;
alter table public.deployments enable row level security;
alter table public.published_sites enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.support_tickets enable row level security;
alter table public.platform_settings enable row level security;

-- Lectura por miembros del proyecto; las escrituras de agentes/sistema van con service_role.
create policy "runs: read" on public.agent_runs for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "usage: read" on public.ai_usage for select using (public.is_org_member(organization_id, 'admin'));
create policy "policies: read" on public.model_policies for select using (auth.uid() is not null);
create policy "specs: read" on public.specifications for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "proposals: read" on public.proposals for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "proposals: approve" on public.proposals for update using (public.is_org_member(public.project_org(project_id), 'admin'));
create policy "versions: read" on public.project_versions for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "files: read" on public.project_files for select using (
  public.is_org_member(public.project_org((select v.project_id from public.project_versions v where v.id = version_id)), 'viewer'));
create policy "images: read" on public.project_images for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "images: insert" on public.project_images for insert with check (public.is_org_member(public.project_org(project_id), 'member') and created_by = auth.uid());
create policy "images: delete" on public.project_images for delete using (public.is_org_member(public.project_org(project_id), 'member'));
create policy "approvals: read" on public.approvals for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "deployments: read" on public.deployments for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "sites: read" on public.published_sites for select using (public.is_org_member(public.project_org(project_id), 'viewer'));
create policy "payments: read" on public.payments for select using (public.is_org_member(organization_id, 'admin'));
create policy "subscriptions: read" on public.subscriptions for select using (public.is_org_member(organization_id, 'admin'));
create policy "invoices: read" on public.invoices for select using (public.is_org_member(organization_id, 'admin'));
create policy "tickets: read" on public.support_tickets for select using (public.is_org_member(organization_id, 'viewer'));
create policy "tickets: insert" on public.support_tickets for insert with check (public.is_org_member(organization_id, 'member') and created_by = auth.uid());
create policy "settings: public read" on public.platform_settings for select using (true);

-- Mensajes del asistente: los inserta el servidor (service_role). RLS de messages ya restringe a role='user' para usuarios.

-- -----------------------------------------------------------------------------
-- Storage: bucket privado de imágenes de proyecto (crear en el panel o con la API)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('project-images', 'project-images', false) on conflict (id) do nothing;
create policy "images bucket: members read" on storage.objects for select
  using (bucket_id = 'project-images' and public.is_org_member(public.project_org(((storage.foldername(name))[1])::uuid), 'viewer'));
create policy "images bucket: members write" on storage.objects for insert
  with check (bucket_id = 'project-images' and public.is_org_member(public.project_org(((storage.foldername(name))[1])::uuid), 'member'));
create policy "images bucket: members delete" on storage.objects for delete
  using (bucket_id = 'project-images' and public.is_org_member(public.project_org(((storage.foldername(name))[1])::uuid), 'member'));

-- -----------------------------------------------------------------------------
-- Semillas de configuración (sin precios definitivos)
-- -----------------------------------------------------------------------------
insert into public.model_policies (task, provider, model, max_output_tokens, input_cost_per_mtok, output_cost_per_mtok) values
  ('consultant', 'anthropic', 'claude-sonnet-4-5', 2048, 3, 15),
  ('architect',  'anthropic', 'claude-sonnet-4-5', 4096, 3, 15),
  ('developer',  'anthropic', 'claude-sonnet-4-5', 16000, 3, 15),
  ('modify',     'anthropic', 'claude-sonnet-4-5', 16000, 3, 15)
on conflict (task) do nothing;

insert into public.platform_settings (key, value) values
  ('require_proposal_approval', 'true'::jsonb),
  ('require_payment_before_build', 'false'::jsonb),
  ('default_currency', '"USD"'::jsonb),
  ('site_base_url', '""'::jsonb)
on conflict (key) do nothing;
