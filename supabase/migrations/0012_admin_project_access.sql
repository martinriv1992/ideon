-- Acceso del equipo de Ideonapp (administradores de la plataforma) a los proyectos de los clientes,
-- para revisarlos y darles su toque desde el backoffice: cuentan como «admin» de cualquier organización
-- (nunca como «owner», así no pueden transferir ni borrar la organización del cliente).
-- Rollback: volver a la definición de 0001_foundation.sql (sin el «or» final).
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
  )
  or (
    min_role <> 'owner'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin)
  );
$$;
