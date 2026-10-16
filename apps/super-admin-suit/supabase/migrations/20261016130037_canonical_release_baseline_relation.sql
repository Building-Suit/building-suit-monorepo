-- Repair the proven staging baseline UPDATE boundary without deleting its evidence.
-- The original relation, rows, rules, constraints and triggers are retained privately.
do $$
declare baseline_oid oid; before_row jsonb; after_row jsonb; rows_count bigint;
begin
  perform pg_advisory_xact_lock(736271901);
  if not exists(select 1 from public.release_catalog_configuration c join public.admin_environments e on e.id=c.authority_environment_id
    where e.id='a0bb00a1-747c-4cda-8521-9927d0b53065' and e.stable_key='sas-staging'
      and e.environment_kind='staging' and e.status='active') then
    raise notice 'RELEASE_BASELINE_RELATION_NOT_VERIFIED_STAGING'; return;
  end if;
  lock table public.release_candidate_baseline in access exclusive mode;
  select count(*) into rows_count from public.release_candidate_baseline;
  -- Unconfigured/ambiguous legacy catalogs are not activated by this repair.
  if rows_count=0 then raise notice 'RELEASE_BASELINE_RELATION_NOT_INITIALIZED'; return; end if;
  if rows_count<>1 or exists(select 1 from public.release_candidate_baseline where singleton is distinct from true
    or (production_sha is not null and production_sha::text !~ '^[a-f0-9]{40}$')) then
    raise exception 'RELEASE_BASELINE_ROW_REVIEW_REQUIRED';
  end if;
  if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('super_admin_private.release_candidate_refresh_retained(jsonb)')
    and pg_catalog.md5(prosrc)='5321a5869a48093468281a81de624226' and prosecdef and not proretset
    and provolatile='v' and prolang=(select oid from pg_catalog.pg_language where lanname='plpgsql')
    and prorettype='jsonb'::regtype and proconfig is not distinct from array['search_path=""']::text[]) then
    raise exception 'RELEASE_BASELINE_REFRESH_CONTRACT_REVIEW_REQUIRED';
  end if;
  baseline_oid:='public.release_candidate_baseline'::regclass;
  if not exists(select 1 from pg_catalog.pg_class where oid=baseline_oid and relkind='r' and relpersistence='p')
    or (select count(*) from pg_catalog.pg_attribute where attrelid=baseline_oid and attnum>0 and not attisdropped)<>2
    or exists(select 1 from pg_catalog.pg_inherits where inhrelid=baseline_oid or inhparent=baseline_oid)
    or pg_catalog.to_regclass('super_admin_private.release_candidate_baseline_before_relation_repair') is not null then
    raise exception 'RELEASE_BASELINE_RELATION_REVIEW_REQUIRED';
  end if;
  -- Do not silently detach external consumers of the old relation/row type.
  if exists(select 1 from pg_catalog.pg_constraint where contype='f' and confrelid=baseline_oid)
    or exists(select 1 from pg_catalog.pg_depend d join pg_catalog.pg_rewrite r on r.oid=d.objid
      where d.classid='pg_rewrite'::regclass and d.refobjid=baseline_oid and r.ev_class<>baseline_oid)
    or exists(select 1 from pg_catalog.pg_depend d where d.classid='pg_proc'::regclass
      and d.refobjid=(select reltype from pg_catalog.pg_class where oid=baseline_oid)) then
    raise exception 'RELEASE_BASELINE_DEPENDENCY_REVIEW_REQUIRED';
  end if;
  select jsonb_build_object('singleton',singleton,'productionSha',production_sha::text) into before_row from public.release_candidate_baseline;
  alter table public.release_candidate_baseline set schema super_admin_private;
  alter table super_admin_private.release_candidate_baseline rename to release_candidate_baseline_before_relation_repair;
  revoke all on super_admin_private.release_candidate_baseline_before_relation_repair from public,anon,authenticated,service_role;

  -- Canonical source-owned shape: no copied hook, rewrite rule, domain or policy.
  create table public.release_candidate_baseline (
    singleton boolean primary key default true check(singleton),
    production_sha text check(production_sha ~ '^[a-f0-9]{40}$')
  );
  alter table public.release_candidate_baseline enable row level security;
  revoke all on public.release_candidate_baseline from public,anon,authenticated,service_role;
  insert into public.release_candidate_baseline(singleton,production_sha)
    select singleton,production_sha::text from super_admin_private.release_candidate_baseline_before_relation_repair;
  if exists(select 1 from pg_catalog.pg_trigger where tgrelid='public.release_candidate_baseline'::regclass and not tgisinternal)
    or exists(select 1 from pg_catalog.pg_rewrite where ev_class='public.release_candidate_baseline'::regclass)
    or exists(select 1 from pg_catalog.pg_policy where polrelid='public.release_candidate_baseline'::regclass) then
    raise exception 'RELEASE_BASELINE_NEW_HOOK_REVIEW_REQUIRED';
  end if;
  select jsonb_build_object('singleton',singleton,'productionSha',production_sha) into after_row from public.release_candidate_baseline;
  if (select count(*) from public.release_candidate_baseline)<>1 or after_row is distinct from before_row then
    raise exception 'RELEASE_BASELINE_COPY_REVIEW_REQUIRED';
  end if;
end $$;
