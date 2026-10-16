-- Preserve the deployed implementation; diagnose 21000 without guessing a data repair.
-- Only the existing provider/Git migration path applies this forward migration.
do $$
begin
  perform pg_advisory_xact_lock(736271901);
  if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.release_candidate_refresh(jsonb)')
    and prosecdef and prorettype='jsonb'::regtype) then
    raise exception 'RELEASE_REFRESH_CONTRACT_REVIEW_REQUIRED';
  end if;
end $$;
alter function public.release_candidate_refresh(jsonb) set schema super_admin_private;
alter function super_admin_private.release_candidate_refresh(jsonb) rename to release_candidate_refresh_retained;
revoke all on function super_admin_private.release_candidate_refresh_retained(jsonb) from public,anon,authenticated,service_role;

create function public.release_candidate_refresh(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context_text text; location text:='CANDIDATE_CARDINALITY_REFRESH';
begin
  return super_admin_private.release_candidate_refresh_retained(p_snapshot);
exception when cardinality_violation then
  get stacked diagnostics context_text=pg_exception_context;
  -- Parse only known stack-frame forms. Never emit the context, SQL, values or line numbers.
  if context_text ~ E'(^|\\n)(SQL function "candidate_baseline_tree"|PL/pgSQL function super_admin_private\\.candidate_baseline_tree\\(\\))' then
    location:='CANDIDATE_CARDINALITY_BASELINE_TREE';
  elsif context_text ~ E'(^|\\n)(SQL function "release_copy_valid"|PL/pgSQL function super_admin_private\\.release_copy_valid\\(jsonb\\))' then
    location:='CANDIDATE_CARDINALITY_COPY_VALIDATOR';
  elsif context_text ~ E'(^|\\n)PL/pgSQL function super_admin_private\\.candidate_versions\\(jsonb\\)' then
    location:='CANDIDATE_CARDINALITY_VERSION_VALIDATOR';
  elsif context_text ~ E'(^|\\n)PL/pgSQL function super_admin_private\\.release_context\\(\\)' then
    location:='CANDIDATE_CARDINALITY_AUTHORITY';
  end if;
  raise exception using errcode='21000',message=location,detail='',hint='';
end $$;
revoke all on function public.release_candidate_refresh(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_refresh(jsonb) to service_role;
