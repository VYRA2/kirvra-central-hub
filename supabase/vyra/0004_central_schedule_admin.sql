begin;

create or replace function public.central_schedule_admin(
  _actor_id uuid,
  _action text,
  _payload jsonb default '{}'::jsonb,
  _user_agent text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  _entity_id uuid;
  _entity_type text;
  _previous jsonb;
  _next jsonb;
  _operator_id uuid;
  _shift_id uuid;
  _region_id uuid;
  _assignment_id uuid;
  _from_assignment_id uuid;
  _to_assignment_id uuid;
  _status text;
  _starts_at timestamptz;
  _ends_at timestamptz;
begin
  if _actor_id is null then
    raise exception using errcode = '42501', message = 'Sessao administrativa invalida.';
  end if;

  if not exists (
    select 1
    from public.central_profiles profile
    join public.central_user_roles user_role
      on user_role.user_id = profile.id
    join public.central_roles role
      on role.id = user_role.role_id
    join public.central_role_permissions role_permission
      on role_permission.role_id = role.id
    join public.central_permissions permission
      on permission.id = role_permission.permission_id
    where profile.id = _actor_id
      and profile.status = 'ativo'
      and permission.code = 'schedules.manage'
  ) then
    raise exception using errcode = '42501', message = 'Permissao schedules.manage obrigatoria.';
  end if;

  if _payload is null or jsonb_typeof(_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'O payload deve ser um objeto JSON.';
  end if;

  case _action
    when 'shift.create' then
      insert into public.central_shifts (
        code,
        name,
        starts_at,
        ends_at,
        timezone,
        is_active
      ) values (
        nullif(upper(btrim(_payload ->> 'code')), ''),
        nullif(btrim(_payload ->> 'name'), ''),
        (_payload ->> 'starts_at')::time,
        (_payload ->> 'ends_at')::time,
        coalesce(nullif(btrim(_payload ->> 'timezone'), ''), 'America/Sao_Paulo'),
        coalesce((_payload ->> 'is_active')::boolean, true)
      )
      returning id into _entity_id;

      _entity_type := 'central_shifts';

    when 'shift.update' then
      _entity_id := (_payload ->> 'id')::uuid;

      select to_jsonb(shift_row)
        into _previous
      from public.central_shifts shift_row
      where shift_row.id = _entity_id
      for update;

      if _previous is null then
        raise exception using errcode = 'P0002', message = 'Turno nao encontrado.';
      end if;

      update public.central_shifts
      set code = case
            when _payload ? 'code' then nullif(upper(btrim(_payload ->> 'code')), '')
            else code
          end,
          name = case
            when _payload ? 'name' then nullif(btrim(_payload ->> 'name'), '')
            else name
          end,
          starts_at = case
            when _payload ? 'starts_at' then (_payload ->> 'starts_at')::time
            else starts_at
          end,
          ends_at = case
            when _payload ? 'ends_at' then (_payload ->> 'ends_at')::time
            else ends_at
          end,
          timezone = case
            when _payload ? 'timezone' then nullif(btrim(_payload ->> 'timezone'), '')
            else timezone
          end,
          is_active = case
            when _payload ? 'is_active' then (_payload ->> 'is_active')::boolean
            else is_active
          end
      where id = _entity_id;

      _entity_type := 'central_shifts';

    when 'assignment.create' then
      _operator_id := (_payload ->> 'operator_id')::uuid;
      _shift_id := (_payload ->> 'shift_id')::uuid;
      _starts_at := (_payload ->> 'starts_at')::timestamptz;
      _ends_at := (_payload ->> 'ends_at')::timestamptz;
      _status := coalesce(nullif(_payload ->> 'status', ''), 'scheduled');

      insert into public.central_shift_assignments (
        operator_id,
        shift_id,
        starts_at,
        ends_at,
        status,
        assigned_by,
        notes
      ) values (
        _operator_id,
        _shift_id,
        _starts_at,
        _ends_at,
        _status,
        _actor_id,
        nullif(btrim(_payload ->> 'notes'), '')
      )
      returning id into _entity_id;

      _entity_type := 'central_shift_assignments';

    when 'assignment.update' then
      _entity_id := (_payload ->> 'id')::uuid;

      select to_jsonb(assignment_row)
        into _previous
      from public.central_shift_assignments assignment_row
      where assignment_row.id = _entity_id
      for update;

      if _previous is null then
        raise exception using errcode = 'P0002', message = 'Escala nao encontrada.';
      end if;

      update public.central_shift_assignments
      set operator_id = case
            when _payload ? 'operator_id' then (_payload ->> 'operator_id')::uuid
            else operator_id
          end,
          shift_id = case
            when _payload ? 'shift_id' then (_payload ->> 'shift_id')::uuid
            else shift_id
          end,
          starts_at = case
            when _payload ? 'starts_at' then (_payload ->> 'starts_at')::timestamptz
            else starts_at
          end,
          ends_at = case
            when _payload ? 'ends_at' then (_payload ->> 'ends_at')::timestamptz
            else ends_at
          end,
          status = case
            when _payload ? 'status' then (_payload ->> 'status')
            else status
          end,
          notes = case
            when _payload ? 'notes' then nullif(btrim(_payload ->> 'notes'), '')
            else notes
          end
      where id = _entity_id;

      _entity_type := 'central_shift_assignments';

    when 'region.create' then
      insert into public.central_regions (code, name, is_active, metadata)
      values (
        nullif(upper(btrim(_payload ->> 'code')), ''),
        nullif(btrim(_payload ->> 'name'), ''),
        coalesce((_payload ->> 'is_active')::boolean, true),
        coalesce(_payload -> 'metadata', '{}'::jsonb)
      )
      returning id into _entity_id;

      _entity_type := 'central_regions';

    when 'region.update' then
      _entity_id := (_payload ->> 'id')::uuid;

      select to_jsonb(region_row)
        into _previous
      from public.central_regions region_row
      where region_row.id = _entity_id
      for update;

      if _previous is null then
        raise exception using errcode = 'P0002', message = 'Regiao nao encontrada.';
      end if;

      update public.central_regions
      set code = case
            when _payload ? 'code' then nullif(upper(btrim(_payload ->> 'code')), '')
            else code
          end,
          name = case
            when _payload ? 'name' then nullif(btrim(_payload ->> 'name'), '')
            else name
          end,
          is_active = case
            when _payload ? 'is_active' then (_payload ->> 'is_active')::boolean
            else is_active
          end,
          metadata = case
            when _payload ? 'metadata' then coalesce(_payload -> 'metadata', '{}'::jsonb)
            else metadata
          end
      where id = _entity_id;

      _entity_type := 'central_regions';

    when 'region_assignment.create' then
      _operator_id := (_payload ->> 'operator_id')::uuid;
      _region_id := (_payload ->> 'region_id')::uuid;
      _assignment_id := nullif(_payload ->> 'shift_assignment_id', '')::uuid;
      _starts_at := (_payload ->> 'starts_at')::timestamptz;
      _ends_at := (_payload ->> 'ends_at')::timestamptz;
      _status := coalesce(nullif(_payload ->> 'status', ''), 'scheduled');

      insert into public.central_region_assignments (
        operator_id,
        region_id,
        shift_assignment_id,
        starts_at,
        ends_at,
        status,
        assigned_by
      ) values (
        _operator_id,
        _region_id,
        _assignment_id,
        _starts_at,
        _ends_at,
        _status,
        _actor_id
      )
      returning id into _entity_id;

      _entity_type := 'central_region_assignments';

    when 'region_assignment.update' then
      _entity_id := (_payload ->> 'id')::uuid;

      select to_jsonb(region_assignment_row)
        into _previous
      from public.central_region_assignments region_assignment_row
      where region_assignment_row.id = _entity_id
      for update;

      if _previous is null then
        raise exception using errcode = 'P0002', message = 'Atribuicao regional nao encontrada.';
      end if;

      update public.central_region_assignments
      set operator_id = case
            when _payload ? 'operator_id' then (_payload ->> 'operator_id')::uuid
            else operator_id
          end,
          region_id = case
            when _payload ? 'region_id' then (_payload ->> 'region_id')::uuid
            else region_id
          end,
          shift_assignment_id = case
            when _payload ? 'shift_assignment_id'
              then nullif(_payload ->> 'shift_assignment_id', '')::uuid
            else shift_assignment_id
          end,
          starts_at = case
            when _payload ? 'starts_at' then (_payload ->> 'starts_at')::timestamptz
            else starts_at
          end,
          ends_at = case
            when _payload ? 'ends_at' then (_payload ->> 'ends_at')::timestamptz
            else ends_at
          end,
          status = case
            when _payload ? 'status' then (_payload ->> 'status')
            else status
          end
      where id = _entity_id;

      _entity_type := 'central_region_assignments';

    when 'handover.request' then
      _from_assignment_id := (_payload ->> 'from_assignment_id')::uuid;
      _to_assignment_id := nullif(_payload ->> 'to_assignment_id', '')::uuid;

      insert into public.central_shift_handovers (
        from_assignment_id,
        to_assignment_id,
        requested_by,
        status,
        summary
      ) values (
        _from_assignment_id,
        _to_assignment_id,
        _actor_id,
        'pending',
        coalesce(_payload -> 'summary', '{}'::jsonb)
      )
      returning id into _entity_id;

      _entity_type := 'central_shift_handovers';

    when 'handover.resolve' then
      _entity_id := (_payload ->> 'id')::uuid;
      _status := _payload ->> 'status';

      if _status not in ('accepted', 'rejected', 'cancelled') then
        raise exception using errcode = '22023', message = 'Status de passagem de turno invalido.';
      end if;

      select to_jsonb(handover_row)
        into _previous
      from public.central_shift_handovers handover_row
      where handover_row.id = _entity_id
      for update;

      if _previous is null then
        raise exception using errcode = 'P0002', message = 'Passagem de turno nao encontrada.';
      end if;

      if _previous ->> 'status' <> 'pending' then
        raise exception using errcode = '22023', message = 'A passagem de turno ja foi concluida.';
      end if;

      update public.central_shift_handovers
      set status = _status,
          to_assignment_id = case
            when _payload ? 'to_assignment_id'
              then nullif(_payload ->> 'to_assignment_id', '')::uuid
            else to_assignment_id
          end,
          received_by = case when _status = 'accepted' then _actor_id else received_by end,
          completed_at = now()
      where id = _entity_id;

      _entity_type := 'central_shift_handovers';

    else
      raise exception using errcode = '22023', message = 'Acao administrativa de escala invalida.';
  end case;

  execute format(
    'select to_jsonb(row_data) from public.%I row_data where row_data.id = $1',
    _entity_type
  )
  into _next
  using _entity_id;

  insert into public.central_audit_logs (
    operator_id,
    action,
    entity_type,
    entity_id,
    previous_data,
    next_data,
    user_agent
  ) values (
    _actor_id,
    'schedule.' || _action,
    _entity_type,
    _entity_id::text,
    _previous,
    _next,
    left(_user_agent, 500)
  );

  return jsonb_build_object(
    'ok', true,
    'action', _action,
    'entity_type', _entity_type,
    'entity_id', _entity_id,
    'data', _next
  );
end;
$$;

revoke all on function public.central_schedule_admin(uuid, text, jsonb, text)
from public, anon, authenticated;

grant execute on function public.central_schedule_admin(uuid, text, jsonb, text)
to service_role;

commit;
