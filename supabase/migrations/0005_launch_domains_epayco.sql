-- =============================================================================
-- Ideon · 0005 · Vista previa gratuita, pago de lanzamiento con ePayco,
-- compra de dominios (registrador de Vercel) y paquete anual hosting + dominio.
-- =============================================================================

alter type public.payment_provider add value if not exists 'epayco';

-- Vista previa gratuita: el proyecto se «activa» al pagar el lanzamiento.
alter table public.projects add column if not exists paid_at timestamptz;
alter table public.projects add column if not exists free_changes_used int not null default 0;

-- Paquete anual hosting + dominio (una fila por proyecto activado).
alter table public.subscriptions add column if not exists domain text;
alter table public.subscriptions add column if not exists renewal_amount numeric(12,2);

-- Pedidos de dominio: se crean al iniciar el pago y se compran al confirmarse.
create table public.domain_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  domain text not null,
  years int not null default 1,
  cost_usd numeric(10,2) not null,                    -- precio del registrador al cotizar
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'purchasing', 'configuring', 'active', 'failed', 'cancelled')),
  vercel_order_id text,
  contact jsonb not null,                             -- titular del dominio (el cliente)
  error text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index domain_orders_project_idx on public.domain_orders(project_id, created_at desc);
create unique index domain_orders_active_domain_idx on public.domain_orders(domain) where status in ('purchasing', 'configuring', 'active');
create trigger domain_orders_updated_at before update on public.domain_orders
  for each row execute function public.set_updated_at();

alter table public.domain_orders enable row level security;
create policy "domain orders: read" on public.domain_orders for select
  using (public.is_org_member(organization_id, 'viewer'));

-- Precios y reglas comerciales (editables en /admin/settings).
insert into public.platform_settings (key, value) values
  ('billing_currency', '"COP"'::jsonb),
  ('usd_to_billing_rate', '4000'::jsonb),
  ('hosting_price_year', '240000'::jsonb),
  ('domain_markup_pct', '30'::jsonb),
  ('domain_tlds', '["com", "co", "net", "org", "online", "store", "shop"]'::jsonb),
  ('free_preview_changes', '2'::jsonb),
  ('renewal_grace_days', '15'::jsonb)
on conflict (key) do nothing;
