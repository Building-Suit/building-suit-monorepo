-- Fixture setup only, loaded inside rolled-back legacy-history suites.
-- Retired public RPC grants and Storage policies are never restored. These
-- temporary helpers seed historical notices/evidence for preserved read/review
-- invariants; they are not exposed by REST or installed by a migration.
create temporary table legacy_billing_fixture_scope (unused boolean);
do $$
declare routine record; parameters text; definition text;
begin
  for routine in
    select p.oid,p.proname,p.pronargs from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('submit_shop_billing_notice','reserve_shop_billing_payment_evidence')
  loop
    select string_agg('$'||argument::text,',' order by argument) into parameters
      from generate_series(1,routine.pronargs) argument;
    definition:=format('begin
      if not exists(select 1 from auth.users where id=auth.uid() and email ~ ''\.(invalid|test)$'') then
        raise exception ''Historical fixture identity required'' using errcode=''42501'';
      end if;
      return public.%I(%s);
    end;',routine.proname,parameters);
    execute format('create function pg_temp.%I(%s) returns %s language plpgsql security definer set search_path='''' as %L',
      'seed_legacy_'||routine.proname,pg_get_function_arguments(routine.oid),pg_get_function_result(routine.oid),definition);
    execute format('revoke all on function pg_temp.%I(%s) from public,anon,service_role',
      'seed_legacy_'||routine.proname,pg_get_function_identity_arguments(routine.oid));
    execute format('grant execute on function pg_temp.%I(%s) to authenticated',
      'seed_legacy_'||routine.proname,pg_get_function_identity_arguments(routine.oid));
  end loop;
end $$;
create function pg_temp.seed_legacy_payment_object(p_name text,p_metadata jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.users where id=auth.uid() and email ~ '\.(invalid|test)$')
    or shop_private.billing_payment_evidence_upload_allowed(p_name,p_metadata) is not true then
    raise exception 'Invalid historical evidence fixture' using errcode='42501';
  end if;
  insert into storage.objects(bucket_id,name,metadata) values('shop-payment-evidence',p_name,p_metadata);
end $$;
revoke all on function pg_temp.seed_legacy_payment_object(text,jsonb) from public,anon,service_role;
grant execute on function pg_temp.seed_legacy_payment_object(text,jsonb) to authenticated;
