-- Part 2: opt-in two-job host, still one active job per employee.
-- Old claim RPCs remain serial. No new host, qualification, or tool authority.
-- Rollback: drain all working jobs first, stop the parallel host, restore the
-- predecessor claim body/index and use the serial host. Never delete receipts.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

-- Transaction-scoped capability follows the existing repository claim pattern;
-- unlike a custom GUC it cannot be supplied by an untrusted session.
create table hq_private.parallel_claim_requests (
 transaction_id bigint primary key,
 worker_id uuid not null references hq_private.agent_workers(worker_id)
);
alter table hq_private.parallel_claim_requests enable row level security;
revoke all on hq_private.parallel_claim_requests from public,anon,authenticated,service_role;

-- Preserve all qualification/evidence/admission wrappers and their exact jobs.
do $patch$
declare source text:=pg_get_functiondef('hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure);
 old_guard text:='if v_wake is not null then return jsonb_build_object(''job'',null,''next_wake_at'',v_wake); end if;';
 old_select text:='select * into v_job from public.hq_agent_jobs x where x.status=''queued''';
begin
 if (length(source)-length(replace(source,old_guard,'')))/length(old_guard)<>1
 or (length(source)-length(replace(source,old_select,'')))/length(old_select)<>1 then
  raise exception 'HQ_PARALLEL_CLAIM_PREDECESSOR_MISMATCH' using errcode='55000';
 end if;
 source:=replace(source,old_guard,$replacement$if (select count(*) from public.hq_agent_jobs where status='working') >=
    (case when exists(select 1 from hq_private.parallel_claim_requests permit
      where permit.transaction_id=txid_current() and permit.worker_id=p_worker_id) then 2 else 1 end)
    then return jsonb_build_object('job',null,'next_wake_at',v_wake); end if;$replacement$);
 source:=replace(source,old_select,$replacement$select * into v_job from public.hq_agent_jobs x where x.status='queued'
    and not exists(select 1 from public.hq_agent_jobs busy where busy.agent_id=x.agent_id and busy.status='working')$replacement$);
 execute source;
end $patch$;
-- Keep hq_agent_single_active_agent as the database-level last line of defense.
drop index public.hq_agent_single_active_worker;

create function hq_private.worker_parallel_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then
  raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 if hq_private.agent_worker_uid(p_worker_id) is null then
  raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 insert into hq_private.parallel_claim_requests values(txid_current(),p_worker_id);
 result:=hq_private.worker_repository_claim(p_worker_id,p_lease_seconds,p_meeting_protocol);
 delete from hq_private.parallel_claim_requests where transaction_id=txid_current();
 return result;
end $$;
create function public.hq_worker_parallel_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language sql security invoker set search_path='' as $$select hq_private.worker_parallel_claim(p_worker_id,p_lease_seconds,p_meeting_protocol)$$;
revoke all on function hq_private.worker_parallel_claim(uuid,integer,integer),public.hq_worker_parallel_claim(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_parallel_claim(uuid,integer,integer),public.hq_worker_parallel_claim(uuid,integer,integer) to authenticated;

-- Admit only this reviewed source/module pair; keep all earlier evidence valid.
do $pair$
begin
 if hq_private.repository_worker_pairs_v2() is distinct from jsonb_build_array(jsonb_build_object(
 'workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
 'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976')) then
  raise exception 'HQ_PARALLEL_PAIR_PREDECESSOR_MISMATCH' using errcode='55000'; end if;
end $pair$;
create or replace function hq_private.repository_worker_pairs_v2() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_array(
 jsonb_build_object('workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',
 'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
 jsonb_build_object('workerSourceDigest','d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',
 'moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'))
$$;

alter function hq_private.worker_release_status(uuid) rename to worker_release_status_before_parallel;
create function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select hq_private.worker_release_status_before_parallel(p_worker_id)||jsonb_build_object('parallelClaims',1,'parallelCapacity',2)
$$;
revoke all on function hq_private.worker_release_status_before_parallel(uuid),hq_private.worker_release_status(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_release_status(uuid) to authenticated;
commit;
