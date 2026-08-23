-- ============================================================================
-- KIRVRA CENTRAL — Migration 0002: acesso interno da Central
-- Projeto de destino: VYRA2 (ref hwpansazevjwzdcmhssc)
--
-- ADITIVA e IDEMPOTENTE.
--  * Não renomeia, não altera e não remove nenhuma tabela ou coluna existente
--    (drivers, vehicles, protection_sessions, alerts, security_alerts,
--     ai_analysis_events permanecem intactas).
--  * Não cria estruturas genéricas (tickets, clients, support_agents...).
--  * NÃO É APLICADA AUTOMATICAMENTE. Revise e execute manualmente no SQL
--    Editor do projeto VYRA2.
--
-- Observação sobre central_alert_assignments: a FK para alerts é criada
-- condicionalmente, apenas se public.alerts existir com PK uuid. Caso o tipo
-- da PK real seja diferente, ajuste o tipo da coluna alert_id antes de aplicar.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'central_profile_status') then
    create type public.central_profile_status as enum ('ativo', 'inativo', 'bloqueado');
  end if;
  if not exists (select 1 from pg_type where typname = 'central_assignment_status') then
    create type public.central_assignment_status as enum (
      'atribuido', 'em_atendimento', 'transferido', 'encerrado', 'cancelado'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. central_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.central_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  employee_code text unique,
  full_name text not null,
  phone text,
  avatar_url text,
  status public.central_profile_status not null default 'inativo',
  primeiro_acesso boolean not null default true,
  last_access_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update on public.central_profiles to authenticated;
grant all on public.central_profiles to service_role;
alter table public.central_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- 2. central_roles
-- ---------------------------------------------------------------------------
create table if not exists public.central_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  hierarchy_level smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

grant select on public.central_roles to authenticated;
grant all on public.central_roles to service_role;
alter table public.central_roles enable row level security;

-- ---------------------------------------------------------------------------
-- 3. central_permissions
-- ---------------------------------------------------------------------------
create table if not exists public.central_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);

grant select on public.central_permissions to authenticated;
grant all on public.central_permissions to service_role;
alter table public.central_permissions enable row level security;

-- ---------------------------------------------------------------------------
-- 4. central_user_roles
-- ---------------------------------------------------------------------------
create table if not exists public.central_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.central_roles (id) on delete restrict,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  is_active boolean not null default true,
  unique (user_id, role_id)
);

create index if not exists central_user_roles_user_idx
  on public.central_user_roles (user_id) where is_active;

grant select on public.central_user_roles to authenticated;
grant all on public.central_user_roles to service_role;
alter table public.central_user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- 5. central_role_permissions
-- ---------------------------------------------------------------------------
create table if not exists public.central_role_permissions (
  role_id uuid not null references public.central_roles (id) on delete cascade,
  permission_id uuid not null references public.central_permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

grant select on public.central_role_permissions to authenticated;
grant all on public.central_role_permissions to service_role;
alter table public.central_role_permissions enable row level security;

-- ---------------------------------------------------------------------------
-- 6. central_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.central_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  previous_data jsonb,
  next_data jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now()
);

create index if not exists central_audit_logs_occurred_idx
  on public.central_audit_logs (occurred_at desc);

grant select on public.central_audit_logs to authenticated;
grant all on public.central_audit_logs to service_role;
alter table public.central_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 7. central_alert_assignments (referencia a tabela alerts EXISTENTE)
-- ---------------------------------------------------------------------------
create table if not exists public.central_alert_assignments (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null,
  operator_id uuid not null references auth.users (id) on delete restrict,
  assigned_by uuid references auth.users (id) on delete set null,
  status public.central_assignment_status not null default 'atribuido',
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz
);

create index if not exists central_alert_assignments_alert_idx
  on public.central_alert_assignments (alert_id);
create index if not exists central_alert_assignments_operator_idx
  on public.central_alert_assignments (operator_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'alerts'
      and column_name = 'id'
      and data_type = 'uuid'
  ) and not exists (
    select 1 from pg_constraint where conname = 'central_alert_assignments_alert_fk'
  ) then
    alter table public.central_alert_assignments
      add constraint central_alert_assignments_alert_fk
      foreign key (alert_id) references public.alerts (id) on delete cascade;
  end if;
end
$$;

grant select, insert, update on public.central_alert_assignments to authenticated;
grant all on public.central_alert_assignments to service_role;
alter table public.central_alert_assignments enable row level security;

-- ---------------------------------------------------------------------------
-- Funções seguras (SECURITY DEFINER, search_path fixo)
-- ---------------------------------------------------------------------------

-- Usuário interno ativo e com primeiro acesso concluído quando exigido.
create or replace function public.central_is_active(_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.central_profiles p
    where p.id = _user_id and p.status = 'ativo'
  );
$$;

-- Cargo seguro (nunca lido de user_metadata).
create or replace function public.central_role(_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.code
  from public.central_user_roles ur
  join public.central_roles r on r.id = ur.role_id
  where ur.user_id = _user_id
    and ur.is_active
    and r.is_active
  order by r.hierarchy_level desc
  limit 1;
$$;

create or replace function public.central_has_permission(
  _permission text,
  _user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.central_user_roles ur
    join public.central_roles r on r.id = ur.role_id
    join public.central_role_permissions rp on rp.role_id = r.id
    join public.central_permissions p on p.id = rp.permission_id
    join public.central_profiles pr on pr.id = ur.user_id
    where ur.user_id = _user_id
      and ur.is_active
      and r.is_active
      and pr.status = 'ativo'
      and p.code = _permission
  );
$$;

-- Lista de permissões efetivas do usuário autenticado (usada pelo frontend).
create or replace function public.central_my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.code
  from public.central_user_roles ur
  join public.central_roles r on r.id = ur.role_id
  join public.central_role_permissions rp on rp.role_id = r.id
  join public.central_permissions p on p.id = rp.permission_id
  join public.central_profiles pr on pr.id = ur.user_id
  where ur.user_id = auth.uid()
    and ur.is_active
    and r.is_active
    and pr.status = 'ativo';
$$;

create or replace function public.central_log_event(
  _action text,
  _entity text,
  _entity_id text default null,
  _previous jsonb default null,
  _next jsonb default null,
  _user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  if auth.uid() is null then
    raise exception 'central_log_event exige sessão autenticada';
  end if;

  insert into public.central_audit_logs (
    user_id, action, entity, entity_id, previous_data, next_data, user_agent
  ) values (
    auth.uid(), _action, _entity, _entity_id, _previous, _next, _user_agent
  )
  returning id into _id;

  return _id;
end
$$;

-- Conclusão do primeiro acesso: só o próprio usuário ativo, com auditoria.
create or replace function public.central_complete_first_access(_user_agent text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Sessão ausente';
  end if;
  if not public.central_is_active(_uid) then
    raise exception 'Perfil interno inativo ou bloqueado';
  end if;
  if public.central_role(_uid) is null then
    raise exception 'Usuário sem cargo válido na Central';
  end if;

  update public.central_profiles
     set primeiro_acesso = false,
         last_access_at = now(),
         updated_at = now()
   where id = _uid;

  insert into public.central_audit_logs (user_id, action, entity, entity_id, user_agent)
  values (_uid, 'first_access.completed', 'central_profiles', _uid::text, _user_agent);

  return true;
end
$$;

revoke all on function public.central_log_event(text, text, text, jsonb, jsonb, text) from public;
revoke all on function public.central_complete_first_access(text) from public;
grant execute on function public.central_is_active(uuid) to authenticated;
grant execute on function public.central_role(uuid) to authenticated;
grant execute on function public.central_has_permission(text, uuid) to authenticated;
grant execute on function public.central_my_permissions() to authenticated;
grant execute on function public.central_log_event(text, text, text, jsonb, jsonb, text) to authenticated;
grant execute on function public.central_complete_first_access(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — nenhuma policy aberta baseada apenas em auth.uid() IS NOT NULL
-- ---------------------------------------------------------------------------
do $$
begin
  -- central_profiles
  if not exists (select 1 from pg_policies where tablename = 'central_profiles' and policyname = 'central_profiles_self_select') then
    create policy central_profiles_self_select on public.central_profiles
      for select to authenticated using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_profiles' and policyname = 'central_profiles_manager_select') then
    create policy central_profiles_manager_select on public.central_profiles
      for select to authenticated using (public.central_has_permission('employees.manage'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_profiles' and policyname = 'central_profiles_self_update') then
    create policy central_profiles_self_update on public.central_profiles
      for update to authenticated
      using (id = auth.uid() and status = 'ativo')
      with check (id = auth.uid() and status = 'ativo');
  end if;

  -- central_roles / central_permissions / central_role_permissions
  if not exists (select 1 from pg_policies where tablename = 'central_roles' and policyname = 'central_roles_read') then
    create policy central_roles_read on public.central_roles
      for select to authenticated
      using (public.central_is_active() and public.central_role() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_permissions' and policyname = 'central_permissions_read') then
    create policy central_permissions_read on public.central_permissions
      for select to authenticated
      using (public.central_is_active() and public.central_role() is not null);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_role_permissions' and policyname = 'central_role_permissions_read') then
    create policy central_role_permissions_read on public.central_role_permissions
      for select to authenticated
      using (public.central_is_active() and public.central_role() is not null);
  end if;

  -- central_user_roles
  if not exists (select 1 from pg_policies where tablename = 'central_user_roles' and policyname = 'central_user_roles_self_select') then
    create policy central_user_roles_self_select on public.central_user_roles
      for select to authenticated using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_user_roles' and policyname = 'central_user_roles_manager_select') then
    create policy central_user_roles_manager_select on public.central_user_roles
      for select to authenticated using (public.central_has_permission('roles.manage'));
  end if;

  -- central_audit_logs
  if not exists (select 1 from pg_policies where tablename = 'central_audit_logs' and policyname = 'central_audit_logs_auditor_select') then
    create policy central_audit_logs_auditor_select on public.central_audit_logs
      for select to authenticated using (public.central_has_permission('audit.view'));
  end if;

  -- central_alert_assignments
  if not exists (select 1 from pg_policies where tablename = 'central_alert_assignments' and policyname = 'central_alert_assignments_select') then
    create policy central_alert_assignments_select on public.central_alert_assignments
      for select to authenticated
      using (public.central_has_permission('alerts.view'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_alert_assignments' and policyname = 'central_alert_assignments_take') then
    create policy central_alert_assignments_take on public.central_alert_assignments
      for insert to authenticated
      with check (
        operator_id = auth.uid()
        and public.central_has_permission('alerts.take')
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'central_alert_assignments' and policyname = 'central_alert_assignments_update') then
    create policy central_alert_assignments_update on public.central_alert_assignments
      for update to authenticated
      using (
        (operator_id = auth.uid() and public.central_has_permission('alerts.handle'))
        or public.central_has_permission('alerts.transfer')
      )
      with check (
        (operator_id = auth.uid() and public.central_has_permission('alerts.handle'))
        or public.central_has_permission('alerts.transfer')
      );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Cargos oficiais (nenhum cargo genérico agent/viewer)
-- ---------------------------------------------------------------------------
insert into public.central_roles (code, name, description, hierarchy_level) values
  ('super_admin', 'Super Admin', 'Controle total da Central KIRVRA', 60),
  ('admin',       'Administrador', 'Administração da Central e dos funcionários', 50),
  ('gerente',     'Gerente', 'Gestão operacional, relatórios e escalas', 40),
  ('supervisor',  'Supervisor', 'Supervisão de turno e transferência de atendimentos', 30),
  ('operador',    'Operador', 'Atendimento de alertas e monitoramento ao vivo', 20),
  ('auditor',     'Auditor', 'Leitura de auditoria, relatórios e histórico', 10)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Permissões granulares
-- ---------------------------------------------------------------------------
insert into public.central_permissions (code, module, action, description) values
  ('dashboard.view',   'dashboard',  'view',     'Visualizar painel da Central'),
  ('sessions.view',    'sessions',   'view',     'Visualizar sessões de proteção'),
  ('location.view',    'sessions',   'location', 'Visualizar localização ao vivo'),
  ('alerts.view',      'alerts',     'view',     'Visualizar alertas'),
  ('alerts.handle',    'alerts',     'handle',   'Atender alertas'),
  ('alerts.take',      'alerts',     'take',     'Assumir atendimento'),
  ('alerts.transfer',  'alerts',     'transfer', 'Transferir atendimento'),
  ('alerts.close',     'alerts',     'close',    'Encerrar atendimento'),
  ('evidence.view',    'evidence',   'view',     'Visualizar evidências'),
  ('evidence.audio',   'evidence',   'audio',    'Reproduzir áudio'),
  ('evidence.image',   'evidence',   'image',    'Visualizar imagens'),
  ('drivers.view',     'drivers',    'view',     'Visualizar motoristas'),
  ('vehicles.view',    'vehicles',   'view',     'Visualizar veículos'),
  ('employees.manage', 'employees',  'manage',   'Gerenciar funcionários'),
  ('roles.manage',     'roles',      'manage',   'Gerenciar cargos'),
  ('schedules.manage', 'schedules',  'manage',   'Gerenciar escalas'),
  ('audit.view',       'audit',      'view',     'Visualizar auditoria'),
  ('reports.view',     'reports',    'view',     'Visualizar relatórios'),
  ('health.view',      'health',     'view',     'Visualizar saúde do sistema'),
  ('settings.manage',  'settings',   'manage',   'Alterar configurações')
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Matriz cargo × permissão
-- ---------------------------------------------------------------------------
with matrix(role_code, permission_code) as (
  select 'super_admin', code from public.central_permissions
  union all
  select 'admin', code from public.central_permissions
    where code <> 'roles.manage' or true
  union all
  select 'gerente', code from public.central_permissions
    where code in (
      'dashboard.view','sessions.view','location.view','alerts.view','alerts.handle',
      'alerts.take','alerts.transfer','alerts.close','evidence.view','evidence.audio',
      'evidence.image','drivers.view','vehicles.view','employees.manage',
      'schedules.manage','reports.view','health.view','audit.view'
    )
  union all
  select 'supervisor', code from public.central_permissions
    where code in (
      'dashboard.view','sessions.view','location.view','alerts.view','alerts.handle',
      'alerts.take','alerts.transfer','alerts.close','evidence.view','evidence.audio',
      'evidence.image','drivers.view','vehicles.view','reports.view','health.view'
    )
  union all
  select 'operador', code from public.central_permissions
    where code in (
      'dashboard.view','sessions.view','location.view','alerts.view','alerts.handle',
      'alerts.take','alerts.close','evidence.view','evidence.audio','evidence.image',
      'drivers.view','vehicles.view'
    )
  union all
  select 'auditor', code from public.central_permissions
    where code in (
      'dashboard.view','sessions.view','alerts.view','evidence.view','drivers.view',
      'vehicles.view','audit.view','reports.view','health.view'
    )
)
insert into public.central_role_permissions (role_id, permission_id)
select r.id, p.id
from matrix m
join public.central_roles r on r.code = m.role_code
join public.central_permissions p on p.code = m.permission_code
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Realtime (idempotente) para as tabelas EXISTENTES consumidas pela Central
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['protection_sessions', 'alerts', 'security_alerts']
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t)
       and not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime'
                         and schemaname = 'public' and tablename = t)
    then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

commit;

-- ============================================================================
-- PÓS-APLICAÇÃO (manual, fora desta migration):
--   1. Criar os usuários da Central no Auth do VYRA2 (nunca por signUp no
--      navegador) e inserir a linha correspondente em central_profiles com
--      status = 'ativo'.
--   2. Atribuir o cargo em central_user_roles. Nenhum cargo é atribuído
--      automaticamente — usuário sem cargo tem acesso negado.
--   3. Criar o bucket privado 'alert-evidence' (não público) para evidências.
-- ============================================================================
