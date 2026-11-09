-- Source-only compatibility preparation for the reviewed diagnostic worker.
-- Keep the existing singleton pin and historical proofs unchanged. This permits
-- exactly two source versions, not arbitrary future workers or different modules.
begin;

-- One exact source set backs both admission and the authenticated capability.
create function hq_private.repository_worker_digests() returns text[]
language sql immutable security invoker set search_path='' as $$
 select array[
  'bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88',
  'e01fd99ead607d740fcea13b33a23627518762c5ce94c9fd99d993ddc0a5c935'
 ]::text[]
$$;
create function hq_private.repository_worker_digest_allowed(p_digest text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(p_digest=any(hq_private.repository_worker_digests()),false)
$$;
create function hq_private.repository_worker_compatibility() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('version',1,'policyId','hq-public-github-read-v1',
  'moduleSha256',hq_private.repository_module_digest(),
  'workerSourceDigests',to_jsonb(hq_private.repository_worker_digests()))
$$;
revoke all on function hq_private.repository_worker_digests(),
 hq_private.repository_worker_digest_allowed(text),hq_private.repository_worker_compatibility()
 from public,anon,authenticated,service_role;

-- Preserve complete existing bodies, signatures, owners, privileges and all
-- non-worker checks. Refuse a drifted/missing comparison rather than silently
-- accepting a broader or partially migrated contract.
do $$
declare signature text; old_expression text; new_expression text; source text; changed text;
begin
 for signature,old_expression,new_expression in
  select * from (values
   ('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)',
    'p_proof->>''workerSourceDigest'' is distinct from hq_private.repository_worker_digest()',
    'not hq_private.repository_worker_digest_allowed(p_proof->>''workerSourceDigest'')'),
   ('hq_private.repository_source_valid(uuid,uuid)',
    'x.proof->>''workerSourceDigest''=hq_private.repository_worker_digest()',
    'hq_private.repository_worker_digest_allowed(x.proof->>''workerSourceDigest'')'),
   ('hq_private.repository_review_ready(uuid)',
    'execution.proof->>''workerSourceDigest''=hq_private.repository_worker_digest()',
    'hq_private.repository_worker_digest_allowed(execution.proof->>''workerSourceDigest'')')
  ) replacements(signature,old_expression,new_expression)
 loop
  source:=pg_get_functiondef(signature::regprocedure);
  if (length(source)-length(replace(source,old_expression,''))) / length(old_expression) <> 1
   or position('repository_worker_digest_allowed' in source)>0 then
   raise exception 'HQ_REPOSITORY_WORKER_COMPATIBILITY_SOURCE_MISMATCH';
  end if;
  changed:=replace(source,old_expression,new_expression);
  execute changed;
 end loop;
end $$;

-- The existing wrapper authenticates/enables the worker before reaching this
-- return. Add only a bounded non-sensitive capability; keep its API signature,
-- owner, privileges and all previous response fields unchanged.
do $$
declare source text; old_expression text:='return result||jsonb_build_object(''repositoryApi'',hq_private.repository_api_proof(p_worker_id)->''api'');';
 new_expression text:='return result||jsonb_build_object(''repositoryApi'',hq_private.repository_api_proof(p_worker_id)->''api'',''repositoryWorkerCompatibility'',hq_private.repository_worker_compatibility());';
begin
 source:=pg_get_functiondef('hq_private.worker_release_status(uuid)'::regprocedure);
 if (length(source)-length(replace(source,old_expression,''))) / length(old_expression) <> 1
  or position('repositoryWorkerCompatibility' in source)>0 then
  raise exception 'HQ_REPOSITORY_WORKER_COMPATIBILITY_STATUS_MISMATCH';
 end if;
 execute replace(source,old_expression,new_expression);
end $$;

commit;
