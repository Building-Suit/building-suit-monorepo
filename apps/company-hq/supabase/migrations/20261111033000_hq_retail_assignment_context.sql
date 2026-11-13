-- Reconstructed bounded acknowledgment context; no tool grant or qualification change.
-- Preserve immutable scopes, receipts and qualifications. Prefer observing SQL first.
-- With phase-1 compatibility installed, the matching worker also safely accepts the
-- old context without this descriptive assignment; execution permits stay unchanged.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

do $assignment$
declare signature text:='hq_private.workforce_enrich_claim_before_repository(jsonb)';
 source text;
 old_expression text:=$old$    if j.kind='task-work' then
      context:=context||jsonb_build_object('publicDiscoveryPermit'$old$;
 new_expression text:=$new$    if j.kind='task-start' and j.attempt=0 and policy.trial_id is null then
      context:=context||jsonb_build_object('publicDiscoveryAssignment',jsonb_build_object('version',1,
        'policyId','exa-public-retail-discovery-v1','category',policy.category,'taskId',j.task_id,
        'agentId',j.agent_id,'bindingDigest',binding,'qualificationValidated',true,'toolExecutionAllowed',false));
    end if;
    if j.kind='task-work' then
      context:=context||jsonb_build_object('publicDiscoveryPermit'$new$;
begin
 if not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
  where p.oid=pg_catalog.to_regprocedure(signature)
  and pg_catalog.md5(p.prosrc)='0db742a9c2aeb28848ff5650253b4a0c'
  and l.lanname='plpgsql' and p.prokind='f' and p.provolatile='v' and p.prosecdef
  and not p.proretset and not p.proisstrict and not p.proleakproof and p.proparallel='u'
  and p.prorettype='jsonb'::pg_catalog.regtype and p.proconfig=array['search_path=""']
  and p.pronargs=1 and p.pronargdefaults=0 and p.provariadic=0
  and p.proargnames=array['v'] and p.proallargtypes is null and p.proargmodes is null
  and p.procost=100 and p.prorows=0 and p.prosupport=0) then
  raise exception 'HQ_RETAIL_ASSIGNMENT_PREDECESSOR_MISMATCH' using errcode='55000';
 end if;
 source:=pg_catalog.pg_get_functiondef(signature::pg_catalog.regprocedure);
 if (length(source)-length(replace(source,old_expression,'')))/length(old_expression)<>1
  or position('publicDiscoveryAssignment' in source)>0 then
  raise exception 'HQ_RETAIL_ASSIGNMENT_SOURCE_MISMATCH' using errcode='55000';
 end if;
 -- pg_get_functiondef retains metadata; CREATE OR REPLACE retains OID, owner and ACL.
 execute replace(source,old_expression,new_expression);
end
$assignment$;
commit;
