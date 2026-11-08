-- Ideon Data: datos persistentes y usuarios para las aplicaciones publicadas.
-- Cada proyecto (app) tiene sus propios usuarios finales (el equipo del cliente)
-- y sus registros en colecciones JSON. Solo el servidor accede (service_role).
-- Migración aditiva. Rollback: drop table app_records, app_sessions, app_users;
-- drop function app_record_patch, app_record_increment.

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 160),
  name text not null check (char_length(name) between 1 and 120),
  role text not null default 'member' check (role in ('admin', 'member')),
  password_hash text not null,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_email_idx on public.app_users(project_id, lower(email));
drop trigger if exists app_users_updated_at on public.app_users;
create trigger app_users_updated_at before update on public.app_users for each row execute function public.set_updated_at();

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists app_sessions_user_idx on public.app_sessions(user_id);

-- Identificador de texto: los registros nuevos usan un UUID generado por el SDK;
-- los datos iniciales de la app pueden usar ids legibles («p1») para relacionarse.
create table if not exists public.app_records (
  project_id uuid not null references public.projects(id) on delete cascade,
  collection text not null check (collection ~ '^[a-z_][a-z0-9_]{0,39}$'),
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data jsonb not null default '{}'::jsonb,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (project_id, collection, id)
);
create index if not exists app_records_sync_idx on public.app_records(project_id, updated_at);
create index if not exists app_records_coll_idx on public.app_records(project_id, collection) where deleted_at is null;
drop trigger if exists app_records_updated_at on public.app_records;
create trigger app_records_updated_at before update on public.app_records for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.app_records enable row level security;

-- Cambios atómicos: dos personas editando a la vez campos distintos del mismo
-- registro no se pisan, y los incrementos (stock, saldos) nunca pierden unidades.
create or replace function public.app_record_patch(p_project uuid, p_collection text, p_id text, p_patch jsonb, p_user uuid)
returns setof public.app_records language sql as $$
  update public.app_records set data = data || p_patch, updated_by = p_user
  where project_id = p_project and collection = p_collection and id = p_id and deleted_at is null
  returning *;
$$;

create or replace function public.app_record_increment(p_project uuid, p_collection text, p_id text, p_field text, p_delta numeric, p_user uuid)
returns setof public.app_records language sql as $$
  update public.app_records
  set data = jsonb_set(data, array[p_field], to_jsonb(coalesce((data ->> p_field)::numeric, 0) + p_delta)), updated_by = p_user
  where project_id = p_project and collection = p_collection and id = p_id and deleted_at is null
  returning *;
$$;

revoke all on function public.app_record_patch(uuid, text, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.app_record_increment(uuid, text, text, text, numeric, uuid) from public, anon, authenticated;
