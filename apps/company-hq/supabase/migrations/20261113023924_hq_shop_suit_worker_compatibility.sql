-- Keep both earlier signed worker pairs usable for rollback. Allow only the
-- reviewed worker and workflow module that add the Shop Suit connector.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

do $guard$
begin
 if hq_private.repository_worker_pairs_v2() is distinct from jsonb_build_array(
  jsonb_build_object('workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
   'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
  jsonb_build_object('workerSourceDigest','d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',
   'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976')) then
  raise exception 'HQ_SHOP_CONNECTOR_PAIR_PREDECESSOR_MISMATCH' using errcode='55000';
 end if;
end $guard$;

create or replace function hq_private.repository_worker_pairs_v2() returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_array(
  jsonb_build_object('workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
   'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
  jsonb_build_object('workerSourceDigest','d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',
   'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
  jsonb_build_object('workerSourceDigest','ba4a8a2323f088dbadec551710896247dddec6e4863ac1a49eff8711a74ba572',
   'moduleSha256','ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58'))
$$;

-- These predicates depend on a rollout-updated allowlist. Keep cached plans
-- on existing Data API connections from folding an older pair list.
alter function hq_private.repository_worker_pair_allowed_v2(text,text) stable;
alter function hq_private.repository_worker_compatibility_v2() stable;

-- These checks already authenticate the exact worker/module pair. Drop only
-- the duplicate V1 module restrictions that would reject every new pair.
-- Qualification issuance intentionally retains its separate V1 gate.
do $reviewed$
declare
  v_check record;
  v_source text;
begin
  for v_check in select * from (values
    ('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)',
      '639bba08850135b660c86ad9e4fd778f',
      $clause$ or policy->>'moduleSha256' is distinct from hq_private.repository_module_digest()$clause$),
    ('hq_private.repository_source_valid(uuid,uuid)',
      '868852521d025b44af2d3a045ab32315',
      $clause$and x.proof->'publicRepositoryPolicy'->>'moduleSha256'=hq_private.repository_module_digest()$clause$),
    ('hq_private.repository_review_ready(uuid)',
      '02ccbc82f83447790ba98716d9184ce4',
      $clause$and execution.proof->'publicRepositoryPolicy'->>'moduleSha256'=hq_private.repository_module_digest()$clause$)
  ) reviewed(signature, source_md5, old_clause) loop
    if (select md5(prosrc) from pg_catalog.pg_proc where oid = to_regprocedure(v_check.signature))
        is distinct from v_check.source_md5 then
      raise exception 'HQ_SHOP_CONNECTOR_SOURCE_PREDECESSOR_MISMATCH:%', v_check.signature using errcode = '55000';
    end if;
    v_source := pg_get_functiondef(v_check.signature::regprocedure);
    if (length(v_source) - length(replace(v_source, v_check.old_clause, ''))) / length(v_check.old_clause) <> 1 then
      raise exception 'HQ_SHOP_CONNECTOR_SOURCE_PREDECESSOR_MISMATCH:%', v_check.signature using errcode = '55000';
    end if;
    execute replace(v_source, v_check.old_clause, '');
  end loop;
end
$reviewed$;

commit;
