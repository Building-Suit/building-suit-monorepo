-- Source-only compatibility preparation for the reviewed diagnostic worker.
-- Keep the existing singleton pin and historical proofs unchanged. This permits
-- exactly two source versions, not arbitrary future workers or different modules.
begin;

create function hq_private.repository_worker_digest_allowed(p_digest text) returns boolean
language sql immutable security invoker set search_path='' as $$
 select coalesce(p_digest in (
  'bb6c941f2398b4067d963e9c0de21c53738fa0729f9bb96ee64c89fb7159dd88',
  '5331fdf1b01e935432e2408f81a53b9da7cb4fe66b56dfe9553d36e90b5e9747'
 ),false)
$$;
revoke all on function hq_private.repository_worker_digest_allowed(text) from public,anon,authenticated,service_role;

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

commit;
