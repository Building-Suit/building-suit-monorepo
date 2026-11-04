-- REVIEW ONLY. Outside automatic migrations. No remote execution is authorized.
-- Creates only company_hq objects; no public/Auth/Super Admin changes or data import.
-- All application roles remain denied. PostgREST exposure and Realtime stay untouched.
begin;

do $guard$
begin
  if exists(select 1 from pg_catalog.pg_namespace where nspname='company_hq') then
    if pg_catalog.to_regclass('company_hq.installation') is null then
      raise exception 'HQ_SCHEMA_OWNERSHIP_UNVERIFIED';
    end if;
    if not exists(select 1 from company_hq.installation where id=1 and marker='company-hq-isolated-v1') then
      raise exception 'HQ_SCHEMA_OWNERSHIP_UNVERIFIED';
    end if;
  end if;
end;
$guard$;

create schema if not exists company_hq;
revoke all on schema company_hq from public,anon,authenticated,service_role;
alter default privileges in schema company_hq revoke all on tables from public,anon,authenticated,service_role;
alter default privileges in schema company_hq revoke all on sequences from public,anon,authenticated,service_role;
alter default privileges in schema company_hq revoke all on functions from public,anon,authenticated,service_role;

create table if not exists company_hq.installation (
  id smallint primary key check(id=1),
  marker text not null check(marker='company-hq-isolated-v1')
);
insert into company_hq.installation(id,marker) values(1,'company-hq-isolated-v1') on conflict(id) do nothing;

create or replace function company_hq.hq_validate_document(p_document jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $function$
begin
  if p_document is null
    or pg_catalog.octet_length(pg_catalog.convert_to(p_document::text,'UTF8'))>8000000
    or pg_catalog.jsonb_typeof(p_document->'tasks') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'messages') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'events') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'receipts') is distinct from 'object'
  then raise exception 'HQ_INVALID_DOCUMENT'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_document->'tasks') t
    where pg_catalog.jsonb_typeof(t->'budget') is distinct from 'number'
      or (t->>'budget') is distinct from '0'
      or coalesce(t->>'owner','') not in ('ceo','hr')
      or coalesce(t->>'status','') not in ('proposed','queued','running','review','completed','blocked','failed','cancelled'))
  then raise exception 'HQ_INVALID_TASK'; end if;
  return true;
end;
$function$;

create table if not exists company_hq.hq_workspace (
  id smallint primary key check(id=1),
  document jsonb not null check(company_hq.hq_validate_document(document)),
  revision bigint not null default 0 check(revision>=0)
);
create table if not exists company_hq.hq_sessions (
  token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),
  expires_at bigint not null,
  revoked boolean not null default false
);
create index if not exists hq_sessions_expiry on company_hq.hq_sessions(expires_at);
create table if not exists company_hq.hq_login_limits (
  address_hash text primary key check(address_hash ~ '^[a-f0-9]{64}$'),
  attempts integer not null check(attempts>=0),
  window_end bigint not null
);
alter table company_hq.installation enable row level security;
alter table company_hq.hq_workspace enable row level security;
alter table company_hq.hq_sessions enable row level security;
alter table company_hq.hq_login_limits enable row level security;

-- Explicit owner-reviewed import only; no implicit historical/empty seed or overwrite.
create or replace function company_hq.hq_initialize_workspace(p_document jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare changed integer;
begin
  perform company_hq.hq_validate_document(p_document);
  insert into company_hq.hq_workspace(id,document) values(1,p_document) on conflict(id) do nothing;
  get diagnostics changed = row_count;
  return changed=1;
end;
$function$;
create or replace function company_hq.hq_read_workspace() returns jsonb
language sql security invoker set search_path = '' as $function$
  select pg_catalog.jsonb_build_object('document',document,'revision',revision) from company_hq.hq_workspace where id=1;
$function$;
create or replace function company_hq.hq_commit_workspace(p_revision bigint,p_document jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare changed integer;
begin
  perform company_hq.hq_validate_document(p_document);
  update company_hq.hq_workspace set document=p_document,revision=revision+1 where id=1 and revision=p_revision;
  get diagnostics changed = row_count;
  return changed=1;
end;
$function$;
create or replace function company_hq.hq_save_session(p_hash text,p_expiry bigint) returns void
language sql security invoker set search_path = '' as $function$
  insert into company_hq.hq_sessions(token_hash,expires_at) values(p_hash,p_expiry);
$function$;
create or replace function company_hq.hq_session_valid(p_hash text,p_now bigint) returns boolean
language sql security invoker set search_path = '' as $function$
  select exists(select 1 from company_hq.hq_sessions where token_hash=p_hash and expires_at>p_now and not revoked);
$function$;
create or replace function company_hq.hq_revoke_session(p_hash text) returns void
language sql security invoker set search_path = '' as $function$
  update company_hq.hq_sessions set revoked=true where token_hash=p_hash;
$function$;
create or replace function company_hq.hq_consume_login_attempt(p_hash text,p_now bigint) returns boolean
language plpgsql security invoker set search_path = '' as $function$
declare count_attempts integer;
begin
  insert into company_hq.hq_login_limits(address_hash,attempts,window_end) values(p_hash,1,p_now+900000)
    on conflict(address_hash) do update set
      attempts=case when company_hq.hq_login_limits.window_end<=p_now then 1 else company_hq.hq_login_limits.attempts+1 end,
      window_end=case when company_hq.hq_login_limits.window_end<=p_now then p_now+900000 else company_hq.hq_login_limits.window_end end
    returning attempts into count_attempts;
  return count_attempts<=8;
end;
$function$;

-- Disabled by design, including service_role. Separate reviewed activation is required.
revoke all on all tables in schema company_hq from public,anon,authenticated,service_role;
revoke all on all sequences in schema company_hq from public,anon,authenticated,service_role;
revoke all on all functions in schema company_hq from public,anon,authenticated,service_role;
commit;
