-- Offline cash commands gain a terminal request record around the existing atomic commands.
create table shop_private.offline_cash_requests (
  request_id uuid primary key, shop_id uuid not null references public.shops(id),
  actor_profile_id uuid not null references public.profiles(id), payload jsonb not null,
  result_id uuid, completed_at timestamptz, resolution_request_id uuid unique,
  resolution_reason text, resolved_at timestamptz,
  constraint offline_cash_terminal check(not(completed_at is not null and resolved_at is not null))
);
revoke all on shop_private.offline_cash_requests from public,anon,authenticated;
create trigger offline_cash_request_immutable before update or delete on shop_private.offline_cash_requests
  for each row execute function shop_private.protect_offline_pos_request();

create function shop_private.offline_cash_actor(p_kind text,p_shop_id uuid,p_args jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_session public.cash_sessions%rowtype; v_actor record;
begin
  if p_kind is null or p_kind not in ('movement','close') or jsonb_typeof(p_args) is distinct from 'object'
    or (p_args->>'p_shop_id')::uuid is distinct from p_shop_id or (p_args->>'p_request_id')::uuid is null
    or (select count(*) from jsonb_object_keys(p_args))<>(case when p_kind='movement' then 7 else 5 end) then
    raise exception 'INVALID_OFFLINE_CASH_COMMAND' using errcode='22023';
  end if;
  select * into v_session from public.cash_sessions where id=(p_args->>'p_session_id')::uuid and shop_id=p_shop_id;
  if not found then raise exception 'CASH_SHIFT_NOT_FOUND' using errcode='P0002'; end if;
  select * into v_actor from shop_private.assert_cash_shift_access(p_shop_id,v_session.location_id,
    case when p_kind='movement' then 'cash_shifts.adjust' else 'cash_shifts.use' end);
  if p_kind='close' and v_session.opened_by_membership_id<>v_actor.membership_id
    and not shop_private.has_permission(p_shop_id,'cash_shifts.manage') then
    raise exception 'CASH_SHIFT_OWNER_REQUIRED' using errcode='42501';
  end if;
  return v_actor.profile_id;
end;
$$;
revoke all on function shop_private.offline_cash_actor(text,uuid,jsonb) from public,anon,authenticated;

create function shop_private.replay_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_id uuid:=(p_args->>'p_request_id')::uuid;
  v_payload jsonb; v_request shop_private.offline_cash_requests%rowtype; v_result uuid;
begin
  v_actor:=shop_private.offline_cash_actor(p_kind,p_shop_id,p_args);
  v_payload:=jsonb_build_object('kind',p_kind,'args',p_args);
  insert into shop_private.offline_cash_requests(request_id,shop_id,actor_profile_id,payload)
    values(v_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_cash_requests where request_id=v_id for update;
  if v_request.shop_id<>p_shop_id or v_request.actor_profile_id<>v_actor or v_request.payload<>v_payload then
    raise exception 'OFFLINE_CASH_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  if v_request.resolved_at is not null then raise exception 'OFFLINE_CASH_CANCELLED' using errcode='23514'; end if;
  if p_kind='movement' then
    v_result:=shop_private.record_cash_movement(v_id,p_shop_id,(p_args->>'p_session_id')::uuid,
      p_args->>'p_kind',(p_args->>'p_amount')::numeric,p_args->>'p_reason',p_args->>'p_reference');
  else
    v_result:=shop_private.close_cash_shift(v_id,p_shop_id,(p_args->>'p_session_id')::uuid,
      (p_args->>'p_counted_amount')::numeric,p_args->>'p_notes');
  end if;
  update shop_private.offline_cash_requests set result_id=v_result,completed_at=clock_timestamp() where request_id=v_id;
  return v_result;
end;
$$;
revoke all on function shop_private.replay_offline_cash_command(text,uuid,jsonb) from public,anon,authenticated;
create function public.replay_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb)
returns uuid language sql security definer set search_path='' as $$
  select shop_private.replay_offline_cash_command(p_kind,p_shop_id,p_args);
$$;
revoke all on function public.replay_offline_cash_command(text,uuid,jsonb) from public,anon;
grant execute on function public.replay_offline_cash_command(text,uuid,jsonb) to authenticated;

create function shop_private.reconcile_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb,p_resolution_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_id uuid:=(p_args->>'p_request_id')::uuid;
  v_payload jsonb; v_request shop_private.offline_cash_requests%rowtype;
begin
  v_actor:=shop_private.offline_cash_actor(p_kind,p_shop_id,p_args);
  if p_resolution_request_id is null or p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then
    raise exception 'INVALID_OFFLINE_RECONCILIATION' using errcode='22023';
  end if;
  v_payload:=jsonb_build_object('kind',p_kind,'args',p_args);
  insert into shop_private.offline_cash_requests(request_id,shop_id,actor_profile_id,payload)
    values(v_id,p_shop_id,v_actor,v_payload) on conflict do nothing;
  select * into v_request from shop_private.offline_cash_requests where request_id=v_id for update;
  if v_request.shop_id<>p_shop_id or v_request.actor_profile_id<>v_actor or v_request.payload<>v_payload then
    raise exception 'OFFLINE_CASH_REQUEST_CONFLICT' using errcode='23505';
  end if;
  if v_request.completed_at is not null then return jsonb_build_object('state','synced','resultId',v_request.result_id); end if;
  if v_request.resolved_at is not null then
    if v_request.resolution_request_id<>p_resolution_request_id or v_request.resolution_reason<>btrim(p_reason) then
      raise exception 'OFFLINE_RESOLUTION_CONFLICT' using errcode='23505';
    end if;
  else
    update shop_private.offline_cash_requests set resolution_request_id=p_resolution_request_id,
      resolution_reason=btrim(p_reason),resolved_at=clock_timestamp() where request_id=v_id;
  end if;
  return jsonb_build_object('state','cancelled','resolutionRequestId',p_resolution_request_id);
end;
$$;
revoke all on function shop_private.reconcile_offline_cash_command(text,uuid,jsonb,uuid,text) from public,anon,authenticated;
create function public.reconcile_offline_cash_command(p_kind text,p_shop_id uuid,p_args jsonb,p_resolution_request_id uuid,p_reason text)
returns jsonb language sql security definer set search_path='' as $$
  select shop_private.reconcile_offline_cash_command(p_kind,p_shop_id,p_args,p_resolution_request_id,p_reason);
$$;
revoke all on function public.reconcile_offline_cash_command(text,uuid,jsonb,uuid,text) from public,anon;
grant execute on function public.reconcile_offline_cash_command(text,uuid,jsonb,uuid,text) to authenticated;
