-- Receive-only operator/session topics; no target rows, identities or commands.
create table public.admin_live_invalidations (
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 authority_environment_id uuid not null references public.admin_environments(id),
 binding_id uuid references public.suit_environment_bindings(id),
 kinds text[] not null check(cardinality(kinds) between 1 and 5 and kinds <@ array['registry','activity','billing','offers','configuration']::text[]),
 created_at timestamptz not null default clock_timestamp(), delivered_at timestamptz
);
alter table public.admin_live_invalidations enable row level security;
revoke all on public.admin_live_invalidations from public,anon,authenticated,service_role;
create index admin_live_pending_idx on public.admin_live_invalidations(created_at,id) where delivered_at is null;

create function public.super_admin_live_topic() returns text
language plpgsql stable security definer set search_path='' as $$
declare administrator public.platform_admins; session_id uuid;
begin
 administrator:=super_admin_private.assert_platform_owner();
 begin session_id:=(auth.jwt()->>'session_id')::uuid;
 exception when invalid_text_representation then raise exception 'LIVE_SESSION_REQUIRED' using errcode='42501'; end;
 if session_id is null or not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=administrator.user_id
   and (s.not_after is null or s.not_after>statement_timestamp()))
 or not exists(select 1 from public.admin_environments e where e.id=administrator.authority_environment_id and e.status='active')
 then raise exception 'LIVE_SESSION_REQUIRED' using errcode='42501'; end if;
 return 'sas:'||administrator.authority_environment_id::text||':'||administrator.user_id::text||':'||session_id::text;
end $$;
revoke all on function public.super_admin_live_topic() from public,anon,authenticated,service_role;
grant execute on function public.super_admin_live_topic() to authenticated;

-- Managed RLS is already enabled. Do not alter managed tables/schemas/grants.
-- A restrictive guard also protects sas topics from an unrelated permissive policy.
create policy sas_live_receive on realtime.messages for select to authenticated
 using(extension='broadcast' and topic=(select realtime.topic()) and (select realtime.topic())=(select public.super_admin_live_topic()));
create policy sas_live_scope_guard on realtime.messages as restrictive for select to public
 using(case when topic like 'sas:%' or (select realtime.topic()) like 'sas:%'
 then extension='broadcast' and topic=(select realtime.topic()) and (select realtime.topic())=(select public.super_admin_live_topic()) else true end);
create policy sas_live_no_client_send on realtime.messages as restrictive for insert to public
 with check(topic not like 'sas:%' and (select realtime.topic()) not like 'sas:%');

-- realtime.send catches provider errors as warnings. Confirm the managed-table
-- insert before advancing our outbox; this is publication, not a socket ACK.
create function super_admin_private.live_publish(p_id uuid,p_environment uuid,p_user uuid,p_session uuid,p_kinds text[])
returns void language plpgsql security definer set search_path='' as $$
declare topic_name text:='sas:'||p_environment::text||':'||p_user::text||':'||p_session::text;
begin
 perform realtime.send(jsonb_build_object('id',p_id,'authorityEnvironmentId',p_environment,'kinds',p_kinds),'invalidate',topic_name,true);
 if not exists(select 1 from realtime.messages m where m.topic=topic_name and m.event='invalidate' and m.extension='broadcast'
   and m.private and m.payload->>'id'=p_id::text and m.inserted_at>=(transaction_timestamp() at time zone 'UTC')) then
  raise exception 'LIVE_PUBLICATION_NOT_ACCEPTED' using errcode='55000';
 end if;
end $$;

create function super_admin_private.live_deliver(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.admin_live_invalidations; recipient record;
begin
 select * into item from public.admin_live_invalidations where id=p_id for update;
 if item.id is null or item.delivered_at is not null then return true; end if;
 -- Recipients are resolved at delivery time, never captured before revocation.
 for recipient in select a.user_id,s.id as session_id from public.platform_admins a
 join public.admin_environments e on e.id=a.authority_environment_id and e.status='active'
 join auth.sessions s on s.user_id=a.user_id and (s.not_after is null or s.not_after>statement_timestamp())
 where a.enabled and a.role='owner' and a.authority_environment_id=item.authority_environment_id
 and (item.binding_id is null or exists(select 1 from public.suit_environment_bindings b
   join public.suit_registry suit on suit.id=b.suit_id and suit.status='active'
   join public.admin_environments target on target.id=b.target_environment_id and target.status='active'
   where b.id=item.binding_id and b.admin_environment_id=a.authority_environment_id and b.status='active')) for share of a,s,e loop
  perform super_admin_private.live_publish(item.id,item.authority_environment_id,recipient.user_id,recipient.session_id,item.kinds);
 end loop;
 update public.admin_live_invalidations set delivered_at=clock_timestamp() where id=item.id;
 return true;
end $$;

create function super_admin_private.live_enqueue(p_source text,p_environment uuid,p_binding uuid,p_kinds text[])
returns void language plpgsql security definer set search_path='' as $$
declare item_id uuid;
begin
 if p_environment is null then return; end if;
 insert into public.admin_live_invalidations(source_key,authority_environment_id,binding_id,kinds)
 values(p_source,p_environment,p_binding,p_kinds) on conflict(source_key) do nothing returning id into item_id;
 if item_id is null then return; end if;
 -- A transport failure must not roll back an authorized business command.
 -- The sanitized outbox stays pending for explicit server-only recovery.
 begin perform super_admin_private.live_deliver(item_id); exception when others then null; end;
end $$;

create function public.super_admin_live_flush(p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare item record; delivered integer:=0;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
 if p_limit is null or p_limit not between 1 and 100 then raise exception 'INVALID_LIMIT' using errcode='22023'; end if;
 for item in select id from public.admin_live_invalidations where delivered_at is null order by created_at,id
 limit p_limit for update skip locked loop
  begin if super_admin_private.live_deliver(item.id) then delivered:=delivered+1; end if;
  exception when others then null; end;
 end loop;
 return delivered;
end $$;
revoke all on function public.super_admin_live_flush(integer) from public,anon,authenticated,service_role;
grant execute on function public.super_admin_live_flush(integer) to service_role;

create function super_admin_private.live_source() returns trigger
language plpgsql security definer set search_path='' as $$
declare environment_id uuid; binding_id uuid; kinds text[]; source_id text; operation text;
begin
 if tg_table_name='control_plane_events' then
  environment_id:=new.authority_environment_id; kinds:=array['registry','activity']; source_id:=new.id::text;
 elsif tg_table_name='adapter_attempt_results' then
  select d.binding_id,d.envelope->>'operation' into binding_id,operation
  from public.adapter_attempts a join public.adapter_dispatches d on d.id=a.dispatch_id where a.id=new.attempt_id;
  -- Reading an invalidated projection must never invalidate it again.
  if operation not like '%.command' then return new; end if;
  kinds:=case operation when 'shop.billing.command' then array['activity','billing','offers','configuration'] else array['activity','registry'] end;
  source_id:=new.attempt_id::text;
 elsif tg_table_name='activity_remote_events' then
  binding_id:=new.binding_id; kinds:=array['activity']; source_id:=new.binding_id::text||':'||new.stream||':'||new.event_id::text;
 elsif tg_table_name='adapter_manifest_observations' then
  binding_id:=new.binding_id; kinds:=array['registry']; source_id:=new.id::text;
 end if;
 if binding_id is not null then select b.admin_environment_id into environment_id from public.suit_environment_bindings b where b.id=binding_id; end if;
 perform super_admin_private.live_enqueue(tg_table_name||':'||source_id,environment_id,binding_id,kinds);
 return new;
end $$;
create trigger live_configuration after insert on public.control_plane_events for each row execute function super_admin_private.live_source();
create trigger live_command_receipt after insert on public.adapter_attempt_results for each row execute function super_admin_private.live_source();
create trigger live_remote_observation after insert on public.activity_remote_events for each row execute function super_admin_private.live_source();
create trigger live_manifest after insert on public.adapter_manifest_observations for each row execute function super_admin_private.live_source();

-- A final empty hint closes a cached subscription after operator revocation.
-- Subsequent emissions select enabled recipients only. No Auth-schema trigger.
create function super_admin_private.live_operator_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient record; event_id uuid:=gen_random_uuid();
begin
 if old.enabled and (not new.enabled or old.authority_environment_id<>new.authority_environment_id) then
  for recipient in select id from auth.sessions where user_id=old.user_id and (not_after is null or not_after>statement_timestamp()) loop
   begin perform super_admin_private.live_publish(event_id,old.authority_environment_id,old.user_id,recipient.id,array['registry']);
   exception when others then null; end;
  end loop;
 end if;
 return new;
end $$;
create trigger live_operator_revocation after update on public.platform_admins for each row execute function super_admin_private.live_operator_change();
revoke all on function super_admin_private.live_publish(uuid,uuid,uuid,uuid,text[]),super_admin_private.live_deliver(uuid),super_admin_private.live_enqueue(text,uuid,uuid,text[]),
 super_admin_private.live_source(),super_admin_private.live_operator_change() from public,anon,authenticated,service_role;
