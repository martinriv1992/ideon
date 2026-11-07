-- Ideon Business: proyectos que parten de un paquete empresarial (precio cerrado
-- editable desde admin), y límite de consultas públicas por conexión.

alter table public.projects add column if not exists package_key text
  check (package_key is null or package_key in ('inventory', 'crm', 'suite'));

insert into public.pricing_plans (key, name_es, name_en, description_es, description_en, price_from, currency, features, is_active, sort_order) values
  ('pkg_inventory', 'Ideon Inventory', 'Ideon Inventory', 'Inventario multibodega personalizado para tu negocio.', 'Multi-warehouse inventory tailored to your business.', 1490000, 'COP', '[]'::jsonb, true, 100),
  ('pkg_crm', 'Ideon CRM', 'Ideon CRM', 'CRM de ventas con embudo, cotizaciones y equipo comercial.', 'Sales CRM with pipeline, quotes and sales team.', 1490000, 'COP', '[]'::jsonb, true, 101),
  ('pkg_suite', 'Ideon Business Suite', 'Ideon Business Suite', 'Ventas, inventario, clientes, compras y finanzas en un solo sistema.', 'Sales, inventory, clients, purchasing and finance in one system.', 2900000, 'COP', '[]'::jsonb, true, 102)
on conflict (key) do nothing;

-- Consultas públicas (p. ej. buscador de dominios de la portada): solo un hash de la IP.
create table if not exists public.rate_limits (
  id bigint generated always as identity primary key,
  bucket text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limits_idx on public.rate_limits(bucket, ip_hash, created_at desc);
alter table public.rate_limits enable row level security; -- solo service_role
