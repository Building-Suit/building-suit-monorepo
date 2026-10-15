-- One evolving net-diff candidate; per-merge v1 tables remain immutable historical evidence.
create table public.release_candidate_versions (
  suit_id uuid primary key references public.suit_registry(id),
  version text not null check(version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$'),
  evidence text not null
);
create table public.release_candidate_baseline (
  singleton boolean primary key default true check(singleton),
  production_sha text check(production_sha ~ '^[a-f0-9]{40}$')
);
create table public.release_candidate_revisions (
  key text primary key,
  request jsonb not null,
  manifest jsonb not null,
  digest text not null,
  created_at timestamptz not null default clock_timestamp(),
  ready_at timestamptz
);
create table public.release_candidate_pointer (
  singleton boolean primary key default true check(singleton),
  revision_key text references public.release_candidate_revisions(key)
);
create table public.release_candidate_promotions (
  revision_key text primary key,
  manifest jsonb not null,
  digest text not null,
  deployment_sha text not null check(deployment_sha ~ '^[a-f0-9]{40}$'),
  first_published_at timestamptz not null
);
do $$ declare t text; begin
  foreach t in array array['release_candidate_versions','release_candidate_baseline','release_candidate_revisions','release_candidate_pointer','release_candidate_promotions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  end loop;
  -- Owner confirmed first official versioning. Never adopt old unpublished reservation heads as releases.
  if exists(select 1 from public.release_catalog_configuration c join public.admin_environments e on e.id=c.authority_environment_id
    where e.id='a0bb00a1-747c-4cda-8521-9927d0b53065' and e.stable_key='sas-staging' and e.environment_kind='staging' and e.status='active')
    and not exists(select 1 from public.release_manifests where first_published_at is not null) then
    insert into public.release_candidate_versions select id,'0.0.0','Owner confirmed first official versioning 2026-10-15T21:20:31Z. Private origin; v1 unpublished reservations are retained, not treated as production releases.'
      from public.suit_registry where id='7924a9af-a970-4360-a0d0-76df4e18dbfc' and stable_key='shop-suit' and status='active';
    insert into public.release_candidate_baseline values(true,null);
  end if;
end $$;

create function super_admin_private.candidate_versions(p_snapshot jsonb, p_first_production boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare f jsonb; s text; suit uuid; previous text; impact integer; parts bigint[]; versions jsonb:='{}';
begin
  if p_snapshot->>'schemaVersion' is distinct from '2' or p_snapshot->>'repository' is distinct from 'Building-Suit/building-suit-monorepo'
    or jsonb_typeof(p_snapshot->'changes') is distinct from 'array' or jsonb_typeof(p_snapshot->'baseVersions') is distinct from 'object' then raise exception 'INVALID_CANDIDATE'; end if;
  foreach s in array array['mainSha','mainTree','stagingSha','stagingTree'] loop
    if coalesce(p_snapshot->>s,'') !~ '^[a-f0-9]{40}$' then raise exception 'INVALID_CANDIDATE_REF'; end if;
  end loop;
  if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_snapshot->'changes')) then raise exception 'DUPLICATE_CHANGE_ITEM'; end if;
  for f in select value from jsonb_array_elements(p_snapshot->'changes') loop
    if coalesce(f->>'id','') !~ '^[a-z0-9][a-z0-9-]{2,100}$' or coalesce(f->>'task','') !~ '^[A-Z][A-Z0-9-]{2,100}$'
      or coalesce(f->>'classification','') not in ('major','minor','patch','internal')
      or f->>'disposition' is distinct from (case when f->>'classification'='internal' then 'internal' else 'public' end)
      or jsonb_typeof(f->'suits') is distinct from 'array' or jsonb_array_length(f->'suits')=0 then raise exception 'INVALID_CHANGE_ITEM'; end if;
    if f->>'disposition'='public' and (not super_admin_private.release_copy_valid(f->'notes') or (f->'notes')::text like '%'||(f->>'task')||'%') then raise exception 'INVALID_COPY'; end if;
    for s in select jsonb_array_elements_text(f->'suits') loop
      if f->>'disposition'='public' then
        if not exists(select 1 from public.suit_registry where stable_key=s and status='active') then raise exception 'UNREGISTERED_SUIT'; end if;
      elsif not exists(select 1 from super_admin_private.release_internal_consumers where stable_key=s)
        and not exists(select 1 from public.suit_registry where stable_key=s and status='active') then raise exception 'UNREGISTERED_INTERNAL_CONSUMER'; end if;
    end loop;
  end loop;
  for s in select distinct jsonb_array_elements_text(value->'suits') from jsonb_array_elements(p_snapshot->'changes') where value->>'disposition'='public' loop
    select id into strict suit from public.suit_registry where stable_key=s and status='active';
    select version into previous from public.release_candidate_versions where suit_id=suit;
    if previous is null and p_first_production and p_snapshot#>>array['baseVersions',s]='0.0.0'
      and not exists(select 1 from public.release_manifests where first_published_at is not null)
      and not exists(select 1 from public.release_candidate_promotions) then previous:='0.0.0'; end if;
    if previous is null then raise exception 'VERIFIED_PRODUCTION_BASELINE_REQUIRED'; end if;
    if p_snapshot#>>array['baseVersions',s] is distinct from previous then raise exception 'PRODUCTION_BASELINE_CHANGED'; end if;
    select max(case value->>'classification' when 'major' then 3 when 'minor' then 2 else 1 end) into impact
      from jsonb_array_elements(p_snapshot->'changes') where value->>'disposition'='public' and (value->'suits') ? s;
    parts:=string_to_array(previous,'.')::bigint[];
    versions:=versions||jsonb_build_object(s,case impact when 3 then (parts[1]+1)||'.0.0' when 2 then parts[1]||'.'||(parts[2]+1)||'.0' else parts[1]||'.'||parts[2]||'.'||(parts[3]+1) end);
  end loop;
  return versions;
end $$;

create function public.release_candidate_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text; begin
  kind:=super_admin_private.release_context();
  return jsonb_build_object('model',2,'environment',kind,'productionSha',(select production_sha from public.release_candidate_baseline),
    'baseVersions',coalesce((select jsonb_object_agg(s.stable_key,v.version) from public.release_candidate_versions v join public.suit_registry s on s.id=v.suit_id),'{}'),
    'revisions',coalesce((select jsonb_agg(jsonb_build_object('key',key,'manifest',manifest,'digest',digest,'readyAt',ready_at) order by created_at,key) from public.release_candidate_revisions),'[]'),
    'promotions',coalesce((select jsonb_agg(jsonb_build_object('key',revision_key,'manifest',manifest,'digest',digest,'deploymentSha',deployment_sha,'publishedAt',first_published_at) order by first_published_at,revision_key) from public.release_candidate_promotions),'[]'));
end $$;

create function public.release_candidate_refresh(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
<<refresh>>
declare key text; stored public.release_candidate_revisions; versions jsonb; entries jsonb:='[]'; f jsonb; s text; m jsonb;
begin
  if super_admin_private.release_context()<>'staging' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  key:=super_admin_private.release_digest(jsonb_build_object('stagingSha',p_snapshot->>'stagingSha','mainSha',p_snapshot->>'mainSha','baseVersions',p_snapshot->'baseVersions'));
  select * into stored from public.release_candidate_revisions r where r.key=refresh.key;
  if found then
    if stored.request<>p_snapshot then raise exception 'DIGEST_CONFLICT'; end if;
    return jsonb_build_object('key',key,'manifest',stored.manifest,'digest',stored.digest,'readyAt',stored.ready_at);
  end if;
  versions:=super_admin_private.candidate_versions(p_snapshot);
  for f in select value from jsonb_array_elements(p_snapshot->'changes') where value->>'disposition'='public' order by value->>'id' loop
    for s in select jsonb_array_elements_text(f->'suits') loop
      entries:=entries||jsonb_build_array(jsonb_build_object('id',md5(s||':'||(p_snapshot#>>array['baseVersions',s])||':'||(f->>'id')),
        'suit',s,'version',versions->>s,'title',f#>'{notes,title}','summary',f#>'{notes,summary}','details',f#>'{notes,details}'));
    end loop;
  end loop;
  m:=p_snapshot||jsonb_build_object('versions',versions,'entries',entries);
  insert into public.release_candidate_revisions(key,request,manifest,digest) values(key,p_snapshot,m,super_admin_private.release_digest(m));
  insert into public.release_candidate_pointer values(true,key) on conflict(singleton) do update set revision_key=excluded.revision_key;
  return jsonb_build_object('key',key,'manifest',m,'digest',super_admin_private.release_digest(m),'readyAt',null);
end $$;

create function public.release_candidate_ready(p_key text,p_digest text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if super_admin_private.release_context()<>'staging' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  if p_key is distinct from (select revision_key from public.release_candidate_pointer) then raise exception 'STALE_CANDIDATE'; end if;
  if not exists(select 1 from public.release_candidate_revisions where key=p_key and digest=p_digest) then raise exception 'DIGEST_CONFLICT'; end if;
  update public.release_candidate_revisions set ready_at=clock_timestamp() where key=p_key and ready_at is null;
end $$;

create function public.release_candidate_promote(p_release jsonb,p_deployment_sha text,p_main_parent text,p_main_tree text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m jsonb:=p_release->'manifest'; stored public.release_candidate_promotions; versions jsonb; s text; v text; now_at timestamptz:=clock_timestamp();
begin
  if super_admin_private.release_context()<>'production' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  if p_deployment_sha !~ '^[a-f0-9]{40}$' or m->>'mainSha' is distinct from p_main_parent or m->>'stagingTree' is distinct from p_main_tree
    or p_release->>'readyAt' is null then raise exception 'UNREADY_OR_WRONG_PROMOTION_PROVENANCE'; end if;
  if super_admin_private.release_digest(m) is distinct from p_release->>'digest' then raise exception 'DIGEST_CONFLICT'; end if;
  if super_admin_private.release_digest(jsonb_build_object('stagingSha',m->>'stagingSha','mainSha',m->>'mainSha','baseVersions',m->'baseVersions')) is distinct from p_release->>'key' then raise exception 'DIGEST_CONFLICT'; end if;
  select * into stored from public.release_candidate_promotions where revision_key=p_release->>'key';
  if found then
    if stored.manifest<>m or stored.digest<>p_release->>'digest' or stored.deployment_sha<>p_deployment_sha then raise exception 'DIGEST_CONFLICT'; end if;
    return jsonb_build_object('key',stored.revision_key,'manifest',m,'digest',stored.digest,'deploymentSha',stored.deployment_sha,'publishedAt',stored.first_published_at);
  end if;
  for s,v in select * from jsonb_each_text(m->'baseVersions') loop
    if not exists(select 1 from public.release_candidate_versions cv join public.suit_registry sr on sr.id=cv.suit_id where sr.stable_key=s) then
      if v<>'0.0.0' or exists(select 1 from public.release_candidate_promotions)
        or exists(select 1 from public.release_manifests where first_published_at is not null) then raise exception 'VERIFIED_PRODUCTION_BASELINE_REQUIRED'; end if;
      insert into public.release_candidate_versions select id,'0.0.0','Verified first official production origin from accepted candidate'
        from public.suit_registry where stable_key=s and status='active';
    end if;
  end loop;
  versions:=super_admin_private.candidate_versions(m);
  if versions is distinct from m->'versions' then raise exception 'VERSION_CONFLICT'; end if;
  if coalesce((select jsonb_agg(jsonb_build_object('id',md5(suit_key||':'||(m#>>array['baseVersions',suit_key])||':'||(f->>'id')),
    'suit',suit_key,'version',versions->>suit_key,'title',f#>'{notes,title}','summary',f#>'{notes,summary}','details',f#>'{notes,details}') order by f->>'id',suit_ordinal)
    from jsonb_array_elements(m->'changes') f cross join lateral jsonb_array_elements_text(f->'suits') with ordinality x(suit_key,suit_ordinal)
    where f->>'disposition'='public'),'[]'::jsonb) is distinct from m->'entries' then raise exception 'INVALID_GENERATED_ENTRIES'; end if;

  insert into public.release_candidate_promotions values(p_release->>'key',m,p_release->>'digest',p_deployment_sha,now_at);
  for s,v in select * from jsonb_each_text(versions) loop
    insert into public.release_candidate_versions select id,v,'Exact deployed upcoming release promotion' from public.suit_registry where stable_key=s
      on conflict(suit_id) do update set version=excluded.version,evidence=excluded.evidence;
  end loop;
  insert into public.release_candidate_baseline values(true,p_deployment_sha) on conflict(singleton) do update set production_sha=excluded.production_sha;
  return jsonb_build_object('key',p_release->>'key','manifest',m,'digest',p_release->>'digest','deploymentSha',p_deployment_sha,'publishedAt',now_at);
end $$;

create function public.release_candidate_acknowledge(p_receipt jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare saved public.release_candidate_revisions; stored public.release_candidate_promotions; s text; v text;
begin
  if super_admin_private.release_context()<>'staging' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  select * into saved from public.release_candidate_revisions where key=p_receipt->>'key';
  if not found or saved.manifest is distinct from p_receipt->'manifest' or saved.digest is distinct from p_receipt->>'digest'
    or p_receipt->>'publishedAt' is null or coalesce(p_receipt->>'deploymentSha','') !~ '^[a-f0-9]{40}$' then raise exception 'MISSING_EXACT_CANDIDATE_RECEIPT'; end if;
  select * into stored from public.release_candidate_promotions where revision_key=saved.key;
  if found then
    if stored.digest<>saved.digest or stored.deployment_sha<>p_receipt->>'deploymentSha' or stored.first_published_at<>(p_receipt->>'publishedAt')::timestamptz then raise exception 'DIGEST_CONFLICT'; end if;
    return;
  end if;
  perform super_admin_private.candidate_versions(saved.manifest);
  insert into public.release_candidate_promotions values(saved.key,saved.manifest,saved.digest,p_receipt->>'deploymentSha',(p_receipt->>'publishedAt')::timestamptz);
  for s,v in select * from jsonb_each_text(saved.manifest->'versions') loop
    update public.release_candidate_versions set version=v,evidence='Acknowledged exact production release receipt' where suit_id=(select id from public.suit_registry where stable_key=s);
  end loop;
  insert into public.release_candidate_baseline values(true,p_receipt->>'deploymentSha') on conflict(singleton) do update set production_sha=excluded.production_sha;
  -- Only the pointer changes; every candidate revision and old v1 record remains retained.
  update public.release_candidate_pointer set revision_key=null;
end $$;

create function super_admin_private.candidate_immutable() returns trigger
language plpgsql set search_path='' as $$ begin
  if tg_op='DELETE' then raise exception 'IMMUTABLE_CANDIDATE_HISTORY'; end if;
  if tg_table_name='release_candidate_promotions' then raise exception 'IMMUTABLE_CANDIDATE_HISTORY'; end if;
  if new.key<>old.key or new.request<>old.request or new.manifest<>old.manifest or new.digest<>old.digest or new.created_at<>old.created_at
    or (old.ready_at is not null and new.ready_at is distinct from old.ready_at) then raise exception 'IMMUTABLE_CANDIDATE_HISTORY'; end if;
  return new;
end $$;
create trigger candidate_revision_immutable before update or delete on public.release_candidate_revisions for each row execute function super_admin_private.candidate_immutable();
create trigger candidate_promotion_immutable before update or delete on public.release_candidate_promotions for each row execute function super_admin_private.candidate_immutable();

-- Old entrypoints cannot allocate or advertise per-merge releases after model adoption.
create or replace function public.release_stage_accept(p_request jsonb) returns jsonb language plpgsql set search_path='' as $$ begin raise exception 'PER_MERGE_RELEASES_RETIRED'; end $$;
create or replace function public.release_publish(p_environment text,p_ref text,p_deployment_sha text,p_releases jsonb) returns jsonb language plpgsql set search_path='' as $$ begin raise exception 'PER_MERGE_RELEASES_RETIRED'; end $$;
revoke all on function super_admin_private.candidate_versions(jsonb,boolean),super_admin_private.candidate_immutable() from public,anon,authenticated,service_role;
revoke all on function public.release_candidate_state(),public.release_candidate_refresh(jsonb),public.release_candidate_ready(text,text),public.release_candidate_promote(jsonb,text,text,text),public.release_candidate_acknowledge(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_state(),public.release_candidate_refresh(jsonb),public.release_candidate_ready(text,text),public.release_candidate_promote(jsonb,text,text,text),public.release_candidate_acknowledge(jsonb) to service_role;

create function super_admin_private.release_legacy_public_feed() returns jsonb
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
revoke all on function super_admin_private.release_legacy_public_feed() from public,anon,authenticated,service_role;
create function super_admin_private.candidate_public_entry(e jsonb,p_status text,p_time timestamptz) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('id',e->>'id','suit',e->>'suit','visibility','public','status',p_status,
 'title',jsonb_build_object('en',e#>>'{title,en}','ar',e#>>'{title,ar}'),
 'summary',jsonb_build_object('en',e#>>'{summary,en}','ar',e#>>'{summary,ar}'),
 'details',jsonb_build_object('en',e#>>'{details,en}','ar',e#>>'{details,ar}'), 'links','[]'::jsonb,
 'publishedAt',to_char(p_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 ||case when p_status='released' then jsonb_build_object('version',e->>'version','releasedAt',to_char(p_time at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
 else jsonb_build_object('targetVersion',e->>'version') end
$$;
revoke all on function super_admin_private.candidate_public_entry(jsonb,text,timestamptz) from public,anon,authenticated,service_role;
create or replace function public.release_public_feed() returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text; legacy jsonb; upcoming jsonb; released jsonb;
begin
 select e.environment_kind into kind from public.release_catalog_configuration c join public.admin_environments e on e.id=c.authority_environment_id where e.status='active';
 if kind not in ('staging','production') or kind is null then raise exception 'RELEASE_CONFIGURATION_REQUIRED'; end if;
 legacy:=super_admin_private.release_legacy_public_feed();
 select coalesce(jsonb_agg(super_admin_private.candidate_public_entry(e,'released',p.first_published_at) order by p.first_published_at desc,e->>'id'),'[]') into released
   from public.release_candidate_promotions p cross join lateral jsonb_array_elements(p.manifest->'entries') e;
 select coalesce(jsonb_agg(super_admin_private.candidate_public_entry(e,'coming-soon',r.ready_at) order by e->>'id'),'[]') into upcoming
   from public.release_candidate_pointer p join public.release_candidate_revisions r on r.key=p.revision_key
   cross join lateral jsonb_array_elements(r.manifest->'entries') e where kind='staging' and r.ready_at is not null;
 return jsonb_build_object('serverNow',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'suits',legacy->'suits','entries',upcoming||released||(legacy->'entries'));
end $$;
