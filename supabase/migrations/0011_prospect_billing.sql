-- Cobro de la prospección con IA (por proyecto/app). Migración aditiva.
-- Plan prepago: búsquedas concedidas en la cadena de pagos vigente (since → until).
-- Búsquedas sueltas: compradas sin caducidad. El consumo se registra en rate_limits
-- (bucket prospect:trial | prospect:plan | prospect:credit, ip_hash = id del proyecto).
-- Rollback: alter table public.projects drop column prospect_plan_until, drop column prospect_plan_since,
--           drop column prospect_plan_granted, drop column prospect_credits_bought;
alter table public.projects add column if not exists prospect_plan_until timestamptz;
alter table public.projects add column if not exists prospect_plan_since timestamptz;
alter table public.projects add column if not exists prospect_plan_granted int not null default 0;
alter table public.projects add column if not exists prospect_credits_bought int not null default 0;
