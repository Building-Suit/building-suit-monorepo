-- The worker is bounded to 120 seconds. Keep the asynchronous transport alive
-- long enough to record its result, rather than timing out a healthy root scan
-- after ten seconds. This changes no token, authority, endpoint or cron cadence.
create or replace function hq_private.invoke_brain_sync() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_endpoint text; v_token text; v_request_id bigint;
begin
  select c.endpoint,s.decrypted_secret into v_endpoint,v_token
  from hq_private.brain_worker_configuration c join vault.decrypted_secrets s on s.id=c.vault_secret_id
  where c.singleton;
  if v_endpoint is null or v_token is null then raise exception 'HQ_BRAIN_SCHEDULER_NOT_CONFIGURED'; end if;
  select net.http_post(url:=v_endpoint,
    headers:=pg_catalog.jsonb_build_object('Content-Type','application/json','X-HQ-Brain-Sync-Token',v_token),
    body:='{}'::jsonb,timeout_milliseconds:=130000) into v_request_id;
  return v_request_id;
end;
$$;
