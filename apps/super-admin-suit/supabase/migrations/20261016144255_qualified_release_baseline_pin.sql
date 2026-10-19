-- Honor the existing pg-safeupdate gate; no table, role, hook or history changes.
-- The reviewed prior functions must match before applying this bounded source repair.
do $$ begin
  perform pg_advisory_xact_lock(736271901);
  if not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('super_admin_private.release_candidate_refresh_retained(jsonb)') and pg_catalog.md5(prosrc)='5321a5869a48093468281a81de624226')
    or not exists(select 1 from pg_catalog.pg_proc where oid=pg_catalog.to_regprocedure('public.release_candidate_acknowledge(jsonb)') and pg_catalog.md5(prosrc)='fe0201caa17cc96f6ca7ed4b0c5b7210') then
    raise exception 'RELEASE_QUALIFIED_WRITE_CONTRACT_REVIEW_REQUIRED';
  end if;
end $$;
create or replace function super_admin_private.release_candidate_refresh_retained(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
<<refresh>>
declare key text; stored public.release_candidate_revisions; versions jsonb; entries jsonb:='[]'; f jsonb; s text; m jsonb; affected bigint;
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
  if not exists(select 1 from public.release_candidate_baseline) then raise exception 'VERIFIED_PRODUCTION_BASELINE_REQUIRED'; end if;
  if (select production_sha from public.release_candidate_baseline) is null then
    update public.release_candidate_baseline set production_sha=p_snapshot->>'mainSha' where singleton is true and production_sha is null;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'PRODUCTION_BASELINE_CHANGED'; end if;
  elsif super_admin_private.candidate_baseline_tree() is distinct from p_snapshot->>'mainTree' then
    raise exception 'PRODUCTION_BASELINE_ACK_REQUIRED';
  end if;
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
revoke all on function super_admin_private.release_candidate_refresh_retained(jsonb) from public,anon,authenticated,service_role;
create or replace function public.release_candidate_acknowledge(p_receipt jsonb) returns void
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
  update public.release_candidate_pointer set revision_key=null where singleton is true;
end $$;
revoke all on function public.release_candidate_acknowledge(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_acknowledge(jsonb) to service_role;

-- Classify the actual retained stack without replacing deployed business logic.
-- No source, fingerprint, line number, context or user data leaves the server.
create or replace function public.release_candidate_refresh(p_snapshot jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context_text text; original_message text; descriptor record; contract_matches boolean; frame text[]; retained_checked boolean:=false;
 location text:='CANDIDATE_CARDINALITY_REFRESH';
begin
  return super_admin_private.release_candidate_refresh_retained(p_snapshot);
exception when cardinality_violation then
  get stacked diagnostics context_text=pg_exception_context,original_message=message_text;
  for descriptor in select * from (values
      ('super_admin_private.release_digest(jsonb)','release_digest','CANDIDATE_CARDINALITY_DIGEST','f428532727c4c22e31b98a79bac21b20','sql','i',false,'text'),
      ('super_admin_private.candidate_baseline_tree()','candidate_baseline_tree','CANDIDATE_CARDINALITY_BASELINE_TREE','8d1d4f53aa25b454782d788a7a5dc1ce','sql','s',false,'text'),
      ('super_admin_private.release_copy_valid(jsonb)','release_copy_valid','CANDIDATE_CARDINALITY_COPY_VALIDATOR','d8fce8f544c37dd64ad5bfb658ecbc2e','sql','i',false,'boolean'),
      ('super_admin_private.candidate_versions(jsonb)','candidate_versions','CANDIDATE_CARDINALITY_VERSION_VALIDATOR','e9b56132a73e521f96313312d83884d9','plpgsql','v',true,'jsonb'),
      ('super_admin_private.release_context()','release_context','CANDIDATE_CARDINALITY_AUTHORITY','81c4eaac06a70db2eb9e9e6ee0690bb8','plpgsql','v',true,'text'),
      ('super_admin_private.release_candidate_refresh_retained(jsonb)','release_candidate_refresh_retained','CANDIDATE_CARDINALITY_REFRESH','3754d69ce4edcd633561db479e31777d','plpgsql','v',true,'jsonb')
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
          when 19 then 'CANDIDATE_CARDINALITY_BASELINE_TREE'
          when 24 then 'CANDIDATE_CARDINALITY_ENTRY_BUILD'
          when 29 then 'CANDIDATE_CARDINALITY_REVISION_WRITE'
          when 30 then 'CANDIDATE_CARDINALITY_POINTER_WRITE'
          when 31 then 'CANDIDATE_CARDINALITY_RETURN_DIGEST'
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
  if original_message='UPDATE requires a WHERE clause' then location:='CANDIDATE_UPDATE_REQUIRES_WHERE'; end if;
  raise exception using errcode='21000',message=location,detail='',hint='';
end $$;
revoke all on function public.release_candidate_refresh(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.release_candidate_refresh(jsonb) to service_role;
