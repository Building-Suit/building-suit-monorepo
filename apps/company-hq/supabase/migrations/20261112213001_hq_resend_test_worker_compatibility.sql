-- Exact source admission only. No email test approval or credentials created.
begin;
do $pair$
begin
 if hq_private.repository_worker_pairs_v2() is distinct from jsonb_build_array(
 jsonb_build_object('workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40','moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
 jsonb_build_object('workerSourceDigest','d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9','moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976')) then
 raise exception 'HQ_EMAIL_PAIR_PREDECESSOR_MISMATCH' using errcode='55000'; end if;
end $pair$;
create or replace function hq_private.repository_worker_pairs_v2() returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_array(
 jsonb_build_object('workerSourceDigest','7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40','moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
 jsonb_build_object('workerSourceDigest','d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9','moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'),
 jsonb_build_object('workerSourceDigest','a49e872084b0a1373fa0f70f7b0e122f58aa32e88af25695cfcff56a960d5c14','moduleSha256','bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'))
$$;
alter function hq_private.worker_release_status(uuid) rename to worker_release_status_before_email_test;
create function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select hq_private.worker_release_status_before_email_test(p_worker_id)||jsonb_build_object('emailConnectionTests',1)
$$;
revoke all on function hq_private.worker_release_status_before_email_test(uuid),hq_private.worker_release_status(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_release_status(uuid) to authenticated;
commit;
