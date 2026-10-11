-- SAS-M1-AUDIT-001. Observed projections are immutable; cursors are operational state, not audit editors.
create table public.activity_remote_events (
  binding_id uuid not null references public.suit_environment_bindings(id), stream text not null check(stream in ('platform','billing','plan')),
  event_id uuid not null, actor uuid, action text not null, target uuid, reason text not null check(reason in ('','[redacted]')),
  occurred_at timestamptz not null, observed_at timestamptz not null default clock_timestamp(), primary key(binding_id,stream,event_id)
);
create table public.activity_remote_state (
  binding_id uuid not null references public.suit_environment_bindings(id), stream text not null check(stream in ('platform','billing','plan')),
  next_page integer not null default 1 check(next_page between 1 and 10000), observed_total bigint,
  last_observed_at timestamptz, last_failed_at timestamptz, primary key(binding_id,stream)
);
create table public.activity_correlations (
  dispatch_id uuid primary key references public.adapter_dispatches(id), target_audit_id uuid, domain_audit_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
  foreach t in array array['activity_remote_events','activity_remote_state','activity_correlations'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  end loop;
  foreach t in array array['activity_remote_events','activity_correlations'] loop
    execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function super_admin_private.reject_mutation()',t||'_immutable',t);
  end loop;
end $$;
create index activity_remote_time_idx on public.activity_remote_events(occurred_at desc,event_id);
create index activity_remote_filter_idx on public.activity_remote_events(binding_id,action,actor,target,occurred_at desc);
create index activity_correlation_target_idx on public.activity_correlations(target_audit_id);
create index activity_correlation_domain_idx on public.activity_correlations(domain_audit_id);
create index activity_dispatch_time_idx on public.adapter_dispatches(created_at desc,id);
create index activity_attempt_dispatch_idx on public.adapter_attempts(dispatch_id,created_at desc);

-- Extend the existing verifier without changing its cryptographic or payment-evidence validation.
alter function public.super_admin_adapter_complete(uuid,jsonb) rename to super_admin_adapter_complete_before_activity;
alter function public.super_admin_adapter_complete_before_activity(uuid,jsonb) set schema super_admin_private;
revoke all on function super_admin_private.super_admin_adapter_complete_before_activity(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.super_admin_adapter_complete(p_attempt_id uuid,p_response jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result_value jsonb; verified_value jsonb; outcome_value text; d public.adapter_dispatches;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
  result_value:=super_admin_private.super_admin_adapter_complete_before_activity(p_attempt_id,p_response);
  select dispatch.* into d from public.adapter_dispatches dispatch join public.adapter_attempts a on a.dispatch_id=dispatch.id where a.id=p_attempt_id;
  select outcome into outcome_value from public.adapter_attempt_results where attempt_id=p_attempt_id;
  -- Only a verified success/rejection may supply identifiers. Unknown/unsigned responses are never parsed.
  if d.envelope->>'operation' like '%.command' and outcome_value in ('success','target_rejected') then
    verified_value:=(p_response->>'body')::jsonb;
    insert into public.activity_correlations(dispatch_id,target_audit_id,domain_audit_id)
      values(d.id,case when verified_value->>'targetAuditId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (verified_value->>'targetAuditId')::uuid end,
        case when outcome_value='success' and verified_value#>>'{data,auditId}' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (verified_value#>>'{data,auditId}')::uuid end)
      on conflict do nothing;
  end if;
  return result_value;
end $$;

-- Preserve already verified target correlations from the existing immutable attempt receipts.
insert into public.activity_correlations(dispatch_id,target_audit_id)
  select distinct on (d.id) d.id,r.target_audit_id::uuid
  from public.adapter_dispatches d join public.adapter_attempts a on a.dispatch_id=d.id
  join public.adapter_attempt_results r on r.attempt_id=a.id
  where d.envelope->>'operation' like '%.command' and r.outcome='success'
    and r.target_audit_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  order by d.id,a.created_at desc,a.id desc;

create function public.super_admin_activity_context(p_binding uuid,p_stream text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.platform_admins; page_value integer;
begin
  actor:=super_admin_private.assert_platform_owner();
  if p_stream is null or p_stream not in ('platform','billing','plan') then raise exception 'INVALID_REQUEST'; end if;
  perform super_admin_private.adapter_configuration(p_binding,'shop.'||p_stream||'.query',actor.user_id);
  select next_page into page_value from public.activity_remote_state where binding_id=p_binding and stream=p_stream;
  return jsonb_build_object('page',coalesce(page_value,1),'pageSize',25);
end $$;
create function public.super_admin_activity_failure(p_binding uuid,p_stream text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.super_admin_activity_context(p_binding,p_stream);
  insert into public.activity_remote_state(binding_id,stream,last_failed_at) values(p_binding,p_stream,clock_timestamp())
    on conflict(binding_id,stream) do update set last_failed_at=excluded.last_failed_at;
end $$;
-- Called only by the server after signature/envelope verification and closed projection normalization.
create function public.super_admin_activity_observe(p_binding uuid,p_request uuid,p_projection jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare d public.adapter_dispatches; stream_value text; row_value jsonb; page_value integer; current_page integer;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
  select * into d from public.adapter_dispatches where request_id=p_request and binding_id=p_binding;
  stream_value:=p_projection->>'stream'; page_value:=(p_projection->>'page')::integer;
  if stream_value is null or stream_value not in ('platform','billing','plan')
    or d.id is null or d.envelope->>'operation' is distinct from 'shop.'||stream_value||'.query'
    or d.envelope#>>'{payload,resource}' is distinct from 'audit'
    or d.envelope#>>'{payload,page}' is distinct from page_value::text
    or page_value is null or page_value not between 1 and 10000
    or (p_projection->>'pageSize')::integer is distinct from 25
    or (p_projection-array['items','total','page','pageSize','stream'])<>'{}'::jsonb
    or not exists(select 1 from public.adapter_attempts a join public.adapter_attempt_results r on r.attempt_id=a.id where a.dispatch_id=d.id and r.outcome='success')
    or jsonb_typeof(p_projection->'items') is distinct from 'array' or jsonb_array_length(p_projection->'items')>25
    or coalesce((p_projection->>'total')::bigint,-1)<0 then raise exception 'INVALID_REQUEST'; end if;
  perform super_admin_private.adapter_configuration(p_binding,d.envelope->>'operation',d.actor_user_id);
  perform pg_advisory_xact_lock(hashtextextended(p_binding::text||stream_value,0));
  select next_page into current_page from public.activity_remote_state where binding_id=p_binding and stream=stream_value;
  if coalesce(current_page,1)<>page_value then raise exception 'CURSOR_CHANGED'; end if;
  for row_value in select value from jsonb_array_elements(p_projection->'items') loop
    if (row_value-array['id','actor','action','target','reason','occurredAt'])<>'{}'::jsonb
      or jsonb_typeof(row_value->'action') is distinct from 'string'
      or jsonb_typeof(row_value->'reason') is distinct from 'string'
      or row_value->>'action' !~ '^[a-z][a-z0-9_.-]{0,127}$' or row_value->>'reason' not in ('','[redacted]') then raise exception 'INVALID_REQUEST'; end if;
    insert into public.activity_remote_events(binding_id,stream,event_id,actor,action,target,reason,occurred_at)
      values(p_binding,stream_value,(row_value->>'id')::uuid,(row_value->>'actor')::uuid,row_value->>'action',(row_value->>'target')::uuid,row_value->>'reason',(row_value->>'occurredAt')::timestamptz)
      on conflict do nothing;
  end loop;
  insert into public.activity_remote_state(binding_id,stream,next_page,observed_total,last_observed_at)
    values(p_binding,stream_value,case when page_value*25 >= (p_projection->>'total')::bigint or page_value>=10000 then 1 else page_value+1 end,(p_projection->>'total')::bigint,clock_timestamp())
    on conflict(binding_id,stream) do update set next_page=excluded.next_page,observed_total=excluded.observed_total,last_observed_at=excluded.last_observed_at;
end $$;

create function public.super_admin_activity_read(p_query jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare administrator public.platform_admins; page_value integer; size_value integer; result_value jsonb; sources jsonb;
begin
  administrator:=super_admin_private.assert_platform_owner();
  perform super_admin_private.assert_payload_keys(p_query,array['page','pageSize','order','suit','environment','action','actor','target','from','to','correlationId','requestId']);
  page_value:=coalesce((p_query->>'page')::integer,1); size_value:=coalesce((p_query->>'pageSize')::integer,25);
  if page_value not between 1 and 10000 or size_value not between 1 and 100 or coalesce(p_query->>'order','desc') not in ('asc','desc') then raise exception 'INVALID_REQUEST'; end if;
  with events as (
    select 'admin:'||e.id as id,'admin'::text as source,s.stable_key as suit,e.authority_environment_id,e.target_environment_id as environment,
      e.actor_user_id as actor,e.action,e.target_id as target,'success'::text as status,
      case when e.reason<>'' then '[redacted]' else '' end as reason,e.request_id,e.correlation_id,e.occurred_at
    from public.control_plane_events e left join public.suit_registry s on s.id=e.suit_id
    where e.authority_environment_id=administrator.authority_environment_id
    union all
    select 'dispatch:'||d.id,'admin-adapter',s.stable_key,b.admin_environment_id,b.target_environment_id,d.actor_user_id,
      d.envelope->>'operation'||coalesce('.'||(d.envelope#>>'{payload,action}'),''),
      coalesce(nullif(d.envelope#>>'{payload,submissionId}','')::uuid,nullif(d.envelope#>>'{payload,shopId}','')::uuid,d.binding_id),
      coalesce(r.outcome,'pending'),case when nullif(d.envelope->>'reason','') is not null then '[redacted]' else '' end,d.request_id,d.correlation_id,coalesce(r.created_at,d.created_at)
    from public.adapter_dispatches d join public.suit_environment_bindings b on b.id=d.binding_id join public.suit_registry s on s.id=b.suit_id
    left join lateral(select result.* from public.adapter_attempts a join public.adapter_attempt_results result on result.attempt_id=a.id where a.dispatch_id=d.id order by a.created_at desc,a.id desc limit 1) r on true
    where b.admin_environment_id=administrator.authority_environment_id and d.envelope->>'operation' like '%.command'
    union all
    select 'remote:'||e.binding_id||':'||e.stream||':'||e.event_id,'shop-'||e.stream,s.stable_key,b.admin_environment_id,b.target_environment_id,
      coalesce(d.actor_user_id,e.actor),e.action,e.target,coalesce((select r.outcome from public.adapter_attempts a join public.adapter_attempt_results r on r.attempt_id=a.id where a.dispatch_id=d.id order by a.created_at desc,a.id desc limit 1),'recorded'),e.reason,d.request_id,d.correlation_id,e.occurred_at
    from public.activity_remote_events e join public.suit_environment_bindings b on b.id=e.binding_id join public.suit_registry s on s.id=b.suit_id
    left join public.activity_correlations c on (c.domain_audit_id=e.event_id or (e.stream='platform' and c.target_audit_id=e.event_id))
      and exists(select 1 from public.adapter_dispatches linked where linked.id=c.dispatch_id and linked.binding_id=e.binding_id)
    left join public.adapter_dispatches d on d.id=c.dispatch_id and d.binding_id=e.binding_id and (e.stream='platform' or d.envelope->>'operation'='shop.'||e.stream||'.command')
    where b.admin_environment_id=administrator.authority_environment_id
  ), filtered as (
    select * from events e where (p_query->>'suit' is null or e.suit=p_query->>'suit')
      and (p_query->>'environment' is null or coalesce(e.environment,e.authority_environment_id)::text=p_query->>'environment')
      and (p_query->>'action' is null or e.action=p_query->>'action') and (p_query->>'actor' is null or e.actor::text=p_query->>'actor')
      and (p_query->>'target' is null or e.target::text=p_query->>'target')
      and (p_query->>'requestId' is null or e.request_id::text=p_query->>'requestId')
      and (p_query->>'correlationId' is null or e.correlation_id::text=p_query->>'correlationId')
      and (p_query->>'from' is null or e.occurred_at >= (p_query->>'from')::timestamptz)
      and (p_query->>'to' is null or e.occurred_at <= (p_query->>'to')::timestamptz)
  ), paged as (
    select * from filtered order by
      case when coalesce(p_query->>'order','desc')='asc' then occurred_at end asc,
      case when coalesce(p_query->>'order','desc')='desc' then occurred_at end desc,id
      limit size_value offset (page_value-1)*size_value
  ) select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'source',source,'suit',suit,'environment',coalesce(environment,authority_environment_id),
    'actor',actor,'action',action,'target',target,'status',status,'reason',reason,'requestId',request_id,'correlationId',correlation_id,'occurredAt',occurred_at)) from paged),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',page_value,'pageSize',size_value) into result_value;
  select coalesce(jsonb_agg(jsonb_build_object('bindingId',b.id,'suit',s.stable_key,'environment',b.target_environment_id,'stream',streams.stream,
    'nextPage',coalesce(state.next_page,1),'lastObservedAt',state.last_observed_at,'lastFailedAt',state.last_failed_at,'observedTotal',state.observed_total,'coverage','partial')),'[]'::jsonb) into sources
    from public.suit_environment_bindings b join public.suit_registry s on s.id=b.suit_id
    join public.adapter_registrations a on a.binding_id=b.id and a.status='active'
    cross join (values('platform'),('billing'),('plan')) streams(stream)
    join public.adapter_capability_policy p on p.adapter_registration_id=a.id and p.enabled and p.capability_key='shop.'||streams.stream||'.query' and ('shop.'||streams.stream||'.query')=any(p.query_scopes)
    left join public.activity_remote_state state on state.binding_id=b.id and state.stream=streams.stream
    where b.admin_environment_id=administrator.authority_environment_id and b.status='active' and (p_query->>'suit' is null or s.stable_key=p_query->>'suit')
      and (p_query->>'environment' is null or b.target_environment_id::text=p_query->>'environment');
  return result_value||jsonb_build_object('sources',sources,'coverage','partial');
end $$;
revoke all on function public.super_admin_adapter_complete(uuid,jsonb),public.super_admin_activity_context(uuid,text),public.super_admin_activity_failure(uuid,text),public.super_admin_activity_observe(uuid,uuid,jsonb),public.super_admin_activity_read(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_adapter_complete(uuid,jsonb),public.super_admin_activity_observe(uuid,uuid,jsonb) to service_role;
grant execute on function public.super_admin_activity_context(uuid,text),public.super_admin_activity_failure(uuid,text),public.super_admin_activity_read(jsonb) to authenticated;

-- Enable the activity renderer only for explicitly configured navigation rows.
create or replace function super_admin_private.registry_projection()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare administrator public.platform_admins;
begin
  administrator := super_admin_private.assert_platform_owner();
  return jsonb_build_object('suits', coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', suit.stable_key, 'label', suit.display_name,
      'description', suit.description, 'asset', suit.asset_reference,
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'key', item.stable_key, 'label', item.label,
          'description', item.description, 'module', item.module_kind, 'bindingId', case when item.module_kind='manual-transfer' then super_admin_private.transfer_binding(suit.id) else null end
        ) order by item.sort_order, item.stable_key)
        from public.navigation_items item
        where item.suit_id = suit.id and item.enabled
          and item.route_descriptor = '{}'::jsonb
          and item.visibility_policy in ('{}'::jsonb, '{"role":"owner"}'::jsonb)
          and (
            (item.module_kind='activity' and item.required_capability_key is null) or (item.module_kind='manual-transfer' and item.required_capability_key='shop.billing.query' and item.required_capability_version='1.0' and super_admin_private.transfer_binding(suit.id) is not null) or (item.module_kind = 'overview' and item.required_capability_key is null)
            or (
              item.module_kind = 'capabilities'
              and item.required_capability_key = 'adapter.capabilities.read'
              and item.required_capability_version = '1.0'
              and exists (
                select 1 from public.suit_environment_bindings binding
                join public.admin_environments target_environment on target_environment.id = binding.target_environment_id
                join public.adapter_registrations adapter on adapter.binding_id = binding.id
                join public.adapter_capability_policy policy on policy.adapter_registration_id = adapter.id
                join lateral (
                  select observation.* from public.adapter_manifest_observations observation
                  where observation.binding_id = binding.id
                  order by observation.observed_at desc, observation.id desc limit 1
                ) manifest on true
                where binding.suit_id = suit.id
                  and binding.admin_environment_id = administrator.authority_environment_id
                  and binding.status = 'active' and adapter.status = 'active'
                  and target_environment.status = 'active'
                  and adapter.protocol_min_version = '1.0' and adapter.protocol_max_version = '1.0'
                  and adapter.manifest_schema_version = '1.0'
                  and policy.enabled and policy.capability_key = item.required_capability_key
                  and policy.min_version = '1.0' and policy.max_version = '1.0'
                  and 'adapter.capabilities.read' = any(policy.query_scopes)
                  and manifest.verification_outcome = 'verified'
                  and manifest.expires_at > statement_timestamp()
                  and manifest.observed_at <= statement_timestamp()
                  and manifest.observed_at > statement_timestamp() - make_interval(secs => adapter.manifest_max_age_seconds)
                  and '1.0' = any(manifest.protocol_versions)
                  and manifest.verified_capabilities @> '[{"key":"adapter.capabilities.read","version":"1.0","queryScopes":["adapter.capabilities.read"]}]'::jsonb
              )
            )
          )
      ), '[]'::jsonb)
    ) order by suit.sort_order, suit.stable_key)
    from public.suit_registry suit
    where suit.status = 'active' and suit.adapter_contract_version = '1.0'
      and exists (
        select 1 from public.suit_environment_bindings binding
        join public.admin_environments environment on environment.id = binding.target_environment_id
        where binding.suit_id = suit.id
          and binding.admin_environment_id = administrator.authority_environment_id
          and binding.status = 'active' and environment.status = 'active'
      )
  ), '[]'::jsonb));
end;
$$;
