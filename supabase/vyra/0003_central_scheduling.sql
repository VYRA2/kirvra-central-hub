begin;

create schema if not exists private;

create or replace function private.central_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.central_set_updated_at() from public, anon, authenticated;

create table public.central_regions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint central_regions_code_not_blank check (btrim(code) <> ''),
  constraint central_regions_name_not_blank check (btrim(name) <> '')
);

create table public.central_shifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  starts_at time not null,
  ends_at time not null,
  timezone text not null default 'America/Sao_Paulo',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint central_shifts_code_not_blank check (btrim(code) <> ''),
  constraint central_shifts_name_not_blank check (btrim(name) <> ''),
  constraint central_shifts_nonzero_duration check (starts_at <> ends_at)
);

create table public.central_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.central_profiles(id),
  shift_id uuid not null references public.central_shifts(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  assigned_by uuid not null references public.central_profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint central_shift_assignments_valid_period check (ends_at > starts_at),
  constraint central_shift_assignments_status_check
    check (status in ('scheduled', 'active', 'completed', 'cancelled', 'absent'))
);

create table public.central_operator_presence (
  operator_id uuid primary key references public.central_profiles(id) on delete cascade,
  shift_assignment_id uuid references public.central_shift_assignments(id) on delete set null,
  region_id uuid references public.central_regions(id) on delete set null,
  status text not null default 'offline',
  heartbeat_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint central_operator_presence_status_check
    check (status in ('offline', 'online', 'available', 'busy'))
);

create table public.central_region_assignments (
  id uuid primary key default gen_random_uuid(),
  operator_id uuid not null references public.central_profiles(id),
  region_id uuid not null references public.central_regions(id),
  shift_assignment_id uuid references public.central_shift_assignments(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled',
  assigned_by uuid not null references public.central_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint central_region_assignments_valid_period check (ends_at > starts_at),
  constraint central_region_assignments_status_check
    check (status in ('scheduled', 'active', 'completed', 'cancelled'))
);

create table public.central_shift_handovers (
  id uuid primary key default gen_random_uuid(),
  from_assignment_id uuid not null references public.central_shift_assignments(id),
  to_assignment_id uuid references public.central_shift_assignments(id),
  requested_by uuid not null references public.central_profiles(id),
  received_by uuid references public.central_profiles(id),
  status text not null default 'pending',
  summary jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint central_shift_handovers_status_check
    check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  constraint central_shift_handovers_distinct_assignments
    check (to_assignment_id is null or to_assignment_id <> from_assignment_id)
);

create index central_regions_active_idx
  on public.central_regions (is_active, name);
create index central_shifts_active_idx
  on public.central_shifts (is_active, starts_at);
create index central_shift_assignments_operator_period_idx
  on public.central_shift_assignments (operator_id, starts_at desc, ends_at);
create index central_shift_assignments_shift_period_idx
  on public.central_shift_assignments (shift_id, starts_at desc, ends_at);
create index central_shift_assignments_status_period_idx
  on public.central_shift_assignments (status, starts_at desc, ends_at);
create index central_shift_assignments_assigned_by_idx
  on public.central_shift_assignments (assigned_by);
create index central_operator_presence_status_heartbeat_idx
  on public.central_operator_presence (status, heartbeat_at desc);
create index central_operator_presence_region_idx
  on public.central_operator_presence (region_id, status);
create index central_operator_presence_assignment_idx
  on public.central_operator_presence (shift_assignment_id);
create index central_region_assignments_region_period_idx
  on public.central_region_assignments (region_id, status, starts_at desc, ends_at);
create index central_region_assignments_operator_period_idx
  on public.central_region_assignments (operator_id, starts_at desc, ends_at);
create index central_region_assignments_shift_idx
  on public.central_region_assignments (shift_assignment_id);
create index central_region_assignments_assigned_by_idx
  on public.central_region_assignments (assigned_by);
create index central_shift_handovers_status_requested_idx
  on public.central_shift_handovers (status, requested_at desc);
create index central_shift_handovers_from_idx
  on public.central_shift_handovers (from_assignment_id);
create index central_shift_handovers_to_idx
  on public.central_shift_handovers (to_assignment_id);
create index central_shift_handovers_requested_by_idx
  on public.central_shift_handovers (requested_by, requested_at desc);
create index central_shift_handovers_received_by_idx
  on public.central_shift_handovers (received_by, requested_at desc);

create trigger central_regions_set_updated_at
before update on public.central_regions
for each row execute function private.central_set_updated_at();

create trigger central_shifts_set_updated_at
before update on public.central_shifts
for each row execute function private.central_set_updated_at();

create trigger central_shift_assignments_set_updated_at
before update on public.central_shift_assignments
for each row execute function private.central_set_updated_at();

create trigger central_operator_presence_set_updated_at
before update on public.central_operator_presence
for each row execute function private.central_set_updated_at();

create trigger central_region_assignments_set_updated_at
before update on public.central_region_assignments
for each row execute function private.central_set_updated_at();

create trigger central_shift_handovers_set_updated_at
before update on public.central_shift_handovers
for each row execute function private.central_set_updated_at();

alter table public.central_regions enable row level security;
alter table public.central_shifts enable row level security;
alter table public.central_shift_assignments enable row level security;
alter table public.central_operator_presence enable row level security;
alter table public.central_region_assignments enable row level security;
alter table public.central_shift_handovers enable row level security;

revoke all on table
  public.central_regions,
  public.central_shifts,
  public.central_shift_assignments,
  public.central_operator_presence,
  public.central_region_assignments,
  public.central_shift_handovers
from anon, authenticated;

grant select on table
  public.central_regions,
  public.central_shifts,
  public.central_shift_assignments,
  public.central_operator_presence,
  public.central_region_assignments,
  public.central_shift_handovers
to authenticated;

grant all on table
  public.central_regions,
  public.central_shifts,
  public.central_shift_assignments,
  public.central_operator_presence,
  public.central_region_assignments,
  public.central_shift_handovers
to service_role;

create policy central_regions_schedule_select
on public.central_regions for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

create policy central_shifts_schedule_select
on public.central_shifts for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

create policy central_shift_assignments_schedule_select
on public.central_shift_assignments for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

create policy central_operator_presence_schedule_select
on public.central_operator_presence for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

create policy central_region_assignments_schedule_select
on public.central_region_assignments for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

create policy central_shift_handovers_schedule_select
on public.central_shift_handovers for select
to authenticated
using ((select public.central_has_permission('schedules.manage')));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.central_shift_assignments,
      public.central_operator_presence,
      public.central_region_assignments,
      public.central_shift_handovers;
  end if;
end;
$$;

commit;


