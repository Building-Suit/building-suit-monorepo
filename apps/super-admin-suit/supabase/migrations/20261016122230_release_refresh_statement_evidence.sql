-- Classify the actual retained stack without replacing deployed business logic.
-- No source, fingerprint, line number, context or user data leaves the server.
create or replace function public.release_candidate_refresh(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context_text text; descriptor record; contract_matches boolean; frame text[]; retained_checked boolean:=false;
 location text:='CANDIDATE_CARDINALITY_REFRESH';
begin
  return super_admin_private.release_candidate_refresh_retained(p_snapshot);
exception when cardinality_violation then
  get stacked diagnostics context_text=pg_exception_context;
  for descriptor in select * from (values
      ('super_admin_private.release_digest(jsonb)','release_digest','CANDIDATE_CARDINALITY_DIGEST','f428532727c4c22e31b98a79bac21b20','sql','i',false,'text'),
      ('super_admin_private.candidate_baseline_tree()','candidate_baseline_tree','CANDIDATE_CARDINALITY_BASELINE_TREE','8d1d4f53aa25b454782d788a7a5dc1ce','sql','s',false,'text'),
      ('super_admin_private.release_copy_valid(jsonb)','release_copy_valid','CANDIDATE_CARDINALITY_COPY_VALIDATOR','d8fce8f544c37dd64ad5bfb658ecbc2e','sql','i',false,'boolean'),
      ('super_admin_private.candidate_versions(jsonb)','candidate_versions','CANDIDATE_CARDINALITY_VERSION_VALIDATOR','e9b56132a73e521f96313312d83884d9','plpgsql','v',true,'jsonb'),
      ('super_admin_private.release_context()','release_context','CANDIDATE_CARDINALITY_AUTHORITY','81c4eaac06a70db2eb9e9e6ee0690bb8','plpgsql','v',true,'text'),
      ('super_admin_private.release_candidate_refresh_retained(jsonb)','release_candidate_refresh_retained','CANDIDATE_CARDINALITY_REFRESH','5321a5869a48093468281a81de624226','plpgsql','v',true,'jsonb')
  ) as expected(signature,function_name,reason,source_md5,language_name,volatility,is_definer,result_type)
  order by case reason when 'CANDIDATE_CARDINALITY_REFRESH' then 0 when 'CANDIDATE_CARDINALITY_DIGEST' then 1
    when 'CANDIDATE_CARDINALITY_BASELINE_TREE' then 2 when 'CANDIDATE_CARDINALITY_COPY_VALIDATOR' then 3
    when 'CANDIDATE_CARDINALITY_VERSION_VALIDATOR' then 4 else 5 end loop
    if descriptor.reason<>'CANDIDATE_CARDINALITY_REFRESH' and not retained_checked then exit; end if;
    if context_text ~ pg_catalog.format(E'(^|\\n)(SQL function "(super_admin_private\\.)?%s"|PL/pgSQL function (super_admin_private\\.)?%s\\()',descriptor.function_name,descriptor.function_name) then
      select pg_catalog.md5(p.prosrc)=descriptor.source_md5 and l.lanname=descriptor.language_name
        and p.provolatile::text=descriptor.volatility and p.prosecdef=descriptor.is_definer
        and not p.proretset and p.prorettype=pg_catalog.to_regtype(descriptor.result_type)
        and p.proconfig is not distinct from array['search_path=""']::text[]
      into contract_matches from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
      where p.oid=pg_catalog.to_regprocedure(descriptor.signature);
      location:=descriptor.reason;
      if not coalesce(contract_matches,false) then
        location:=location||'_CONTRACT_MISMATCH';
      elsif descriptor.reason='CANDIDATE_CARDINALITY_REFRESH' then
        -- Interpret line positions only after the retained body/contract matches.
        frame:=pg_catalog.regexp_match(context_text,E'PL/pgSQL function (?:super_admin_private\\.)?release_candidate_refresh_retained\\(jsonb\\) line ([0-9]{1,4}) at ');
        location:=case coalesce(frame[1],'0')::integer
          when 5 then 'CANDIDATE_CARDINALITY_AUTHORITY'
          when 7 then 'CANDIDATE_CARDINALITY_KEY_DIGEST'
          when 8 then 'CANDIDATE_CARDINALITY_REVISION_READ'
          when 13 then 'CANDIDATE_CARDINALITY_VERSION_VALIDATOR'
          when 15 then 'CANDIDATE_CARDINALITY_BASELINE_READ'
          when 16 then 'CANDIDATE_CARDINALITY_BASELINE_PIN'
          when 17 then 'CANDIDATE_CARDINALITY_BASELINE_TREE'
          when 22 then 'CANDIDATE_CARDINALITY_ENTRY_BUILD'
          when 27 then 'CANDIDATE_CARDINALITY_REVISION_WRITE'
          when 28 then 'CANDIDATE_CARDINALITY_POINTER_WRITE'
          when 29 then 'CANDIDATE_CARDINALITY_RETURN_DIGEST'
          else 'CANDIDATE_CARDINALITY_REFRESH_MATCHED_CONTRACT' end;
        if location='CANDIDATE_CARDINALITY_REVISION_WRITE' and exists(
          select 1 from pg_catalog.pg_trigger where tgrelid='public.release_candidate_revisions'::regclass
          and not tgisinternal and tgenabled in ('O','A') and (tgtype::integer & 4)=4) then
          location:='CANDIDATE_CARDINALITY_REVISION_WRITE_TRIGGER_PRESENT';
        elsif location='CANDIDATE_CARDINALITY_POINTER_WRITE' and exists(
          select 1 from pg_catalog.pg_trigger where tgrelid='public.release_candidate_pointer'::regclass
          and not tgisinternal and tgenabled in ('O','A') and (tgtype::integer & 20)<>0) then
          location:='CANDIDATE_CARDINALITY_POINTER_WRITE_TRIGGER_PRESENT';
        end if;
        retained_checked:=true;
        -- Retained contract must match before interpreting any nested identity.
        -- Keep this statement fallback; a recognized inner frame may refine it.
        continue;
      end if;
      exit;
    end if;
  end loop;
  raise exception using errcode='21000',message=location,detail='',hint='';
end $$;
revoke all on function public.release_candidate_refresh(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_refresh(jsonb) to service_role;
