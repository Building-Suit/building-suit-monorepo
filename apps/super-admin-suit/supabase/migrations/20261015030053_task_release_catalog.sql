-- BS-CHANGELOG-VERSION-001. Central SAS release authority, not control.tasks.
-- Empty configuration is intentional: no guessed baselines, targets or credentials.
create table public.release_catalog_configuration (
  singleton boolean primary key default true check(singleton),
  authority_environment_id uuid not null references public.admin_environments(id),
  repository text not null check(repository='Building-Suit/building-suit-monorepo'),
  anchor_sha text not null check(anchor_sha ~ '^[a-f0-9]{40}$'),
  cursor_sha text not null check(cursor_sha ~ '^[a-f0-9]{40}$')
);
create table public.release_version_heads (
  suit_id uuid primary key references public.suit_registry(id),
  version text not null check(version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  baseline_evidence text not null check(length(baseline_evidence)>10)
);
create table public.release_manifests (
  source_sha text primary key check(source_sha ~ '^[a-f0-9]{40}$'),
  ordinal bigint generated always as identity unique,
  request jsonb not null,
  manifest jsonb not null,
  digest text not null check(digest ~ '^[a-f0-9]{64}$'),
  accepted_at timestamptz not null default clock_timestamp(),
  first_published_at timestamptz,
  deployment_sha text check(deployment_sha ~ '^[a-f0-9]{40}$')
);
create table public.release_consumed_fragments (
  fragment_id text primary key,
  source_sha text not null references public.release_manifests(source_sha),
  fragment_digest text not null
);
create table public.release_versions (
  suit_id uuid not null references public.suit_registry(id),
  version text not null,
  source_sha text not null references public.release_manifests(source_sha),
  primary key(suit_id,version), unique(suit_id,source_sha)
);
create index release_consumed_source on public.release_consumed_fragments(source_sha);
create index release_versions_source on public.release_versions(source_sha);
do $$ declare t text; begin
  foreach t in array array['release_catalog_configuration','release_version_heads','release_manifests','release_consumed_fragments','release_versions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  end loop;
end $$;

create function super_admin_private.release_context() returns text
language plpgsql security definer set search_path='' as $$
declare kind text; begin
  if current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    and coalesce(current_setting('request.jwt.claims',true),'{}')::jsonb->>'role' is distinct from 'service_role' then
    raise exception 'SERVER_REQUIRED' using errcode='42501';
  end if;
  select e.environment_kind into kind from public.release_catalog_configuration c
    join public.admin_environments e on e.id=c.authority_environment_id where e.status='active';
  if kind not in ('staging','production') or kind is null then raise exception 'RELEASE_CONFIGURATION_REQUIRED'; end if;
  return kind;
end $$;

create function super_admin_private.release_digest(p_value jsonb) returns text
language sql immutable set search_path='' as $$ select encode(extensions.digest(convert_to(p_value::text,'UTF8'),'sha256'),'hex') $$;

create function super_admin_private.release_copy_valid(p_copy jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p_copy)='object' and (select count(*)=3 from jsonb_object_keys(p_copy))
 and not exists(select 1 from jsonb_each(p_copy) f where f.key not in ('title','summary','details')
 or jsonb_typeof(f.value)<>'object' or (select count(*)<>2 from jsonb_object_keys(f.value))
 or not (f.value ?& array['en','ar'])
 or exists(select 1 from jsonb_each(f.value) v where jsonb_typeof(v.value)<>'string'
 or length(btrim(v.value#>>'{}')) not between 1 and 8000
 or (v.value#>>'{}') ~* '(<|>|service_role|secret[_ -]?key|-----BEGIN|github_pat_|ghp_)')
 or f.value->>'ar' !~ '[؀-ۿ]' or f.value->>'en' !~ '[a-zA-Z]'),false)
$$;

-- One transaction and one authoritative lock for allocation, consumption and cursor.
-- The ordered parent cursor rejects reordered delivery; identical retries return saved results.
create function public.release_stage_accept(p_request jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.release_catalog_configuration; existing public.release_manifests;
 f jsonb; s text; suit uuid; impact text; previous text; parts bigint[]; next_version text;
 versions jsonb:='{}'; entries jsonb:='[]'; manifest jsonb; sha text:=p_request->>'sourceSha';
begin
  if super_admin_private.release_context()<>'staging' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  select * into c from public.release_catalog_configuration for update;
  select * into existing from public.release_manifests where source_sha=sha;
  if found then
    if existing.request<>p_request then raise exception 'DIGEST_CONFLICT'; end if;
    return jsonb_build_object('manifest',existing.manifest,'digest',existing.digest,'publishedAt',existing.first_published_at);
  end if;
  if p_request->>'repository' is distinct from c.repository or p_request->>'ref' is distinct from 'refs/heads/stg'
    or p_request->>'parentSha' is distinct from c.cursor_sha or sha !~ '^[a-f0-9]{40}$'
    or jsonb_typeof(p_request->'fragments') is distinct from 'array' then raise exception 'INVALID_PROVENANCE_OR_ORDER'; end if;
  for f in select value from jsonb_array_elements(p_request->'fragments') loop
    if not (f ?& array['id','task','classification','disposition','suits','paths','reason']) or f->>'id' is null or f->>'classification' is null or f->>'id' !~ '^[a-z0-9][a-z0-9-]{2,100}$' or f->>'task' !~ '^[A-Z][A-Z0-9-]{2,100}$' or f->>'task' is null
      or f->>'classification' not in ('major','minor','patch','internal')
      or f->>'disposition' is distinct from (case when f->>'classification'='internal' then 'internal' else 'public' end)
      or jsonb_typeof(f->'suits') is distinct from 'array' or jsonb_array_length(f->'suits')=0 then raise exception 'INVALID_FRAGMENT'; end if;
    if f->>'disposition'='public' and (not super_admin_private.release_copy_valid(f->'notes') or (f->'notes')::text like '%'||(f->>'task')||'%') then raise exception 'INVALID_COPY'; end if;
    if exists(select 1 from public.release_consumed_fragments where fragment_id=f->>'id') then raise exception 'FRAGMENT_ALREADY_CONSUMED'; end if;
    for s in select jsonb_array_elements_text(f->'suits') loop
      if not exists(select 1 from public.suit_registry where stable_key=s and status='active') then raise exception 'UNREGISTERED_SUIT'; end if;
    end loop;
  end loop;
  for s in select distinct jsonb_array_elements_text(value->'suits') from jsonb_array_elements(p_request->'fragments') where value->>'disposition'='public' loop
    select id into strict suit from public.suit_registry where stable_key=s and status='active';
    select version into previous from public.release_version_heads where suit_id=suit for update;
    if previous is null then raise exception 'VERIFIED_BASELINE_REQUIRED: %',s; end if;
    select case max(case value->>'classification' when 'major' then 3 when 'minor' then 2 else 1 end) when 3 then 'major' when 2 then 'minor' else 'patch' end into impact
      from jsonb_array_elements(p_request->'fragments') where value->>'disposition'='public' and (value->'suits') ? s;
    parts:=string_to_array(previous,'.')::bigint[];
    next_version:=case impact when 'major' then (parts[1]+1)||'.0.0' when 'minor' then parts[1]||'.'||(parts[2]+1)||'.0' else parts[1]||'.'||parts[2]||'.'||(parts[3]+1) end;
    versions:=versions||jsonb_build_object(s,next_version);
    update public.release_version_heads set version=next_version where suit_id=suit;
    for f in select value from jsonb_array_elements(p_request->'fragments') where value->>'disposition'='public' and (value->'suits') ? s order by value->>'id' loop
      -- IDs and task provenance remain private. Public IDs derive from source and sequence only.
      entries:=entries||jsonb_build_array(jsonb_build_object('id',md5(sha||'-'||jsonb_array_length(entries)),'suit',s,'version',next_version,
        'title',f#>'{notes,title}','summary',f#>'{notes,summary}','details',f#>'{notes,details}'));
    end loop;
  end loop;
  manifest:=jsonb_build_object('schemaVersion',1,'sourceSha',sha,'parentSha',c.cursor_sha,'repository',c.repository,
    'fragments',p_request->'fragments','versions',versions,'entries',entries);
  insert into public.release_manifests(source_sha,request,manifest,digest) values(sha,p_request,manifest,super_admin_private.release_digest(manifest));
  for f in select value from jsonb_array_elements(p_request->'fragments') loop
    insert into public.release_consumed_fragments values(f->>'id',sha,super_admin_private.release_digest(f));
  end loop;
  for s,next_version in select key,value from jsonb_each_text(versions) loop
    insert into public.release_versions select id,next_version,sha from public.suit_registry where stable_key=s;
  end loop;
  update public.release_catalog_configuration set cursor_sha=sha;
  return jsonb_build_object('manifest',manifest,'digest',super_admin_private.release_digest(manifest),'publishedAt',null);
end $$;

-- Only accepted staging records are exportable, including pending reservations.
create function public.release_catalog_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text; begin
  kind:=super_admin_private.release_context();
  return jsonb_build_object('environment',kind,'anchorSha',(select anchor_sha from public.release_catalog_configuration),
    'cursorSha',(select cursor_sha from public.release_catalog_configuration),'manifests',coalesce((select jsonb_agg(jsonb_build_object(
      'manifest',manifest,'digest',digest,'publishedAt',first_published_at) order by ordinal) from public.release_manifests),'[]'));
end $$;

-- CI verifies source ancestry and deployment readiness before invoking this endpoint.
-- Production receives exact staging exports; no production allocation exists.
create function public.release_publish(p_environment text,p_ref text,p_deployment_sha text,p_releases jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text; r jsonb; m jsonb; stored public.release_manifests; s text; v text; f jsonb; published timestamptz:=clock_timestamp(); result jsonb:='[]';
begin
  kind:=super_admin_private.release_context();
  if kind is distinct from p_environment or p_ref is distinct from (case kind when 'staging' then 'refs/heads/stg' else 'refs/heads/main' end)
    or p_deployment_sha !~ '^[a-f0-9]{40}$' or jsonb_typeof(p_releases) is distinct from 'array' then raise exception 'WRONG_ENVIRONMENT_OR_REF'; end if;
  perform pg_advisory_xact_lock(736271901);
  for r in select value from jsonb_array_elements(p_releases) loop
    m:=r->'manifest';
    if super_admin_private.release_digest(m) is distinct from r->>'digest' or m->>'repository' is distinct from 'Building-Suit/building-suit-monorepo'
      or m->>'sourceSha' !~ '^[a-f0-9]{40}$' then raise exception 'DIGEST_CONFLICT'; end if;
    select * into stored from public.release_manifests where source_sha=m->>'sourceSha';
    if found then
      if stored.manifest<>m or stored.digest<>r->>'digest' then raise exception 'DIGEST_CONFLICT'; end if;
    elsif kind='staging' then raise exception 'MISSING_STAGING_MANIFEST';
    else
      if m->>'parentSha' is distinct from (select cursor_sha from public.release_catalog_configuration) then raise exception 'INVALID_PROMOTION_ORDER'; end if;
      if r->>'publishedAt' is null then raise exception 'STAGING_NOT_PUBLISHED'; end if;
      -- Import only generated structure, public copy and registered Suits; retain exact digest.
      for f in select value from jsonb_array_elements(m->'entries') loop
        if not super_admin_private.release_copy_valid(jsonb_build_object('title',f->'title','summary',f->'summary','details',f->'details')) then raise exception 'INVALID_COPY'; end if;
      end loop;
      insert into public.release_manifests(source_sha,request,manifest,digest) values(m->>'sourceSha',jsonb_build_object('stagingDigest',r->>'digest'),m,r->>'digest');
      for s,v in select key,value from jsonb_each_text(m->'versions') loop
        if not exists(select 1 from public.suit_registry where stable_key=s and status='active') then raise exception 'UNREGISTERED_SUIT'; end if;
        insert into public.release_versions select id,v,m->>'sourceSha' from public.suit_registry where stable_key=s;
      end loop;
      for f in select value from jsonb_array_elements(m->'fragments') loop
        insert into public.release_consumed_fragments values(f->>'id',m->>'sourceSha',super_admin_private.release_digest(f));
      end loop;
      update public.release_catalog_configuration set cursor_sha=m->>'sourceSha';
    end if;
    update public.release_manifests set first_published_at=published,deployment_sha=p_deployment_sha
      where source_sha=m->>'sourceSha' and first_published_at is null;
    result:=result||jsonb_build_array(jsonb_build_object('sourceSha',m->>'sourceSha','digest',r->>'digest'));
  end loop;
  return result;
end $$;

-- Public allowlist only. No provenance, internal copy, target plans or caller clock.
create function public.release_public_feed() returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('serverNow',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'suits',coalesce((select jsonb_agg(jsonb_build_object('id',stable_key,'name',jsonb_build_object('en',display_name->>'en','ar',display_name->>'ar')) order by stable_key)
 from public.suit_registry where status='active' and stable_key like '%-suit'),'[]'),
 'entries',coalesce((select jsonb_agg(jsonb_build_object('id',e->>'id','suit',e->>'suit','visibility','public','status','released',
 'version',e->>'version','title',jsonb_build_object('en',e#>>'{title,en}','ar',e#>>'{title,ar}'),
 'summary',jsonb_build_object('en',e#>>'{summary,en}','ar',e#>>'{summary,ar}'),
 'details',jsonb_build_object('en',e#>>'{details,en}','ar',e#>>'{details,ar}'),'links','[]'::jsonb,
 'publishedAt',to_char(m.first_published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'releasedAt',to_char(m.first_published_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) order by m.ordinal desc,e->>'id')
 from public.release_manifests m cross join lateral jsonb_array_elements(m.manifest->'entries') e
 where m.first_published_at<=clock_timestamp()),'[]'))
$$;
revoke all on function super_admin_private.release_context(),super_admin_private.release_digest(jsonb),super_admin_private.release_copy_valid(jsonb) from public,anon,authenticated,service_role;
revoke all on function public.release_stage_accept(jsonb),public.release_catalog_state(),public.release_publish(text,text,text,jsonb),public.release_public_feed() from public,anon,authenticated,service_role;
grant execute on function public.release_stage_accept(jsonb),public.release_catalog_state(),public.release_publish(text,text,text,jsonb) to service_role;
grant execute on function public.release_public_feed() to anon,authenticated,service_role;

-- Stored content and first-publication time cannot be rewritten, including by publisher retries.
create function super_admin_private.release_immutable() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE_RELEASE'; end if;
  if new.source_sha<>old.source_sha or new.ordinal<>old.ordinal or new.request<>old.request
    or new.manifest<>old.manifest or new.digest<>old.digest or new.accepted_at<>old.accepted_at
    or (old.first_published_at is not null and (new.first_published_at is distinct from old.first_published_at or new.deployment_sha is distinct from old.deployment_sha)) then raise exception 'IMMUTABLE_RELEASE'; end if;
  return new;
end $$;
revoke all on function super_admin_private.release_immutable() from public,anon,authenticated,service_role;
create trigger release_manifest_immutable before update or delete on public.release_manifests
  for each row execute function super_admin_private.release_immutable();
