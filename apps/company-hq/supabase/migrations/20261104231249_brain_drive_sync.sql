-- Forward-only HQ Drive bridge. Metadata/cursors are private; Drive prose and
-- notifications never approve plans or execute employee/skill instructions.
-- A complete reconciliation is one bounded snapshot, not a partial page.

create table hq_private.brain_sync_state (
  root_id text primary key check (root_id = '1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'),
  cursor text check (pg_catalog.octet_length(cursor) <= 32768),
  generation bigint not null default 1 check (generation > 0),
  completed_generation bigint not null default 0 check (completed_generation >= 0 and completed_generation <= generation),
  full_reconcile boolean not null default true,
  lease_owner uuid,
  lease_generation bigint,
  lease_expires_at timestamptz,
  failures integer not null default 0 check (failures between 0 and 30),
  retry_at timestamptz not null default pg_catalog.clock_timestamp(),
  last_success_at timestamptz,
  last_error text check (last_error in ('cloud-unavailable','invalid-source','source-conflict','cursor-expired','publisher-unavailable','configuration-required','lease-lost')),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((lease_owner is null and lease_generation is null and lease_expires_at is null)
    or (lease_owner is not null and lease_generation is not null and lease_expires_at is not null))
);
insert into hq_private.brain_sync_state(root_id) values ('1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8');

create table hq_private.brain_channels (
  channel_id uuid primary key,
  root_id text not null references hq_private.brain_sync_state(root_id),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  resource_id text check (pg_catalog.length(resource_id) between 1 and 1024),
  expires_at timestamptz not null,
  prepared_at timestamptz not null default pg_catalog.clock_timestamp(),
  confirmed_at timestamptz,
  check ((resource_id is null) = (confirmed_at is null))
);
create index hq_brain_channels_expiry_idx on hq_private.brain_channels(expires_at);

create table hq_private.brain_files (
  file_id text primary key check (file_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  root_id text not null references hq_private.brain_sync_state(root_id),
  parent_ids text[] not null,
  name text,
  mime_type text,
  source_version text check (source_version is null or source_version ~ '^[0-9]{1,40}$'),
  modified_at timestamptz,
  trashed boolean not null,
  in_scope boolean not null,
  observed_at timestamptz not null default pg_catalog.clock_timestamp(),
  check (not trashed or not in_scope)
);
create index hq_brain_files_scope_idx on hq_private.brain_files(root_id, in_scope);

create table hq_private.brain_sync_receipts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  owner_id uuid not null unique,
  generation bigint not null,
  cursor text not null,
  files_digest text not null check (files_digest ~ '^[0-9a-f]{64}$'),
  complete boolean not null,
  result jsonb not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp()
);
-- Metadata only, retained for bounded RPC retry idempotency. No note bodies,
-- refresh tokens, watch tokens or service credentials are stored here.

create table hq_private.brain_source_bindings (
  source_id text primary key check (source_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  root_id text not null references hq_private.brain_sync_state(root_id),
  kind text not null check (kind in ('historical-evidence','plan-manifest')),
  proposal_key text unique check (proposal_key ~ '^[a-z][a-z0-9-]{1,63}$'),
  plan_id uuid unique references public.hq_company_plans(id),
  registered_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((kind = 'historical-evidence' and proposal_key is null and plan_id is null)
    or (kind = 'plan-manifest' and proposal_key is not null))
);

create table hq_private.brain_plan_receipts (
  source_id text not null references hq_private.brain_source_bindings(source_id),
  source_version text not null check (source_version ~ '^[0-9]{1,40}$'),
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  proposal_key text not null,
  document jsonb not null,
  result jsonb not null,
  recorded_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (source_id, source_version)
);
create trigger hq_brain_plan_receipt_immutable before update or delete on hq_private.brain_plan_receipts
  for each row execute function hq_private.immutable_record();

alter table hq_private.brain_sync_state enable row level security;
alter table hq_private.brain_channels enable row level security;
alter table hq_private.brain_files enable row level security;
alter table hq_private.brain_sync_receipts enable row level security;
alter table hq_private.brain_source_bindings enable row level security;
alter table hq_private.brain_plan_receipts enable row level security;
revoke all on hq_private.brain_sync_state,hq_private.brain_channels,hq_private.brain_files,
  hq_private.brain_sync_receipts,hq_private.brain_source_bindings,hq_private.brain_plan_receipts
  from public,anon,authenticated,service_role;

create function hq_private.require_brain_service() returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')
    is distinct from 'service_role' then
    raise exception 'HQ_BRAIN_SERVICE_REQUIRED' using errcode = '42501';
  end if;
end;
$$;

create function hq_private.brain_sync_claim(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state; v_claimed boolean := false; v_channel jsonb;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_owner = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'HQ_INVALID_OWNER' using errcode = '22023';
  end if;
  select s.* into v_state from hq_private.brain_sync_state s for update;
  if v_state.retry_at <= pg_catalog.clock_timestamp() and
    (v_state.lease_owner is null or v_state.lease_expires_at <= pg_catalog.clock_timestamp() or v_state.lease_owner = p_owner)
    and not exists(select 1 from hq_private.brain_sync_receipts r where r.owner_id = p_owner) then
    update hq_private.brain_sync_state set lease_owner = p_owner,
      lease_generation = case when lease_owner = p_owner then lease_generation else generation end,
      lease_expires_at = pg_catalog.clock_timestamp() + interval '3 minutes',
      updated_at = pg_catalog.clock_timestamp() returning * into v_state;
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

create function hq_private.brain_sync_commit(p_owner uuid,p_cursor text,p_generation bigint,p_files jsonb,p_complete boolean)
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
  select s.* into v_state from hq_private.brain_sync_state s for update;
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
    returning * into v_state;
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

create function hq_private.brain_sync_fail(p_owner uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_reason is null or p_reason not in ('cloud-unavailable','invalid-source','source-conflict','cursor-expired','publisher-unavailable','configuration-required','lease-lost') then
    raise exception 'HQ_INVALID_SYNC_FAILURE' using errcode = '22023';
  end if;
  select s.* into v_state from hq_private.brain_sync_state s for update;
  if v_state.lease_owner is distinct from p_owner then return pg_catalog.jsonb_build_object('released',false); end if;
  update hq_private.brain_sync_state set lease_owner=null,lease_generation=null,lease_expires_at=null,
    failures=least(failures+1,30),last_error=p_reason,
    cursor=case when p_reason='cursor-expired' then null else cursor end,
    full_reconcile=full_reconcile or p_reason='cursor-expired',
    retry_at=pg_catalog.clock_timestamp() + pg_catalog.make_interval(secs => least(300,15 * (2 ^ least(failures,5))::integer)),
    updated_at=pg_catalog.clock_timestamp() returning * into v_state;
  return pg_catalog.jsonb_build_object('released',true,'retryAt',v_state.retry_at);
end;
$$;

create function hq_private.brain_channel_prepare(p_channel_id uuid,p_token_hash text,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_existing hq_private.brain_channels;
begin
  perform hq_private.require_brain_service();
  if p_channel_id is null or p_channel_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' or p_expires_at is null
    or not pg_catalog.isfinite(p_expires_at) or p_expires_at <= pg_catalog.clock_timestamp()
    or p_expires_at > pg_catalog.clock_timestamp()+interval '8 days' then
    raise exception 'HQ_INVALID_CHANNEL' using errcode = '22023';
  end if;
  perform 1 from hq_private.brain_sync_state for update;
  select c.* into v_existing from hq_private.brain_channels c where c.channel_id=p_channel_id;
  if found then
    if v_existing.token_hash<>p_token_hash or v_existing.expires_at<>p_expires_at then
      raise exception 'HQ_CHANNEL_ID_REUSED' using errcode = 'PT409';
    end if;
  else
    delete from hq_private.brain_channels where expires_at < pg_catalog.clock_timestamp()-interval '1 day';
    if (select pg_catalog.count(*) from hq_private.brain_channels where expires_at>pg_catalog.clock_timestamp())>=8 then
      raise exception 'HQ_CHANNEL_CAPACITY' using errcode = '54000';
    end if;
    insert into hq_private.brain_channels(channel_id,root_id,token_hash,expires_at)
      values(p_channel_id,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',p_token_hash,p_expires_at);
  end if;
  return pg_catalog.jsonb_build_object('prepared',true);
end;
$$;

create function hq_private.brain_channel_confirm(p_channel_id uuid,p_resource_id text,p_expires_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_channel hq_private.brain_channels;
begin
  perform hq_private.require_brain_service();
  if p_channel_id is null or p_resource_id is null or pg_catalog.length(p_resource_id) not between 1 and 1024
    or p_expires_at is null or not pg_catalog.isfinite(p_expires_at) or p_expires_at<=pg_catalog.clock_timestamp() then
    raise exception 'HQ_INVALID_CHANNEL' using errcode = '22023';
  end if;
  perform 1 from hq_private.brain_sync_state for update;
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
    update hq_private.brain_sync_state set generation=generation+1,updated_at=pg_catalog.clock_timestamp();
  elsif v_channel.expires_at<>p_expires_at then raise exception 'HQ_CHANNEL_CHANGED' using errcode = 'PT409'; end if;
  return pg_catalog.jsonb_build_object('confirmed',true);
end;
$$;

create function hq_private.brain_notify(p_channel_id uuid,p_token_hash text,p_resource_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform hq_private.require_brain_service();
  if p_channel_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_resource_id is null or pg_catalog.length(p_resource_id) not between 1 and 1024 then return false; end if;
  perform 1 from hq_private.brain_sync_state for update;
  if not exists(select 1 from hq_private.brain_channels c where c.channel_id=p_channel_id
    and c.token_hash=p_token_hash and c.resource_id=p_resource_id and c.confirmed_at is not null
    and c.expires_at>pg_catalog.clock_timestamp()) then return false; end if;
  update hq_private.brain_sync_state set generation=generation+1,updated_at=pg_catalog.clock_timestamp();
  return true;
end;
$$;

create function hq_private.brain_sync_status() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state;
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501'; end if;
  select s.* into v_state from hq_private.brain_sync_state s;
  return pg_catalog.jsonb_build_object('state',case when v_state.last_error is not null then 'error'
    when v_state.lease_owner is not null and v_state.lease_expires_at>pg_catalog.clock_timestamp() then 'syncing'
    when v_state.last_success_at is null then 'pending' else 'ready' end,
    'pending',v_state.generation>v_state.completed_generation or v_state.full_reconcile,
    'lastSuccessAt',v_state.last_success_at,'lastError',v_state.last_error,'updatedAt',v_state.updated_at);
end;
$$;

create function hq_private.brain_bind_manifest(p_source_id text,p_proposal_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_binding hq_private.brain_source_bindings;
begin
  perform hq_private.require_brain_service();
  if p_source_id is null or p_source_id !~ '^[A-Za-z0-9_-]{10,200}$' or p_proposal_key is null
    or p_proposal_key !~ '^[a-z][a-z0-9-]{1,63}$' then raise exception 'HQ_INVALID_MANIFEST_BINDING' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21128,2);
  select b.* into v_binding from hq_private.brain_source_bindings b where b.source_id=p_source_id;
  if found then
    if v_binding.kind<>'plan-manifest' or v_binding.proposal_key<>p_proposal_key then
      raise exception 'HQ_SOURCE_BINDING_CHANGED' using errcode = 'PT409';
    end if;
    return pg_catalog.jsonb_build_object('bound',true);
  end if;
  if not exists(select 1 from hq_private.brain_files f where f.file_id=p_source_id and f.in_scope and not f.trashed
    and f.name ~* '\.json$' and f.mime_type in ('application/json','text/plain')) then
    raise exception 'HQ_MANIFEST_NOT_INDEXED' using errcode = 'PT409';
  end if;
  insert into hq_private.brain_source_bindings(source_id,root_id,kind,proposal_key)
    values(p_source_id,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','plan-manifest',p_proposal_key);
  return pg_catalog.jsonb_build_object('bound',true);
end;
$$;

create function hq_private.brain_publish_plan(p_source_id text,p_source_version text,p_digest text,p_proposal_key text,p_document jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_binding hq_private.brain_source_bindings; v_previous hq_private.brain_plan_receipts; v_result jsonb;
begin
  perform hq_private.require_brain_service();
  if p_source_id is null or p_source_id !~ '^[A-Za-z0-9_-]{10,200}$' or p_source_version is null
    or p_source_version !~ '^[0-9]{1,40}$' or p_digest is null or p_digest !~ '^[0-9a-f]{64}$'
    or p_proposal_key is null or p_proposal_key !~ '^[a-z][a-z0-9-]{1,63}$'
    or p_document is null or pg_catalog.jsonb_typeof(p_document) is distinct from 'object'
    or pg_catalog.octet_length(p_document::text)>1048576 or p_document->>'proposalKey' is distinct from p_proposal_key then
    raise exception 'HQ_INVALID_MANIFEST_PUBLICATION' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(21128,2);
  select b.* into v_binding from hq_private.brain_source_bindings b where b.source_id=p_source_id;
  if not found or v_binding.kind<>'plan-manifest' or v_binding.proposal_key<>p_proposal_key then
    raise exception 'HQ_SOURCE_NOT_BOUND' using errcode = '42501';
  end if;
  -- This check MUST precede the existing publisher: replay after founder
  -- approval returns its original receipt without reopening the decided plan.
  select r.* into v_previous from hq_private.brain_plan_receipts r
    where r.source_id=p_source_id and r.source_version=p_source_version;
  if found then
    if v_previous.digest<>p_digest or v_previous.proposal_key<>p_proposal_key or v_previous.document<>p_document then
      raise exception 'HQ_SOURCE_REVISION_CHANGED' using errcode = 'PT409';
    end if;
    return v_previous.result;
  end if;
  -- The trusted worker revalidates the current source ancestry/version/content
  -- before publishing, then commits its metadata/cursor. A newer version may
  -- therefore precede the final index commit; an older indexed version may not.
  if not exists(select 1 from hq_private.brain_files f where f.file_id=p_source_id and f.in_scope and not f.trashed
    and f.source_version::numeric<=p_source_version::numeric and f.name ~* '\.json$' and f.mime_type in ('application/json','text/plain')) then
    raise exception 'HQ_SOURCE_REVISION_NOT_CURRENT' using errcode = 'PT409';
  end if;
  if exists(select 1 from hq_private.brain_plan_receipts r where r.source_id=p_source_id
    and r.source_version::numeric>=p_source_version::numeric) then raise exception 'HQ_SOURCE_REVISION_OLDER' using errcode = 'PT409'; end if;
  if v_binding.plan_id is not null and hq_private.required_uuid(p_document->'id')<>v_binding.plan_id then
    raise exception 'HQ_SOURCE_PLAN_IDENTITY_CHANGED' using errcode = 'PT409';
  end if;
  v_result := hq_private.publish_company_plan(p_document);
  if v_binding.plan_id is null then update hq_private.brain_source_bindings set plan_id=(v_result->>'id')::uuid where source_id=p_source_id; end if;
  insert into hq_private.brain_plan_receipts(source_id,source_version,digest,proposal_key,document,result)
    values(p_source_id,p_source_version,p_digest,p_proposal_key,p_document,v_result);
  return v_result;
end;
$$;

-- Public invokers expose only exact guarded entry points; private tables have
-- no Data API grants or caller policies. Session-based status has no secrets.
create function public.hq_brain_sync_claim(p_owner uuid) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_sync_claim(p_owner); $$;
create function public.hq_brain_sync_commit(p_owner uuid,p_cursor text,p_generation bigint,p_files jsonb,p_complete boolean) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_sync_commit(p_owner,p_cursor,p_generation,p_files,p_complete); $$;
create function public.hq_brain_sync_fail(p_owner uuid,p_reason text) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_sync_fail(p_owner,p_reason); $$;
create function public.hq_brain_channel_prepare(p_channel_id uuid,p_token_hash text,p_expires_at timestamptz) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_channel_prepare(p_channel_id,p_token_hash,p_expires_at); $$;
create function public.hq_brain_channel_confirm(p_channel_id uuid,p_resource_id text,p_expires_at timestamptz) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_channel_confirm(p_channel_id,p_resource_id,p_expires_at); $$;
create function public.hq_brain_notify(p_channel_id uuid,p_token_hash text,p_resource_id text) returns boolean language sql security invoker set search_path='' as $$ select hq_private.brain_notify(p_channel_id,p_token_hash,p_resource_id); $$;
create function public.hq_brain_sync_status() returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_sync_status(); $$;
create function public.hq_brain_bind_manifest(p_source_id text,p_proposal_key text) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_bind_manifest(p_source_id,p_proposal_key); $$;
create function public.hq_brain_publish_plan(p_source_id text,p_source_version text,p_digest text,p_proposal_key text,p_document jsonb) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.brain_publish_plan(p_source_id,p_source_version,p_digest,p_proposal_key,p_document); $$;

revoke all on function hq_private.require_brain_service(),
  hq_private.brain_sync_claim(uuid),hq_private.brain_sync_commit(uuid,text,bigint,jsonb,boolean),hq_private.brain_sync_fail(uuid,text),
  hq_private.brain_channel_prepare(uuid,text,timestamptz),hq_private.brain_channel_confirm(uuid,text,timestamptz),hq_private.brain_notify(uuid,text,text),
  hq_private.brain_sync_status(),hq_private.brain_bind_manifest(text,text),hq_private.brain_publish_plan(text,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
revoke all on function public.hq_brain_sync_claim(uuid),public.hq_brain_sync_commit(uuid,text,bigint,jsonb,boolean),public.hq_brain_sync_fail(uuid,text),
  public.hq_brain_channel_prepare(uuid,text,timestamptz),public.hq_brain_channel_confirm(uuid,text,timestamptz),public.hq_brain_notify(uuid,text,text),
  public.hq_brain_sync_status(),public.hq_brain_bind_manifest(text,text),public.hq_brain_publish_plan(text,text,text,text,jsonb)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.brain_sync_claim(uuid),hq_private.brain_sync_commit(uuid,text,bigint,jsonb,boolean),hq_private.brain_sync_fail(uuid,text),
  hq_private.brain_channel_prepare(uuid,text,timestamptz),hq_private.brain_channel_confirm(uuid,text,timestamptz),hq_private.brain_notify(uuid,text,text),
  hq_private.brain_bind_manifest(text,text),hq_private.brain_publish_plan(text,text,text,text,jsonb) to service_role;
grant execute on function public.hq_brain_sync_claim(uuid),public.hq_brain_sync_commit(uuid,text,bigint,jsonb,boolean),public.hq_brain_sync_fail(uuid,text),
  public.hq_brain_channel_prepare(uuid,text,timestamptz),public.hq_brain_channel_confirm(uuid,text,timestamptz),public.hq_brain_notify(uuid,text,text),
  public.hq_brain_bind_manifest(text,text),public.hq_brain_publish_plan(text,text,text,text,jsonb) to service_role;
grant execute on function hq_private.brain_sync_status(),public.hq_brain_sync_status() to authenticated;

-- Narrow legacy bootstrap of six ALREADY founder-approved departments.
-- Source slugs are new HQ mapping keys, not asserted historical Brain fields.
-- UUIDs are generated within this transaction; no historical actor/event UUID,
-- exact approval instant, translated name, HR/CEO review or employee is invented.
do $$
declare
  v_plan_id uuid := pg_catalog.gen_random_uuid();
  v_department_id uuid; v_item jsonb; v_document jsonb;
  v_departments jsonb := '[]'; v_charters jsonb := '[]';
  v_specs jsonb := '[
    {"key":"research-market-intelligence","name":"Research & Market Intelligence","fileId":"15sIvWDFnwZY1r2vcmW_8sgsRhCoyE1yB"},
    {"key":"customer-acquisition-partnerships","name":"Customer Acquisition & Partnerships","fileId":"1mgUvgV70udQO82RAurbIZiHmjO7dw7kR"},
    {"key":"customer-success-onboarding","name":"Customer Success & Onboarding","fileId":"1Dfyq56Anl9haeQv52F_71tDR2IFG7Is-"},
    {"key":"social-community","name":"Social & Community","fileId":"1RMKlT6mQpeZ9Qu3NWvAhBVM0EQQOQpXW"},
    {"key":"email-lifecycle","name":"Email & Lifecycle","fileId":"1BFwxbH4r7aMZIYuP5yphP3qclFCgoCnI"},
    {"key":"development-maintenance","name":"Development & Maintenance","fileId":"1FO29eGyD6IFTcq5qMG9w-h17NA-SyOeO"}
  ]'::jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(21128,1);
  if exists(select 1 from public.hq_company_plans where proposal_key='legacy-acquisition-departments-2026-11-04') then
    raise exception 'HQ_LEGACY_BOOTSTRAP_ALREADY_PRESENT' using errcode = 'PT409';
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(v_specs) loop
    if exists(select 1 from public.hq_departments d where d.department_key=v_item->>'key'
      or hq_private.name_key(d.name)=hq_private.name_key(v_item->>'name')
      or hq_private.name_key(d.name_ar)=hq_private.name_key(v_item->>'name')) then
      raise exception 'HQ_LEGACY_DEPARTMENT_CONFLICT' using errcode = 'PT409';
    end if;
    v_department_id := pg_catalog.gen_random_uuid();
    v_departments := v_departments || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'id',v_department_id,'key',v_item->>'key','name',v_item->>'name'));
    v_charters := v_charters || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'departmentId',v_department_id,'projectionKey',v_item->>'key','fileId',v_item->>'fileId','charterVersion','1.2.0'));
  end loop;
  v_document := pg_catalog.jsonb_build_object(
    'id',v_plan_id,'proposalKey','legacy-acquisition-departments-2026-11-04',
    'title','Founder-approved acquisition department baseline',
    'summary','Six existing departments approved by the founder on 2026-11-04, imported from verified Brain records.',
    'body','Historical source FOUNDER-2026-11-04-ACQ-APPROVAL records direct founder approval of the six department configurations. Approval precision is date only; the learning record bookkeeping timestamp is not an approval instant. No original host message ID, Auth actor, authenticated HR/CEO review event, employee assignment or skill execution is asserted. Sources: https://drive.google.com/file/d/1q_wh04uG057bdxoS0C9R47gnUvIV2cRq/view and https://drive.google.com/file/d/1vkYirkleUknmVKac3bbSV3iWFMbek2Kf/view. The original HR baseline remains unchanged. Workstations are visual capacity only.',
    'departments',v_departments,'hiring','[]'::jsonb,'skills','[]'::jsonb,'hrReview',null,'ceoReview',null);
  insert into public.hq_company_plans(id,proposal_key,revision,document,status,legacy,legacy_approved_on,source_evidence)
    values(v_plan_id,'legacy-acquisition-departments-2026-11-04',1,v_document,'approved',true,'2026-11-04'::date,
      pg_catalog.jsonb_build_object(
        'decisionSourceId','FOUNDER-2026-11-04-ACQ-APPROVAL',
        'decisionSourceFileId','1q_wh04uG057bdxoS0C9R47gnUvIV2cRq',
        'decisionSourcePath','Sources/Conversation Learning.md',
        'planFileId','1vkYirkleUknmVKac3bbSV3iWFMbek2Kf',
        'planPath','Work Outputs/HR/Shop Suit Customer Acquisition Plan.md',
        'assignmentFileId','10ZT3YRqeWCNvIOltQBOctI-owzq6X3dl',
        'appointmentsSkillsFileId','1rTQjmDAzRp05N8IgYTZ-lCxVdrbwRQ6T',
        'staticReviewFileId','1B1x_P26uDiSKQMrZGmBl4m0CACvReZQw',
        'staticReviewId','STAFF-2026-11-04-ACQ-INDEPENDENT-STATIC-01',
        'staticReviewScope','static-only; not an authenticated HR/CEO decision',
        'approvalDate','2026-11-04','timePrecision','date',
        'charters',v_charters,'projectionKeysAreMappingChoices',true,'generatedMigrationSource','20261104224441'));
  insert into hq_private.plan_revisions(plan_id,revision,document) values(v_plan_id,1,v_document);
  for v_item in select value from pg_catalog.jsonb_array_elements(v_departments) loop
    insert into public.hq_departments(id,department_key,name,plan_id,legacy_approved_on)
      values((v_item->>'id')::uuid,v_item->>'key',v_item->>'name',v_plan_id,'2026-11-04'::date);
  end loop;
  -- The allowlist records historical evidence only. None of these Markdown
  -- records can become a live plan manifest or approval command by being edited.
  insert into hq_private.brain_source_bindings(source_id,root_id,kind)
    select source_id,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','historical-evidence'
    from (values
      ('1q_wh04uG057bdxoS0C9R47gnUvIV2cRq'),('1vkYirkleUknmVKac3bbSV3iWFMbek2Kf'),
      ('10ZT3YRqeWCNvIOltQBOctI-owzq6X3dl'),('1rTQjmDAzRp05N8IgYTZ-lCxVdrbwRQ6T'),
      ('1B1x_P26uDiSKQMrZGmBl4m0CACvReZQw'),('1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq'),
      ('15sIvWDFnwZY1r2vcmW_8sgsRhCoyE1yB'),('1mgUvgV70udQO82RAurbIZiHmjO7dw7kR'),
      ('1Dfyq56Anl9haeQv52F_71tDR2IFG7Is-'),('1RMKlT6mQpeZ9Qu3NWvAhBVM0EQQOQpXW'),
      ('1BFwxbH4r7aMZIYuP5yphP3qclFCgoCnI'),('1FO29eGyD6IFTcq5qMG9w-h17NA-SyOeO')
    ) as sources(source_id);
  perform hq_private.company_payload();
end;
$$;
