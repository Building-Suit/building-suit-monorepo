-- Forward recovery for pg-safeupdate: every singleton-state UPDATE now
-- selects the fixed authorized Brain root explicitly. Applied migrations stay
-- unchanged; RPC contracts, actor guards, receipts and grants are preserved.


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
  if v_state.retry_at <= pg_catalog.clock_timestamp() and
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

create or replace function hq_private.brain_sync_commit(p_owner uuid,p_cursor text,p_generation bigint,p_files jsonb,p_complete boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_state hq_private.brain_sync_state; v_previous hq_private.brain_sync_receipts;
  v_file jsonb; v_parent jsonb; v_id text; v_ids text[] := '{}'; v_parents text[];
  v_name text; v_mime text; v_version text; v_modified timestamptz; v_trashed boolean; v_scope boolean; v_result jsonb;
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
  update hq_private.brain_sync_state set cursor=p_cursor,completed_generation=p_generation,full_reconcile=false,
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

create or replace function hq_private.brain_sync_fail(p_owner uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_reason is null or p_reason not in ('cloud-unavailable','invalid-source','source-conflict','cursor-expired','publisher-unavailable','configuration-required','lease-lost') then
    raise exception 'HQ_INVALID_SYNC_FAILURE' using errcode = '22023';
  end if;
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  if v_state.lease_owner is distinct from p_owner then return pg_catalog.jsonb_build_object('released',false); end if;
  update hq_private.brain_sync_state set lease_owner=null,lease_generation=null,lease_expires_at=null,
    failures=least(failures+1,30),last_error=p_reason,
    cursor=case when p_reason='cursor-expired' then null else cursor end,
    full_reconcile=full_reconcile or p_reason='cursor-expired',
    retry_at=pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(300,15 * (2 ^ least(failures,5))::integer)),
    updated_at=pg_catalog.clock_timestamp()
    where root_id=v_state.root_id returning * into v_state;
  return pg_catalog.jsonb_build_object('released',true,'retryAt',v_state.retry_at);
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
    -- The initial Drive sync callback may precede this response. Confirming the
    -- independently returned resource always schedules catch-up, so it is safe
    -- to ignore pre-confirm callbacks instead of trusting their resource IDs.
    update hq_private.brain_sync_state set generation=generation+1,updated_at=pg_catalog.clock_timestamp()
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  elsif v_channel.expires_at<>p_expires_at then raise exception 'HQ_CHANNEL_CHANGED' using errcode = 'PT409'; end if;
  return pg_catalog.jsonb_build_object('confirmed',true);
end;
$$;

create or replace function hq_private.brain_notify(p_channel_id uuid,p_token_hash text,p_resource_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform hq_private.require_brain_service();
  if p_channel_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_resource_id is null or pg_catalog.length(p_resource_id) not between 1 and 1024 then return false; end if;
  perform 1 from hq_private.brain_sync_state
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  if not exists(select 1 from hq_private.brain_channels c where c.channel_id=p_channel_id
    and c.token_hash=p_token_hash and c.resource_id=p_resource_id and c.confirmed_at is not null
    and c.expires_at>pg_catalog.clock_timestamp()) then return false; end if;
  update hq_private.brain_sync_state set generation=generation+1,updated_at=pg_catalog.clock_timestamp()
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  return true;
end;
$$;
