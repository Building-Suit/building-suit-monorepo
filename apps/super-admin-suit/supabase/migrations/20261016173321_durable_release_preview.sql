-- Fail closed on unreviewed deployed routines before changing their publication semantics.
do $$ begin
  perform pg_advisory_xact_lock(736271901);
  if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.release_candidate_ready(text,text)') and pg_catalog.md5(prosrc)='9b0c5515bd92b9cbaef37bc2f9c59099')
    or not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.release_candidate_acknowledge(jsonb)') and pg_catalog.md5(prosrc)='428f4090319f86f62786bf0c078e938f')
    or not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.release_public_feed()') and pg_catalog.md5(prosrc)='28bd2eb00b579b15dc841feef6a9e48a') then
    raise exception 'RELEASE_PREVIEW_CONTRACT_REVIEW_REQUIRED';
  end if;
end $$;

-- Refresh retains pending provenance; only authenticated readiness publishes a preview.
-- No retained refresh body, diagnostic fingerprint, safety guard or history is replaced.
create table public.release_candidate_preview (
  singleton boolean primary key default true check(singleton),
  revision_key text references public.release_candidate_revisions(key)
);
alter table public.release_candidate_preview enable row level security;
revoke all on public.release_candidate_preview from public,anon,authenticated,service_role;

-- Adopt only an already verified preview belonging to the current production baseline.
-- A cleared pending pointer is an acknowledged retirement boundary: never search behind it.
do $$ begin
  perform pg_advisory_xact_lock(736271901);
  if exists(select 1 from public.release_candidate_pointer where singleton is true and revision_key is not null) then
    insert into public.release_candidate_preview(singleton,revision_key)
      select true,r.key from public.release_candidate_revisions r
      where r.ready_at is not null and r.manifest->>'mainTree'=super_admin_private.candidate_baseline_tree()
        and r.manifest->'baseVersions'=coalesce((select jsonb_object_agg(s.stable_key,v.version)
          from public.release_candidate_versions v join public.suit_registry s on s.id=v.suit_id),'{}'::jsonb)
        and not exists(select 1 from public.release_candidate_promotions where revision_key=r.key)
      order by r.ready_at desc,r.created_at desc,r.key limit 1;
  elsif exists(select 1 from public.release_candidate_promotions) then
    insert into public.release_candidate_preview values(true,null);
  end if;
end $$;

create or replace function public.release_candidate_ready(p_key text,p_digest text) returns void
language plpgsql security definer set search_path='' as $$
declare candidate public.release_candidate_revisions; affected bigint;
begin
  if super_admin_private.release_context()<>'staging' then raise exception 'WRONG_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(736271901);
  if p_key is null or p_key is distinct from (select revision_key from public.release_candidate_pointer where singleton is true) then raise exception 'STALE_CANDIDATE'; end if;
  select * into candidate from public.release_candidate_revisions where key=p_key and digest=p_digest;
  if not found then raise exception 'DIGEST_CONFLICT'; end if;
  if exists(select 1 from public.release_candidate_promotions where revision_key=p_key)
    or super_admin_private.candidate_baseline_tree() is distinct from candidate.manifest->>'mainTree' then raise exception 'STALE_CANDIDATE'; end if;
  perform super_admin_private.candidate_versions(candidate.manifest);
  update public.release_candidate_revisions set ready_at=clock_timestamp() where key=p_key and ready_at is null;
  if not exists(select 1 from public.release_candidate_revisions where key=p_key and ready_at is not null) then raise exception 'STAGING_CANDIDATE_NOT_READY'; end if;
  -- Pending and public pointers are deliberately independent. Empty candidates publish an empty preview only here.
  insert into public.release_candidate_preview(singleton,revision_key) values(true,p_key)
    on conflict(singleton) do update set revision_key=excluded.revision_key;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'STAGING_CANDIDATE_NOT_READY'; end if;
end $$;
revoke all on function public.release_candidate_ready(text,text) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_ready(text,text) to service_role;

create or replace function public.release_candidate_acknowledge(p_receipt jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare saved public.release_candidate_revisions; stored public.release_candidate_promotions; s text; v text; affected bigint;
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
  update public.release_candidate_pointer set revision_key=null where singleton is true;
  -- A new production receipt retires the whole old preview atomically. An identical receipt retry returns above,
  -- preserving a subsequently verified preview against the new production baseline.
  insert into public.release_candidate_preview(singleton,revision_key) values(true,null)
    on conflict(singleton) do update set revision_key=null;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'STAGING_CANDIDATE_NOT_READY'; end if;
end $$;
revoke all on function public.release_candidate_acknowledge(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_acknowledge(jsonb) to service_role;


create or replace function public.release_public_feed() returns jsonb
language plpgsql security definer set search_path='' as $$
declare kind text; legacy jsonb; upcoming jsonb; released jsonb;
begin
 select e.environment_kind into kind from public.release_catalog_configuration c join public.admin_environments e on e.id=c.authority_environment_id where e.status='active';
 if kind not in ('staging','production') or kind is null then raise exception 'RELEASE_CONFIGURATION_REQUIRED'; end if;
 if kind='staging' and exists(select 1 from public.release_manifests where first_published_at is not null)
   and not exists(select 1 from public.release_candidate_versions) then raise exception 'LEGACY_RELEASE_HISTORY_REVIEW_REQUIRED'; end if;
 if kind='staging' and not exists(select 1 from public.release_candidate_preview where singleton is true) then
   if not exists(select 1 from public.release_candidate_pointer where singleton is true) then raise exception 'CANDIDATE_RECONCILIATION_REQUIRED'; end if;
   raise exception 'STAGING_CANDIDATE_NOT_READY';
 end if;
 legacy:=super_admin_private.release_legacy_public_feed();
 select coalesce(jsonb_agg(super_admin_private.candidate_public_entry(e,'released',p.first_published_at) order by p.first_published_at desc,e->>'id'),'[]') into released
   from public.release_candidate_promotions p cross join lateral jsonb_array_elements(p.manifest->'entries') e;
 select coalesce(jsonb_agg(super_admin_private.candidate_public_entry(e,'coming-soon',r.ready_at) order by e->>'id'),'[]') into upcoming
   from public.release_candidate_preview p join public.release_candidate_revisions r on r.key=p.revision_key
   cross join lateral jsonb_array_elements(r.manifest->'entries') e where kind='staging' and r.ready_at is not null;
 return jsonb_build_object('serverNow',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'suits',legacy->'suits','entries',upcoming||released||(legacy->'entries'));
end $$;
