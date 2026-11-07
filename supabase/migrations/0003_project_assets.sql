-- =============================================================================
-- Ideon · 0003 · Archivos del proyecto (documentos de referencia y archivos del sitio)
-- =============================================================================
-- Un archivo subido por el cliente puede:
--   · use_reference: la IA lee su texto (extraído al subirlo) como información de referencia.
--   · use_site:      se publica dentro del sitio generado (enlace de descarga {{FILE:id}}).
-- Las subidas van directas del navegador a Storage con URL firmada (sin pasar por
-- las funciones de Vercel, limitadas a 4,5 MB por petición); las filas las escribe
-- el servidor con service_role tras comprobar que el usuario es miembro.

create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,                                  -- nombre original del archivo
  label text not null,                                 -- nombre visible / cómo lo citan los agentes
  storage_path text not null,                          -- bucket project-files
  mime text not null,
  size int not null default 0,
  use_reference boolean not null default false,
  use_site boolean not null default false,
  text_content text,                                   -- texto extraído (recortado)
  text_chars int not null default 0,
  extract_status text not null default 'none' check (extract_status in ('none', 'ok', 'empty', 'failed', 'unsupported')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index project_assets_project_idx on public.project_assets(project_id);

alter table public.project_assets enable row level security;
create policy "assets: read" on public.project_assets for select
  using (public.is_org_member(public.project_org(project_id), 'viewer'));

-- Bucket privado de archivos (10 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 10485760)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

create policy "files bucket: members read" on storage.objects for select
  using (bucket_id = 'project-files' and public.is_org_member(public.project_org(((storage.foldername(name))[1])::uuid), 'viewer'));

-- Imágenes: también hasta 10 MB (SVG/GIF no se redimensionan en el navegador)
update storage.buckets set file_size_limit = 10485760 where id = 'project-images';
