-- KIRVRA Central: operational readiness for real drivers, profiles and live GPS.

alter table public.drivers
  add column if not exists registration_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drivers_registration_status_check'
      and conrelid = 'public.drivers'::regclass
  ) then
    alter table public.drivers
      add constraint drivers_registration_status_check
      check (registration_status in ('pending', 'reviewing', 'verified', 'suspended'));
  end if;
end
$$;

update public.drivers
set registration_status = case
  when identity_document_path is not null
   and selfie_path is not null
   and terms_accepted_at is not null
   and data_processing_consent_at is not null then 'verified'
  else 'pending'
end
where registration_status = 'pending';

alter table public.protection_sessions
  add column if not exists current_latitude double precision,
  add column if not exists current_longitude double precision,
  add column if not exists location_accuracy_meters double precision,
  add column if not exists location_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'protection_sessions_latitude_check'
      and conrelid = 'public.protection_sessions'::regclass
  ) then
    alter table public.protection_sessions
      add constraint protection_sessions_latitude_check
      check (current_latitude is null or current_latitude between -90 and 90);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'protection_sessions_longitude_check'
      and conrelid = 'public.protection_sessions'::regclass
  ) then
    alter table public.protection_sessions
      add constraint protection_sessions_longitude_check
      check (current_longitude is null or current_longitude between -180 and 180);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'protection_sessions_accuracy_check'
      and conrelid = 'public.protection_sessions'::regclass
  ) then
    alter table public.protection_sessions
      add constraint protection_sessions_accuracy_check
      check (location_accuracy_meters is null or location_accuracy_meters >= 0);
  end if;
end
$$;

insert into public.central_permissions (code, name, description)
values ('drivers.manage', 'Gerenciar motoristas', 'Revisar ou suspender cadastros de motoristas')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

insert into public.central_role_permissions (role_id, permission_id)
select role.id, permission.id
from public.central_roles role
cross join public.central_permissions permission
where role.code in ('gerente', 'admin', 'super_admin')
  and permission.code = 'drivers.manage'
on conflict do nothing;

drop policy if exists central_drivers_update on public.drivers;
create policy central_drivers_update
on public.drivers
for update
to authenticated
using ((select public.central_has_permission('drivers.manage')))
with check ((select public.central_has_permission('drivers.manage')));

create or replace function public.central_update_own_profile(
  p_full_name text,
  p_phone text default null,
  p_user_agent text default null
)
returns public.central_profiles
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous public.central_profiles;
  v_next public.central_profiles;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.' using errcode = '42501';
  end if;

  if p_full_name is null or length(btrim(p_full_name)) not between 2 and 120 then
    raise exception 'Nome inválido.' using errcode = '22023';
  end if;

  if p_phone is not null and length(btrim(p_phone)) > 30 then
    raise exception 'Telefone inválido.' using errcode = '22023';
  end if;

  select * into v_previous
  from public.central_profiles
  where id = auth.uid() and status = 'ativo'
  for update;

  if not found then
    raise exception 'Perfil interno ativo não encontrado.' using errcode = 'P0002';
  end if;

  update public.central_profiles
  set full_name = btrim(p_full_name),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      updated_at = now()
  where id = auth.uid()
  returning * into v_next;

  insert into public.central_audit_logs (
    operator_id, action, entity_type, entity_id, previous_data, next_data, user_agent
  ) values (
    auth.uid(), 'profile.updated', 'central_profiles', auth.uid()::text,
    to_jsonb(v_previous), to_jsonb(v_next), left(p_user_agent, 1000)
  );

  return v_next;
end;
$$;

revoke all on function public.central_update_own_profile(text, text, text) from public, anon;
grant execute on function public.central_update_own_profile(text, text, text) to authenticated;

create or replace function public.central_set_driver_status(
  p_driver_id uuid,
  p_status text,
  p_reason text,
  p_user_agent text default null
)
returns public.drivers
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous public.drivers;
  v_next public.drivers;
begin
  if auth.uid() is null or not public.central_has_permission('drivers.manage') then
    raise exception 'Sem permissão para gerenciar motoristas.' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'reviewing', 'verified', 'suspended') then
    raise exception 'Estado cadastral inválido.' using errcode = '22023';
  end if;

  if p_status = 'suspended' and length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Informe o motivo da suspensão.' using errcode = '22023';
  end if;

  select * into v_previous
  from public.drivers
  where id = p_driver_id
  for update;

  if not found then
    raise exception 'Motorista não encontrado.' using errcode = 'P0002';
  end if;

  update public.drivers
  set registration_status = p_status,
      updated_at = now()
  where id = p_driver_id
  returning * into v_next;

  insert into public.central_audit_logs (
    operator_id, action, entity_type, entity_id, previous_data, next_data, user_agent
  ) values (
    auth.uid(), 'profile.driver_status_updated', 'drivers', p_driver_id::text,
    to_jsonb(v_previous),
    to_jsonb(v_next) || jsonb_build_object('reason', nullif(btrim(coalesce(p_reason, '')), '')),
    left(p_user_agent, 1000)
  );

  return v_next;
end;
$$;

revoke all on function public.central_set_driver_status(uuid, text, text, text) from public, anon;
grant execute on function public.central_set_driver_status(uuid, text, text, text) to authenticated;

create or replace function public.heartbeat_protection_session(
  p_session_id uuid,
  p_camera_connected boolean,
  p_audio_enabled boolean,
  p_gps_enabled boolean
)
returns public.protection_sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.protection_sessions;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.protection_sessions as ps
  set last_heartbeat_at = pg_catalog.now(),
      camera_connected = p_camera_connected,
      audio_monitoring_enabled = p_audio_enabled,
      gps_enabled = p_gps_enabled,
      updated_at = pg_catalog.now()
  where ps.id = p_session_id
    and ps.status = 'active'
    and exists (
      select 1 from public.drivers as d
      where d.id = ps.driver_id
        and d.user_id = (select auth.uid())
    )
  returning ps.* into v_session;

  if v_session.id is null then
    raise exception 'Active protection session not found';
  end if;

  return v_session;
end;
$$;

create or replace function public.heartbeat_protection_session_v2(
  p_session_id uuid,
  p_camera_connected boolean,
  p_audio_enabled boolean,
  p_gps_enabled boolean,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null
)
returns public.protection_sessions
language plpgsql
set search_path = ''
as $$
declare
  v_session public.protection_sessions;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Latitude and longitude must be provided together' using errcode = '22023';
  end if;

  update public.protection_sessions as ps
  set last_heartbeat_at = pg_catalog.now(),
      camera_connected = p_camera_connected,
      audio_monitoring_enabled = p_audio_enabled,
      gps_enabled = p_gps_enabled,
      current_latitude = coalesce(p_latitude, ps.current_latitude),
      current_longitude = coalesce(p_longitude, ps.current_longitude),
      location_accuracy_meters = coalesce(p_accuracy_meters, ps.location_accuracy_meters),
      location_updated_at = case when p_latitude is not null then pg_catalog.now() else ps.location_updated_at end,
      updated_at = pg_catalog.now()
  where ps.id = p_session_id
    and ps.status = 'active'
    and exists (
      select 1 from public.drivers as d
      where d.id = ps.driver_id
        and d.user_id = (select auth.uid())
    )
  returning ps.* into v_session;

  if v_session.id is null then
    raise exception 'Active protection session not found';
  end if;

  return v_session;
end;
$$;

revoke all on function public.heartbeat_protection_session(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.heartbeat_protection_session(uuid, boolean, boolean, boolean) to authenticated;
revoke all on function public.heartbeat_protection_session_v2(uuid, boolean, boolean, boolean, double precision, double precision, double precision) from public, anon;
grant execute on function public.heartbeat_protection_session_v2(uuid, boolean, boolean, boolean, double precision, double precision, double precision) to authenticated;
