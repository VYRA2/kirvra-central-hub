-- KIRVRA Central: atomic, permission-checked and audited alert operations.

create unique index if not exists central_alert_assignments_one_active_security_alert
on public.central_alert_assignments (security_alert_id)
where security_alert_id is not null
  and status in ('assigned', 'accepted', 'handling', 'transferred');

create or replace function public.central_claim_security_alert(p_alert_id uuid)
returns public.central_alert_assignments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_alert public.security_alerts;
  v_assignment public.central_alert_assignments;
begin
  if auth.uid() is null or not public.central_has_permission('alerts.take') then
    raise exception 'Sem permissão para assumir alertas.' using errcode = '42501';
  end if;

  select * into v_alert
  from public.security_alerts
  where id = p_alert_id
  for update;

  if not found then
    raise exception 'Alerta não encontrado.' using errcode = 'P0002';
  end if;
  if v_alert.status not in ('new', 'reviewing') then
    raise exception 'Este alerta já possui decisão final.' using errcode = 'P0001';
  end if;

  insert into public.central_alert_assignments (
    security_alert_id, operator_id, assigned_by, status, assigned_at, accepted_at
  ) values (
    p_alert_id, auth.uid(), auth.uid(), 'accepted', now(), now()
  )
  returning * into v_assignment;

  update public.security_alerts
  set status = 'reviewing', updated_at = now()
  where id = p_alert_id;

  perform public.central_log_event(
    'alert.claimed', 'security_alerts', p_alert_id::text,
    to_jsonb(v_alert), jsonb_build_object('assignment_id', v_assignment.id), null
  );
  return v_assignment;
exception
  when unique_violation then
    raise exception 'Este alerta já foi assumido por outro operador.' using errcode = '23505';
end;
$$;

create or replace function public.central_decide_security_alert(
  p_alert_id uuid,
  p_outcome text,
  p_notes text
)
returns public.security_alerts
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous public.security_alerts;
  v_next public.security_alerts;
begin
  if auth.uid() is null or not public.central_has_permission('alerts.handle') then
    raise exception 'Sem permissão para decidir alertas.' using errcode = '42501';
  end if;
  if p_outcome not in ('confirmed', 'false_positive', 'closed') then
    raise exception 'Decisão inválida.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_notes, ''))) < 3 then
    raise exception 'A justificativa é obrigatória.' using errcode = '22023';
  end if;

  select * into v_previous
  from public.security_alerts
  where id = p_alert_id
  for update;
  if not found then
    raise exception 'Alerta não encontrado.' using errcode = 'P0002';
  end if;
  if v_previous.status in ('confirmed', 'false_positive', 'closed') then
    raise exception 'O alerta já possui decisão final.' using errcode = 'P0001';
  end if;

  update public.security_alerts
  set status = p_outcome,
      notes = btrim(p_notes),
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      updated_at = now()
  where id = p_alert_id
  returning * into v_next;

  update public.central_alert_assignments
  set status = 'completed', completed_at = now(), updated_at = now(),
      notes = coalesce(notes || E'\n', '') || btrim(p_notes)
  where security_alert_id = p_alert_id
    and operator_id = auth.uid()
    and status in ('assigned', 'accepted', 'handling', 'transferred');

  perform public.central_log_event(
    'alert.decided', 'security_alerts', p_alert_id::text,
    to_jsonb(v_previous), to_jsonb(v_next), null
  );
  return v_next;
end;
$$;

create or replace function public.central_alert_action(
  p_alert_id uuid,
  p_action text,
  p_notes text default null,
  p_target_operator_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_previous public.security_alerts;
  v_audit_action text;
begin
  if auth.uid() is null or not public.central_has_permission('alerts.handle') then
    raise exception 'Sem permissão para operar alertas.' using errcode = '42501';
  end if;
  if p_action not in ('note_added', 'protocol_started', 'transferred', 'escalated') then
    raise exception 'Ação inválida.' using errcode = '22023';
  end if;

  select * into v_previous from public.security_alerts where id = p_alert_id for update;
  if not found then raise exception 'Alerta não encontrado.' using errcode = 'P0002'; end if;

  if p_action in ('note_added', 'protocol_started') then
    update public.security_alerts
    set notes = concat_ws(E'\n', nullif(notes, ''),
          case when p_action = 'protocol_started' then '[Protocolo iniciado]' else '[Nota] ' || btrim(coalesce(p_notes, '')) end),
        updated_at = now()
    where id = p_alert_id;
  else
    if p_target_operator_id is null or not exists (
      select 1 from public.central_profiles where id = p_target_operator_id and status = 'ativo'
    ) then
      raise exception 'Operador de destino inválido.' using errcode = '22023';
    end if;
    update public.central_alert_assignments
    set status = 'cancelled', updated_at = now()
    where security_alert_id = p_alert_id
      and status in ('assigned', 'accepted', 'handling', 'transferred');
    insert into public.central_alert_assignments (
      security_alert_id, operator_id, assigned_by, status, notes
    ) values (
      p_alert_id, p_target_operator_id, auth.uid(), 'transferred',
      case when p_action = 'escalated' then 'Escalado por ' || auth.uid()::text else 'Transferido por ' || auth.uid()::text end
    );
  end if;

  v_audit_action := case p_action
    when 'note_added' then 'alert.note_added'
    when 'protocol_started' then 'alert.protocol_started'
    when 'transferred' then 'alert.transferred'
    else 'alert.escalated'
  end;
  perform public.central_log_event(
    v_audit_action, 'security_alerts', p_alert_id::text,
    to_jsonb(v_previous), jsonb_build_object('notes', p_notes, 'target_operator_id', p_target_operator_id), null
  );
  return true;
end;
$$;

create or replace function public.central_session_action(
  p_session_id uuid,
  p_action text,
  p_notes text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not public.central_has_permission('alerts.handle') then
    raise exception 'Sem permissão operacional.' using errcode = '42501';
  end if;
  if p_action not in ('note_added', 'escalated') or length(btrim(coalesce(p_notes, ''))) < 3 then
    raise exception 'Ação ou justificativa inválida.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.protection_sessions where id = p_session_id) then
    raise exception 'Sessão não encontrada.' using errcode = 'P0002';
  end if;
  perform public.central_log_event(
    case when p_action = 'note_added' then 'session.note_added' else 'session.escalated' end,
    'protection_sessions', p_session_id::text, null,
    jsonb_build_object('notes', btrim(p_notes)), null
  );
  return true;
end;
$$;

revoke all on function public.central_claim_security_alert(uuid) from public, anon;
revoke all on function public.central_decide_security_alert(uuid, text, text) from public, anon;
revoke all on function public.central_alert_action(uuid, text, text, uuid) from public, anon;
revoke all on function public.central_session_action(uuid, text, text) from public, anon;
grant execute on function public.central_claim_security_alert(uuid) to authenticated;
grant execute on function public.central_decide_security_alert(uuid, text, text) to authenticated;
grant execute on function public.central_alert_action(uuid, text, text, uuid) to authenticated;
grant execute on function public.central_session_action(uuid, text, text) to authenticated;
