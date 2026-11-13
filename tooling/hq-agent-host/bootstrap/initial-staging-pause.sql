-- Owner-approved phase 1, staging dpruoncalmwicrqhqelu only. Not a credential.
-- Scope to the independently verified existing worker; never disable its auth.
do $initial_pause$
declare
  v_worker constant uuid:='3ead9a59-d84b-4e95-9871-abba0b129404';
  v_request constant uuid:='fe6d97b2-d55f-45c6-9306-581e942649c0';
begin
  if (select count(*) from hq_private.agent_workers)<>1
    or not exists(select 1 from hq_private.agent_workers where worker_id=v_worker and enabled) then
    raise exception 'HQ_BOOTSTRAP_WORKER_IDENTITY_MISMATCH';
  end if;
  perform hq_private.set_worker_admission_pause(v_worker,true,0,v_request,'owner-approved staging phase-1 admission pause');
end $initial_pause$;
