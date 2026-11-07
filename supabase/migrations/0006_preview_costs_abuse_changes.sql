-- =============================================================================
-- Ideon · 0006 · Coste de las vistas previas, antiabuso y paquetes de cambios
-- =============================================================================

-- Modelos mixtos: Claude Haiku 5.5 (0,10 / 0,50 USD por millón de tokens) para el
-- consultor, el arquitecto y todo lo que ocurre durante la vista previa gratuita;
-- Claude Sonnet 5.5 para construir y modificar cuando el cliente ya pagó.
-- Las políticas «*_preview» se usan mientras el proyecto no está activado.
update public.model_policies set model = 'claude-haiku-5-5', input_cost_per_mtok = 0.10, output_cost_per_mtok = 0.50, updated_at = now()
where task in ('consultant', 'architect');
insert into public.model_policies (task, provider, model, max_output_tokens, input_cost_per_mtok, output_cost_per_mtok) values
  ('developer_preview', 'anthropic', 'claude-haiku-5-5', 32000, 0.10, 0.50),
  ('modify_preview',    'anthropic', 'claude-haiku-5-5', 32000, 0.10, 0.50)
on conflict (task) do nothing;

-- Gasto de IA de hoy (hora de Colombia) en proyectos que siguen en vista previa gratuita.
create or replace function public.free_preview_spend_today()
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(u.cost_usd), 0)
  from public.ai_usage u
  join public.projects p on p.id = u.project_id
  where p.paid_at is null
    and u.created_at >= (date_trunc('day', now() at time zone 'America/Bogota') at time zone 'America/Bogota');
$$;
revoke all on function public.free_preview_spend_today() from public, anon, authenticated;

-- Registros por conexión (IP con hash y sal, nunca en claro) para limitar cuentas nuevas.
create table public.signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index signup_attempts_ip_idx on public.signup_attempts(ip_hash, created_at desc);
alter table public.signup_attempts enable row level security; -- solo service_role

-- Cambios por chat del paquete anual: incluidos por año + paquetes comprados.
alter table public.subscriptions add column if not exists changes_used int not null default 0;
alter table public.subscriptions add column if not exists extra_changes int not null default 0;

insert into public.platform_settings (key, value) values
  ('free_preview_daily_budget_usd', '5'::jsonb),
  ('max_signups_per_ip_day', '3'::jsonb),
  ('included_changes_year', '20'::jsonb),
  ('change_packs', '[{"qty": 10, "price": 49000}, {"qty": 30, "price": 119000}]'::jsonb)
on conflict (key) do nothing;
