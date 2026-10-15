-- BS-CHANGELOG-VERSION-001: reviewed first-version bootstrap, not historical releases.
-- Internal-only consumer recognition is release provenance, never operational registration.
create table if not exists super_admin_private.release_internal_consumers (
  stable_key text primary key check(stable_key ~ '^[a-z][a-z0-9-]{1,62}$')
);
alter table super_admin_private.release_internal_consumers enable row level security;
revoke all on super_admin_private.release_internal_consumers from public,anon,authenticated,service_role;
comment on table super_admin_private.release_internal_consumers is
  'Private fragment bookkeeping only. Does not enable public releases, public enumeration, navigation, billing, adapters or permissions.';
insert into super_admin_private.release_internal_consumers(stable_key) values
  ('automation-suit'),('inventory-suit'),('ledger-suit'),('shop-suit'),('super-admin-suit')
on conflict do nothing;

create or replace function public.release_stage_accept(p_request jsonb) returns jsonb
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
      -- Internal provenance does not activate an operational product or grant public release authority.
      if f->>'disposition'='public' then
        if not exists(select 1 from public.suit_registry where stable_key=s and status='active') then raise exception 'UNREGISTERED_SUIT'; end if;
      elsif not exists(select 1 from super_admin_private.release_internal_consumers where stable_key=s)
        and not exists(select 1 from public.suit_registry where stable_key=s and status='active') then
        raise exception 'UNREGISTERED_INTERNAL_CONSUMER';
      end if;
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


-- The migration may traverse the same Git/provider chain in other environments.
-- Only the owner-verified staging authority/Shop pair may initialize; no production ID is inferred.
do $$
declare authority constant uuid := 'a0bb00a1-747c-4cda-8521-9927d0b53065';
  shop constant uuid := '7924a9af-a970-4360-a0d0-76df4e18dbfc';
  anchor constant text := '4b4c3ca5ffed96e7d61f6eb5a60d04a52862aa0c';
begin
  perform pg_advisory_xact_lock(736271901);
  if not exists(select 1 from public.admin_environments where id=authority
    and stable_key='sas-staging' and environment_kind='staging' and status='active') then
    raise notice 'RELEASE_BOOTSTRAP_NOT_VERIFIED_STAGING: catalog remains unconfigured';
    return;
  end if;
  if exists(select 1 from public.release_catalog_configuration) then
    if exists(select 1 from public.release_catalog_configuration where authority_environment_id<>authority
      or repository<>'Building-Suit/building-suit-monorepo' or anchor_sha<>anchor) then
      raise exception 'RELEASE_BOOTSTRAP_CONFIGURATION_CONFLICT: review existing evidence; nothing overwritten';
    end if;
    if not exists(select 1 from public.release_version_heads where suit_id=shop) then
      raise exception 'RELEASE_BOOTSTRAP_PARTIAL_STATE: initialized authority has no Shop baseline; nothing overwritten';
    end if;
    raise notice 'RELEASE_BOOTSTRAP_ALREADY_INITIALIZED: preserving all existing release state';
    return;
  end if;
  if exists(select 1 from public.release_version_heads) or exists(select 1 from public.release_manifests)
    or exists(select 1 from public.release_versions) or exists(select 1 from public.release_consumed_fragments) then
    raise exception 'RELEASE_BOOTSTRAP_PARTIAL_STATE: review existing evidence; nothing overwritten';
  end if;
  if not exists(select 1 from public.suit_registry where id=shop and stable_key='shop-suit' and status='active') then
    raise exception 'RELEASE_BOOTSTRAP_SHOP_IDENTITY_REQUIRED';
  end if;
  -- 0.0.0 is an unpublished high-water sentinel, not a fabricated prior release.
  -- The first accepted Shop minor batch becomes 0.1.0; later receipt patch becomes 0.1.1.
  insert into public.release_version_heads(suit_id,version,baseline_evidence) values
    (shop,'0.0.0','First official versioning confirmed by owner 2026-10-15T21:20:31Z; unpublished allocator origin only, no historical release. Reviewed post-anchor capability batch starts at 0.1.0.');
  insert into public.release_catalog_configuration(singleton,authority_environment_id,repository,anchor_sha,cursor_sha)
    values(true,authority,'Building-Suit/building-suit-monorepo',anchor,anchor);
end $$;
