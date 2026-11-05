-- HQ private push invalidations. No scheduled company/Brain data polling.
-- Realtime messages contain category hints only; server endpoints remain the
-- authoritative snapshot and fresh-session authorization boundary.

alter table hq_private.brain_sync_state add column content_digest text
  check (content_digest ~ '^[0-9a-f]{64}$');

create function hq_private.brain_index_digest() returns text
language sql stable security invoker set search_path='' as $$
  select pg_catalog.encode(extensions.digest(coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_array(f.file_id,
      (select pg_catalog.array_agg(p.parent_id order by p.parent_id) from pg_catalog.unnest(f.parent_ids) as p(parent_id)),
      f.name,f.mime_type,f.source_version,extract(epoch from f.modified_at),f.trashed)
    order by f.file_id),'[]'::jsonb)::text,'sha256'),'hex')
  from hq_private.brain_files f
  where f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.in_scope;
$$;
revoke all on function hq_private.brain_index_digest() from public,anon,authenticated,service_role;
update hq_private.brain_sync_state set content_digest=hq_private.brain_index_digest()
  where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';


create or replace function hq_private.brain_sync_claim(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state; v_claimed boolean := false; v_channel jsonb;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_owner = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'HQ_INVALID_OWNER' using errcode = '22023';
  end if;
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  if (v_state.generation>v_state.completed_generation or v_state.full_reconcile)
    and v_state.retry_at <= pg_catalog.clock_timestamp() and
    (v_state.lease_owner is null or v_state.lease_expires_at <= pg_catalog.clock_timestamp() or v_state.lease_owner = p_owner)
    and not exists(select 1 from hq_private.brain_sync_receipts r where r.owner_id = p_owner) then
    update hq_private.brain_sync_state set lease_owner = p_owner,
      lease_generation = case when lease_owner = p_owner then lease_generation else generation end,
      lease_expires_at = pg_catalog.clock_timestamp() + interval '3 minutes',
      updated_at = pg_catalog.clock_timestamp()
      where root_id=v_state.root_id returning * into v_state;
    v_claimed := true;
  end if;
  select pg_catalog.jsonb_build_object('id',c.channel_id,'resourceId',c.resource_id,'expiresAt',c.expires_at)
    into v_channel from hq_private.brain_channels c
    where c.confirmed_at is not null and c.expires_at > pg_catalog.clock_timestamp()
    order by c.expires_at desc,c.channel_id limit 1;
  return pg_catalog.jsonb_build_object('claimed',v_claimed,'rootId',v_state.root_id,
    'cursor',v_state.cursor,'generation',case when v_claimed then v_state.lease_generation else v_state.generation end,
    'fullReconcile',v_state.full_reconcile,'leaseExpiresAt',case when v_claimed then v_state.lease_expires_at else null end,
    'retryAt',v_state.retry_at,'channel',v_channel);
end;
$$;

-- Join authorization is checked against current HQ-owned membership and a live
-- Auth session. Realtime caches joins; the receiving server must additionally
-- revalidate founder access before forwarding each incoming category hint.
create function hq_private.can_receive_events() returns boolean
language plpgsql security definer set search_path='' as $$
begin
  return hq_private.founder_uid() is not null;
end;
$$;
create function public.hq_can_receive_events() returns boolean
language sql security invoker set search_path='' as $$ select hq_private.can_receive_events(); $$;
revoke all on function hq_private.can_receive_events(),public.hq_can_receive_events() from public,anon,authenticated,service_role;
grant execute on function hq_private.can_receive_events(),public.hq_can_receive_events() to authenticated;

-- Provider-owned Realtime RLS is already enabled; only supported policies are
-- added. An unrelated permissive policy cannot open HQ or allow client spoofing.
create policy hq_live_receive on realtime.messages for select to authenticated
  using (extension='broadcast' and topic='hq-live' and topic=(select realtime.topic())
    and (select public.hq_can_receive_events()));
create policy hq_live_scope_guard on realtime.messages as restrictive for select to public
  using (case when topic='hq-live' or (select realtime.topic())='hq-live'
    then extension='broadcast' and topic='hq-live' and topic=(select realtime.topic())
      and (select public.hq_can_receive_events()) else true end);
create policy hq_live_no_client_send on realtime.messages as restrictive for insert to public
  with check (topic<>'hq-live' and coalesce((select realtime.topic()),'')<>'hq-live');

create table hq_private.live_invalidations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  kind text not null check (kind in ('brain','company','access')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  delivered_at timestamptz
);
alter table hq_private.live_invalidations enable row level security;
revoke all on hq_private.live_invalidations from public,anon,authenticated,service_role;
create index hq_live_pending_idx on hq_private.live_invalidations(created_at,id) where delivered_at is null;

create function hq_private.live_deliver(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_item hq_private.live_invalidations;
begin
  select i.* into v_item from hq_private.live_invalidations i where i.id=p_id for update;
  if not found or v_item.delivered_at is not null then return true; end if;
  perform realtime.send(pg_catalog.jsonb_build_object('kind',v_item.kind),'invalidate','hq-live',true);
  -- realtime.send can catch errors as warnings. Require a matching managed
  -- message in this transaction window before marking the hint published.
  -- This is transport publication evidence, never a browser/socket ACK.
  if not exists(select 1 from realtime.messages m where m.topic='hq-live' and m.event='invalidate'
    and m.extension='broadcast' and m.private and m.payload=pg_catalog.jsonb_build_object('kind',v_item.kind)
    and m.inserted_at >= (pg_catalog.transaction_timestamp() at time zone 'UTC')) then return false; end if;
  update hq_private.live_invalidations set delivered_at=pg_catalog.clock_timestamp() where id=p_id;
  return true;
end;
$$;

create function hq_private.live_emit(p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_key text;
begin
  if p_kind is null or p_kind not in ('brain','company','access') then raise exception 'HQ_INVALID_LIVE_KIND' using errcode='22023'; end if;
  v_key := 'hq.live_emitted_' || p_kind;
  if pg_catalog.current_setting(v_key,true)='1' then return; end if;
  insert into hq_private.live_invalidations(kind) values(p_kind) returning id into v_id;
  -- An unavailable push transport must not prevent access revocation or an
  -- otherwise authorized atomic company decision. Preserve a private receipt
  -- for explicit recovery; reconnect always reads an authoritative snapshot.
  begin perform hq_private.live_deliver(v_id); exception when others then null; end;
  perform pg_catalog.set_config(v_key,'1',true);
  delete from hq_private.live_invalidations where delivered_at<pg_catalog.clock_timestamp()-interval '7 days';
end;
$$;

create function hq_private.live_flush(p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$
declare v_item record; v_count integer:=0;
begin
  perform hq_private.require_brain_service();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'HQ_INVALID_LIVE_LIMIT' using errcode='22023'; end if;
  for v_item in select i.id from hq_private.live_invalidations i where i.delivered_at is null
    order by i.created_at,i.id limit p_limit for update skip locked loop
    begin if hq_private.live_deliver(v_item.id) then v_count:=v_count+1; end if;
    exception when others then null; end;
  end loop;
  return v_count;
end;
$$;
create function public.hq_live_flush(p_limit integer default 20) returns integer
language sql security invoker set search_path='' as $$ select hq_private.live_flush(p_limit); $$;
revoke all on function hq_private.live_deliver(uuid),hq_private.live_emit(text),hq_private.live_flush(integer),public.hq_live_flush(integer)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.live_flush(integer),public.hq_live_flush(integer) to service_role;

create function hq_private.live_row_changed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new is not distinct from old then return null; end if;
  perform hq_private.live_emit(tg_argv[0]);
  return null;
end;
$$;
create function hq_private.live_brain_committed() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.content_digest is distinct from old.content_digest then perform hq_private.live_emit('brain'); end if;
  return null;
end;
$$;
revoke all on function hq_private.live_row_changed(),hq_private.live_brain_committed() from public,anon,authenticated,service_role;
create trigger hq_live_brain after update of content_digest on hq_private.brain_sync_state
  for each row execute function hq_private.live_brain_committed();
create trigger hq_live_plans after insert or update or delete on public.hq_company_plans
  for each row execute function hq_private.live_row_changed('company');
create trigger hq_live_departments after insert or update or delete on public.hq_departments
  for each row execute function hq_private.live_row_changed('company');
create trigger hq_live_founders after insert or update or delete on public.hq_founders
  for each row execute function hq_private.live_row_changed('access');
create trigger hq_live_invitations after insert or update or delete on hq_private.founder_invitations
  for each row execute function hq_private.live_row_changed('access');

-- Remove the data-polling job. Keep the Vault token and fixed staging endpoint,
-- but expose an operator-only route selector with renewal as the safe default.
do $$
declare v_job record;
begin
  for v_job in select j.jobid from cron.job j where j.jobname='hq-brain-drive-recovery' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
end;
$$;
drop function hq_private.invoke_brain_sync();
create function hq_private.invoke_brain_sync(p_route text default 'renew') returns bigint
language plpgsql security definer set search_path='' as $$
declare v_endpoint text; v_token text; v_request_id bigint;
begin
  if p_route is null or p_route not in ('run','renew') then raise exception 'HQ_INVALID_SYNC_ROUTE' using errcode='22023'; end if;
  select c.endpoint,s.decrypted_secret into v_endpoint,v_token
    from hq_private.brain_worker_configuration c join vault.decrypted_secrets s on s.id=c.vault_secret_id
    where c.singleton and c.project_ref='dpruoncalmwicrqhqelu';
  if v_endpoint is null or v_token is null then raise exception 'HQ_BRAIN_SCHEDULER_NOT_CONFIGURED'; end if;
  v_endpoint := pg_catalog.regexp_replace(v_endpoint,'/run$','/'||p_route);
  select net.http_post(url:=v_endpoint,
    headers:=pg_catalog.jsonb_build_object('Content-Type','application/json','X-HQ-Brain-Sync-Token',v_token),
    body:='{}'::jsonb,timeout_milliseconds:=130000) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function hq_private.invoke_brain_sync(text) from public,anon,authenticated,service_role;

create or replace function hq_private.configure_brain_scheduler(p_project_ref text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_secret_id uuid; v_token text; v_hash text; v_job_id bigint; v_job record;
begin
  if p_project_ref is distinct from 'dpruoncalmwicrqhqelu' then raise exception 'HQ_BRAIN_STAGING_ONLY'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21128,3);
  select c.vault_secret_id,s.decrypted_secret into v_secret_id,v_token
    from hq_private.brain_worker_configuration c join vault.decrypted_secrets s on s.id=c.vault_secret_id where c.singleton;
  if v_secret_id is null then
    v_token := pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
    select vault.create_secret(v_token,'hq_brain_sync_worker_staging','HQ Drive bridge scoped invocation token') into v_secret_id;
  end if;
  v_hash := pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex');
  insert into hq_private.brain_worker_configuration(singleton,project_ref,endpoint,vault_secret_id,token_hash)
    values(true,p_project_ref,'https://dpruoncalmwicrqhqelu.supabase.co/functions/v1/brain-sync/run',v_secret_id,v_hash)
    on conflict(singleton) do update set configured_at=pg_catalog.clock_timestamp();
  for v_job in select j.jobid from cron.job j where j.jobname='hq-brain-drive-recovery' loop perform cron.unschedule(v_job.jobid); end loop;
  -- Calendar maintenance every five day-of-month steps (at most five days
  -- apart), shorter than six-day watches. /renew must never fetch Drive data.
  select cron.schedule('hq-brain-watch-renewal','0 3 */5 * *','select hq_private.invoke_brain_sync(''renew'');') into v_job_id;
  return pg_catalog.jsonb_build_object('configured',true,'projectRef',p_project_ref,'kind','watch-renewal',
    'schedule','0 3 */5 * *','jobId',v_job_id);
end;
$$;
revoke all on function hq_private.configure_brain_scheduler(text) from public,anon,authenticated,service_role;

-- Already configured staging installs switch schedules in the same forward
-- transaction; a fresh installation remains opt-in through operator setup.
do $$
begin
  if exists(select 1 from hq_private.brain_worker_configuration where singleton) then
    perform hq_private.configure_brain_scheduler('dpruoncalmwicrqhqelu');
  end if;
end;
$$;

create or replace function hq_private.brain_sync_commit(p_owner uuid,p_cursor text,p_generation bigint,p_files jsonb,p_complete boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_state hq_private.brain_sync_state; v_previous hq_private.brain_sync_receipts;
  v_file jsonb; v_parent jsonb; v_id text; v_ids text[] := '{}'; v_parents text[];
  v_name text; v_mime text; v_version text; v_modified timestamptz; v_trashed boolean; v_scope boolean; v_result jsonb; v_content_digest text;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_cursor is null or pg_catalog.length(p_cursor) = 0 or pg_catalog.octet_length(p_cursor) > 32768
    or p_generation is null or p_generation < 1 or p_complete is null or p_files is null
    or pg_catalog.jsonb_typeof(p_files) is distinct from 'array' or pg_catalog.octet_length(p_files::text) > 4194304 then
    raise exception 'HQ_INVALID_SYNC_BATCH' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_files) > 5000 then raise exception 'HQ_SYNC_BATCH_TOO_LARGE' using errcode = '22023'; end if;
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  select r.* into v_previous from hq_private.brain_sync_receipts r where r.owner_id = p_owner;
  if found then
    if v_previous.generation <> p_generation or v_previous.cursor <> p_cursor
      or v_previous.files_digest <> pg_catalog.encode(extensions.digest(p_files::text,'sha256'),'hex') or v_previous.complete <> p_complete then
      raise exception 'HQ_SYNC_OWNER_REUSED' using errcode = 'PT409';
    end if;
    return v_previous.result;
  end if;
  if v_state.lease_owner is distinct from p_owner or v_state.lease_expires_at <= pg_catalog.clock_timestamp()
    or v_state.lease_generation is distinct from p_generation then
    raise exception 'HQ_SYNC_LEASE_LOST' using errcode = 'PT409';
  end if;
  if v_state.full_reconcile and not p_complete then raise exception 'HQ_FULL_RECONCILIATION_REQUIRED' using errcode = 'PT409'; end if;
  for v_file in select value from pg_catalog.jsonb_array_elements(p_files) loop
    perform hq_private.require_shape(v_file,
      array['fileId','name','mimeType','parents','version','modifiedTime','trashed','inScope'],
      array['fileId','name','mimeType','parents','version','modifiedTime','trashed','inScope']);
    v_id := hq_private.required_text(v_file->'fileId',200);
    if v_id !~ '^[A-Za-z0-9_-]{10,200}$' or v_id = any(v_ids) then raise exception 'HQ_INVALID_FILE_ID' using errcode = '22023'; end if;
    v_ids := pg_catalog.array_append(v_ids,v_id);
    if pg_catalog.jsonb_typeof(v_file->'parents') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_file->'trashed') is distinct from 'boolean'
      or pg_catalog.jsonb_typeof(v_file->'inScope') is distinct from 'boolean' then
      raise exception 'HQ_INVALID_FILE_METADATA' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(v_file->'parents') > 20 then raise exception 'HQ_INVALID_PARENTS' using errcode = '22023'; end if;
    v_parents := '{}';
    for v_parent in select value from pg_catalog.jsonb_array_elements(v_file->'parents') loop
      v_name := hq_private.required_text(v_parent,200);
      if v_name !~ '^[A-Za-z0-9_-]{10,200}$' or v_name = any(v_parents) then raise exception 'HQ_INVALID_PARENT' using errcode = '22023'; end if;
      v_parents := pg_catalog.array_append(v_parents,v_name);
    end loop;
    v_name := null; v_mime := null; v_version := null; v_modified := null;
    if v_file->'name' <> 'null'::jsonb then v_name := hq_private.required_text(v_file->'name',1024); end if;
    if v_file->'mimeType' <> 'null'::jsonb then v_mime := hq_private.required_text(v_file->'mimeType',200); end if;
    if v_file->'version' <> 'null'::jsonb then
      v_version := hq_private.required_text(v_file->'version',40);
      if v_version !~ '^[0-9]{1,40}$' then raise exception 'HQ_INVALID_SOURCE_VERSION' using errcode = '22023'; end if;
    end if;
    if v_file->'modifiedTime' <> 'null'::jsonb then
      v_name := hq_private.required_text(v_file->'modifiedTime',64);
      if v_name !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$' then
        raise exception 'HQ_INVALID_SOURCE_TIME' using errcode = '22023';
      end if;
      v_modified := v_name::timestamptz;
      if not pg_catalog.isfinite(v_modified) then raise exception 'HQ_INVALID_SOURCE_TIME' using errcode = '22023'; end if;
      v_name := case when v_file->'name' = 'null'::jsonb then null else v_file->>'name' end;
    end if;
    v_trashed := (v_file->>'trashed')::boolean; v_scope := (v_file->>'inScope')::boolean;
    if v_scope and (v_trashed or v_name is null or v_mime is null or v_version is null) then
      raise exception 'HQ_INVALID_SCOPED_FILE' using errcode = '22023';
    end if;
    insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,source_version,modified_at,trashed,in_scope)
      values(v_id,v_state.root_id,v_parents,v_name,v_mime,v_version,v_modified,v_trashed,v_scope)
      on conflict(file_id) do update set parent_ids=excluded.parent_ids,name=excluded.name,mime_type=excluded.mime_type,
        source_version=excluded.source_version,modified_at=excluded.modified_at,trashed=excluded.trashed,
        in_scope=excluded.in_scope,observed_at=pg_catalog.clock_timestamp();
  end loop;
  if p_complete then
    update hq_private.brain_files set in_scope=false,observed_at=pg_catalog.clock_timestamp()
      where root_id=v_state.root_id and in_scope and not(file_id = any(v_ids));
  end if;
  v_content_digest := hq_private.brain_index_digest();
  update hq_private.brain_sync_state set content_digest=v_content_digest,cursor=p_cursor,completed_generation=p_generation,full_reconcile=false,
    lease_owner=null,lease_generation=null,lease_expires_at=null,failures=0,last_error=null,
    retry_at=pg_catalog.clock_timestamp(),last_success_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    where root_id=v_state.root_id returning * into v_state;
  v_result := pg_catalog.jsonb_build_object('committed',true,'generation',p_generation,
    'pending',v_state.generation > v_state.completed_generation,'lastSuccessAt',v_state.last_success_at);
  insert into hq_private.brain_sync_receipts(owner_id,generation,cursor,files_digest,complete,result)
    values(p_owner,p_generation,p_cursor,pg_catalog.encode(extensions.digest(p_files::text,'sha256'),'hex'),p_complete,v_result);
  -- Only short-lived metadata replay receipts are pruned. Source/plan evidence
  -- and founder decision history are never deleted by bridge maintenance.
  delete from hq_private.brain_sync_receipts where recorded_at < pg_catalog.clock_timestamp() - interval '7 days';
  return v_result;
end;
$$;

create or replace function hq_private.brain_channel_confirm(p_channel_id uuid,p_resource_id text,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_channel hq_private.brain_channels;
begin
  perform hq_private.require_brain_service();
  if p_channel_id is null or p_resource_id is null or pg_catalog.length(p_resource_id) not between 1 and 1024
    or p_expires_at is null or not pg_catalog.isfinite(p_expires_at) or p_expires_at<=pg_catalog.clock_timestamp() then
    raise exception 'HQ_INVALID_CHANNEL' using errcode = '22023';
  end if;
  perform 1 from hq_private.brain_sync_state
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  select c.* into v_channel from hq_private.brain_channels c where c.channel_id=p_channel_id for update;
  if not found or v_channel.expires_at<=pg_catalog.clock_timestamp() or p_expires_at>v_channel.expires_at
    or (v_channel.resource_id is not null and v_channel.resource_id<>p_resource_id) then
    raise exception 'HQ_CHANNEL_NOT_PREPARED' using errcode = 'PT409';
  end if;
  if v_channel.confirmed_at is null then
    update hq_private.brain_channels set resource_id=p_resource_id,expires_at=p_expires_at,confirmed_at=pg_catalog.clock_timestamp()
      where channel_id=p_channel_id;
    -- Confirmation pins only the watch response's resource. Initial 'sync'
    -- callbacks are not file-change events; initial import is an explicit run.
    -- Renewing a watch must not create a periodic data-refresh generation.
  elsif v_channel.expires_at<>p_expires_at then raise exception 'HQ_CHANNEL_CHANGED' using errcode = 'PT409'; end if;
  return pg_catalog.jsonb_build_object('confirmed',true);
end;
$$;
