-- Captación comercial: solicitudes de la web (formulario de contacto) y su
-- seguimiento por el fundador. Migración aditiva: solo crea una tabla nueva.
-- Rollback: drop table public.leads;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  company text not null check (char_length(company) between 1 and 160),
  email text not null check (char_length(email) between 5 and 160),
  country text not null check (char_length(country) between 2 and 60),
  website text,
  solution text not null,
  problem text not null check (char_length(problem) between 10 and 4000),
  budget text,
  timeframe text not null,
  locale text not null default 'es' check (locale in ('es', 'en')),
  consent boolean not null,
  wants_meeting boolean not null default false,
  -- Origen (primer contacto) y campaña
  source text, medium text, campaign text, term text, content text, referrer text, landing_page text,
  -- Gestión comercial
  stage text not null default 'new' check (stage in ('new', 'researched', 'contacted', 'interested', 'meeting', 'proposal', 'negotiation', 'won', 'lost')),
  estimated_value numeric(14, 2),
  estimated_currency text,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  ip_hash text,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_stage_idx on public.leads(stage, created_at desc);
create index if not exists leads_follow_up_idx on public.leads(next_follow_up_at) where next_follow_up_at is not null;
drop trigger if exists leads_updated_at on public.leads;
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();
-- Datos personales: sin políticas para clientes; solo el servidor (service_role) y el backoffice.
alter table public.leads enable row level security;
