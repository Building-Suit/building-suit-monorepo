-- Source-only exact-pair compatibility. Apply SQL before activating the reviewed
-- worker. This does not activate a worker, issue a qualification or change grants.
-- Preserve v1 capability bytes, accepted receipts and repository_qualified.
-- Rollback order: stop/drain the v2 worker and restore a reviewed v1 worker first;
-- then restore these five predecessor function definitions in one transaction,
-- and drop repository_worker_pair_allowed_v2(text,text),
-- repository_worker_compatibility_v2(), repository_worker_pairs_v2(), in that order.
-- Never rewrite/delete accepted evidence. Candidate evidence remains immutable;
-- removing v2 makes its source/review readiness false, not a historical success.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

do $guard$
declare expected record;
begin
 for expected in select * from (values
  ('hq_private.repository_worker_digest()','fd76583cb5302a741015e037785153e2','sql','i',false,'text',array['search_path=""']),
  ('hq_private.repository_module_digest()','147f047b0ec97ea3b107011806e405a0','sql','i',false,'text',array['search_path=""']),
  ('hq_private.repository_worker_digests()','5798c28f3b87cb369aedbf0c11192f66','sql','i',false,'text[]',array['search_path=""']),
  ('hq_private.repository_worker_digest_allowed(text)','cfbe5dcdfa7dcf2f240b0abd19205d10','sql','i',false,'boolean',array['search_path=""']),
  ('hq_private.repository_worker_compatibility()','1f56ad24efd066db94cbc16ca44d4aff','sql','i',false,'jsonb',array['search_path=""']),
  ('hq_private.repository_qualified(text)','597d4720e6c0df826832683f425d68e0','sql','s',true,'boolean',array['search_path=""']),
  ('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)','0cd8be8d8a4d9ba4629eaf338fa7b077','plpgsql','v',true,'void',array['search_path=""']),
  ('hq_private.repository_source_valid(uuid,uuid)','50c95649662cd58c69381f1603206135','sql','s',true,'boolean',array['search_path=""']),
  ('hq_private.repository_review_ready(uuid)','3791d16f204ce812d5506b1f8684938f','plpgsql','s',true,'boolean',array['search_path=""','join_collapse_limit=1']),
  ('hq_private.issue_repository_qualification(uuid)','1ed5faa1cd91371bd238f2e4a15aa3e2','plpgsql','v',true,'jsonb',array['search_path=""']),
  ('hq_private.worker_release_status(uuid)','78b39016c2b595222ad66271c8fdfee6','plpgsql','s',true,'jsonb',array['search_path=""'])
 ) contracts(signature,source_md5,language,volatility,security_definer,result_type,config)
 loop
  if not exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
   where p.oid=pg_catalog.to_regprocedure(expected.signature)
   and pg_catalog.md5(p.prosrc)=expected.source_md5 and p.prokind='f' and not p.proretset and not p.proisstrict
   and l.lanname=expected.language and p.provolatile::text=expected.volatility and p.prosecdef=expected.security_definer
   and p.prorettype=expected.result_type::pg_catalog.regtype and p.proconfig=expected.config) then
   raise exception 'HQ_REPOSITORY_COMPATIBILITY_V2_PREDECESSOR_MISMATCH:%',expected.signature using errcode='55000';
  end if;
 end loop;
end
$guard$;

-- Only newly reviewed pairs appear in v2. Legacy pairs stay in unchanged v1.
create function hq_private.repository_worker_pairs_v2() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_array(jsonb_build_object(
  'workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
  'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'))
$$;
create function hq_private.repository_worker_pair_allowed_v2(p_worker text,p_module text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce((hq_private.repository_worker_digest_allowed(p_worker) and p_module=hq_private.repository_module_digest())
  or exists(select 1 from jsonb_array_elements(hq_private.repository_worker_pairs_v2()) pair
   where pair->>'workerSourceDigest'=p_worker and pair->>'moduleSha256'=p_module),false)
$$;
create function hq_private.repository_worker_compatibility_v2() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('version',2,'policyId','hq-public-github-read-v1',
  'sourcePairs',hq_private.repository_worker_pairs_v2())
$$;
revoke all on function hq_private.repository_worker_pairs_v2(),
 hq_private.repository_worker_pair_allowed_v2(text,text),hq_private.repository_worker_compatibility_v2()
 from public,anon,authenticated,service_role;

-- Replace one exact predicate per function. Preserve all other checks, OIDs,
-- signatures, owners, privileges, volatility and local planner configuration.
do $replace$
declare signature text; old_expression text; new_expression text; source text;
begin
 for signature,old_expression,new_expression in select * from (values
  ('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)',
   'not hq_private.repository_worker_digest_allowed(p_proof->>''workerSourceDigest'')',
   'not hq_private.repository_worker_pair_allowed_v2(p_proof->>''workerSourceDigest'',p_proof->''publicRepositoryPolicy''->>''moduleSha256'')'),
  ('hq_private.repository_source_valid(uuid,uuid)',
   'hq_private.repository_worker_digest_allowed(x.proof->>''workerSourceDigest'')',
   'hq_private.repository_worker_pair_allowed_v2(x.proof->>''workerSourceDigest'',x.proof->''publicRepositoryPolicy''->>''moduleSha256'')'),
  ('hq_private.repository_review_ready(uuid)',
   'hq_private.repository_worker_digest_allowed(execution.proof->>''workerSourceDigest'')',
   'hq_private.repository_worker_pair_allowed_v2(execution.proof->>''workerSourceDigest'',execution.proof->''publicRepositoryPolicy''->>''moduleSha256'')'),
  ('hq_private.worker_release_status(uuid)',
   'return result||jsonb_build_object(''repositoryApi'',hq_private.repository_api_proof(p_worker_id)->''api'',''repositoryWorkerCompatibility'',hq_private.repository_worker_compatibility());',
   'return result||jsonb_build_object(''repositoryApi'',hq_private.repository_api_proof(p_worker_id)->''api'',''repositoryWorkerCompatibility'',hq_private.repository_worker_compatibility(),''repositoryWorkerCompatibilityV2'',hq_private.repository_worker_compatibility_v2());'),
  ('hq_private.issue_repository_qualification(uuid)',
   'insert into hq_private.repository_qualifications(trial_id,agent_id,binding_digest,preset,manifest_digest,evidence_artifact_id,reviewer_binding,authorized_by)',
   $qualification$-- Compatibility admits source/review evidence, not a new qualification policy.
 if not exists(select 1 from hq_private.repository_host_executions execution
  join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and execution.artifact_id=artifact.id
   and execution.job_id=artifact.job_id and execution.artifact_digest=artifact.digest
  where hq_private.repository_worker_digest_allowed(execution.proof->>'workerSourceDigest')
   and execution.proof->'publicRepositoryPolicy'->>'moduleSha256'=hq_private.repository_module_digest()) then
  raise exception 'HQ_REPOSITORY_QUALIFICATION_WORKER_REQUIRED' using errcode='55000';
 end if;
 insert into hq_private.repository_qualifications(trial_id,agent_id,binding_digest,preset,manifest_digest,evidence_artifact_id,reviewer_binding,authorized_by)$qualification$)
 ) replacements(signature,old_expression,new_expression)
 loop
  source:=pg_catalog.pg_get_functiondef(signature::pg_catalog.regprocedure);
  if (length(source)-length(replace(source,old_expression,'')))/length(old_expression)<>1
   or position('repository_worker_pair_allowed_v2' in source)>0 or position('repositoryWorkerCompatibilityV2' in source)>0
   or position('HQ_REPOSITORY_QUALIFICATION_WORKER_REQUIRED' in source)>0 then
   raise exception 'HQ_REPOSITORY_COMPATIBILITY_V2_SOURCE_MISMATCH:%',signature using errcode='55000';
  end if;
  execute replace(source,old_expression,new_expression);
 end loop;
end
$replace$;

commit;
