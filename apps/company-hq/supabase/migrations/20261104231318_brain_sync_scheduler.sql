-- Cloud recovery is opt-in per verified environment. No production endpoint,
-- credential, cron job or local runtime is activated by applying this file.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table hq_private.brain_worker_configuration (
  singleton boolean primary key default true check (singleton),
  project_ref text not null check (project_ref = 'dpruoncalmwicrqhqelu'),
  endpoint text not null check (endpoint = 'https://dpruoncalmwicrqhqelu.supabase.co/functions/v1/brain-sync/run'),
  vault_secret_id uuid not null references vault.secrets(id),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  configured_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table hq_private.brain_worker_configuration enable row level security;
revoke all on hq_private.brain_worker_configuration from public,anon,authenticated,service_role;

create function hq_private.brain_authorize_worker(p_token_hash text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform hq_private.require_brain_service();
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return false; end if;
  return exists(select 1 from hq_private.brain_worker_configuration c where c.singleton and c.token_hash = p_token_hash);
end;
$$;
create function public.hq_brain_authorize_worker(p_token_hash text) returns boolean
language sql security invoker set search_path = '' as $$ select hq_private.brain_authorize_worker(p_token_hash); $$;
revoke all on function hq_private.brain_authorize_worker(text),public.hq_brain_authorize_worker(text) from public,anon,authenticated,service_role;
grant execute on function hq_private.brain_authorize_worker(text),public.hq_brain_authorize_worker(text) to service_role;

-- Only the database operator/cron owner can invoke this helper. The scoped
-- worker token is decrypted only into pg_net's private request queue, never
-- returned to a caller or stored in a cron command, migration or application.
create function hq_private.invoke_brain_sync() returns bigint
language plpgsql security definer set search_path = '' as $$
declare v_endpoint text; v_token text; v_request_id bigint;
begin
  select c.endpoint,s.decrypted_secret into v_endpoint,v_token
  from hq_private.brain_worker_configuration c join vault.decrypted_secrets s on s.id=c.vault_secret_id
  where c.singleton;
  if v_endpoint is null or v_token is null then raise exception 'HQ_BRAIN_SCHEDULER_NOT_CONFIGURED'; end if;
  select net.http_post(url:=v_endpoint,
    headers:=pg_catalog.jsonb_build_object('Content-Type','application/json','X-HQ-Brain-Sync-Token',v_token),
    body:='{}'::jsonb,timeout_milliseconds:=10000) into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function hq_private.invoke_brain_sync() from public,anon,authenticated,service_role;

-- Explicit operator setup after the staging worker and its dedicated Google
-- read-only secrets are installed. Repeating setup reuses the same Vault secret
-- and updates the named cron job; it never creates additional jobs or tokens.
create function hq_private.configure_brain_scheduler(p_project_ref text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_secret_id uuid; v_token text; v_hash text; v_job_id bigint;
begin
  if p_project_ref is distinct from 'dpruoncalmwicrqhqelu' then raise exception 'HQ_BRAIN_STAGING_ONLY'; end if;
  perform pg_catalog.pg_advisory_xact_lock(21128,3);
  select c.vault_secret_id,s.decrypted_secret into v_secret_id,v_token
    from hq_private.brain_worker_configuration c join vault.decrypted_secrets s on s.id=c.vault_secret_id where c.singleton;
  if v_secret_id is null then
    v_token := pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
    select vault.create_secret(v_token,'hq_brain_sync_worker_staging','HQ Drive bridge scoped invocation token') into v_secret_id;
  end if;
  v_hash := pg_catalog.encode(extensions.digest(v_token,'sha256'),'hex');
  insert into hq_private.brain_worker_configuration(singleton,project_ref,endpoint,vault_secret_id,token_hash)
    values(true,p_project_ref,'https://dpruoncalmwicrqhqelu.supabase.co/functions/v1/brain-sync/run',v_secret_id,v_hash)
    on conflict(singleton) do update set configured_at=pg_catalog.clock_timestamp();
  select cron.schedule('hq-brain-drive-recovery','* * * * *','select hq_private.invoke_brain_sync();') into v_job_id;
  return pg_catalog.jsonb_build_object('configured',true,'projectRef',p_project_ref,'schedule','* * * * *','jobId',v_job_id);
end;
$$;
revoke all on function hq_private.configure_brain_scheduler(text) from public,anon,authenticated,service_role;

-- pg_net can temporarily hold the raw scoped token. Data API roles have no
-- queue/response access; the token cannot authorize founder or project APIs.
revoke all on all tables in schema net from public,anon,authenticated,service_role;
