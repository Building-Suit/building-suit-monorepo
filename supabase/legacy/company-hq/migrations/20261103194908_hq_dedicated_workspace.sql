-- HQ-only objects. Never resets, rewrites or grants access to another product's tables/Auth.
create table public.hq_workspace (
  id smallint primary key check (id = 1),
  document jsonb not null,
  revision bigint not null default 0 check(revision >= 0)
);
create table public.hq_sessions (token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'), expires_at bigint not null);
create index hq_sessions_expiry on public.hq_sessions(expires_at);
create table public.hq_login_limits (address_hash text primary key check(address_hash ~ '^[a-f0-9]{64}$'), attempts integer not null, window_end bigint not null);
alter table public.hq_workspace enable row level security;
alter table public.hq_sessions enable row level security;
alter table public.hq_login_limits enable row level security;
revoke all on public.hq_workspace,public.hq_sessions,public.hq_login_limits from public,anon,authenticated;
grant select,insert,update,delete on public.hq_workspace,public.hq_sessions,public.hq_login_limits to service_role;

create function public.hq_read_workspace() returns jsonb language sql security invoker set search_path = '' as $$
  select pg_catalog.jsonb_build_object('document',document,'revision',revision) from public.hq_workspace where id=1;
$$;
create function public.hq_commit_workspace(p_revision bigint,p_document jsonb) returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if pg_catalog.length(p_document::text)>8000000
    or pg_catalog.jsonb_typeof(p_document->'tasks') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'messages') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'events') is distinct from 'array'
    or pg_catalog.jsonb_typeof(p_document->'receipts') is distinct from 'object'
  then raise exception 'HQ_INVALID_DOCUMENT'; end if;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_document->'tasks') t
    where (t->>'budget') is distinct from '0' or coalesce(t->>'owner','') not in ('ceo','hr')
      or coalesce(t->>'status','') not in ('proposed','queued','running','review','completed','blocked','failed','cancelled'))
  then raise exception 'HQ_INVALID_TASK'; end if;
  update public.hq_workspace set document=p_document,revision=revision+1 where id=1 and revision=p_revision;
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
create function public.hq_save_session(p_hash text,p_expiry bigint) returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.hq_sessions where expires_at <= (extract(epoch from pg_catalog.clock_timestamp())*1000)::bigint;
  insert into public.hq_sessions(token_hash,expires_at) values(p_hash,p_expiry);
end;
$$;
create function public.hq_session_valid(p_hash text,p_now bigint) returns boolean language sql security invoker set search_path = '' as $$
  select exists(select 1 from public.hq_sessions where token_hash=p_hash and expires_at>p_now);
$$;
create function public.hq_revoke_session(p_hash text) returns void language sql security invoker set search_path = '' as $$
  delete from public.hq_sessions where token_hash=p_hash;
$$;
create function public.hq_consume_login_attempt(p_hash text,p_now bigint) returns boolean language plpgsql security invoker set search_path = '' as $$
declare count_attempts integer;
begin
  delete from public.hq_login_limits where window_end<=p_now;
  insert into public.hq_login_limits(address_hash,attempts,window_end) values(p_hash,1,p_now+900000)
    on conflict(address_hash) do update set attempts=public.hq_login_limits.attempts+1
    returning attempts into count_attempts;
  return count_attempts<=8;
end;
$$;
revoke all on function public.hq_read_workspace(),public.hq_commit_workspace(bigint,jsonb),public.hq_save_session(text,bigint),public.hq_session_valid(text,bigint),public.hq_revoke_session(text),public.hq_consume_login_attempt(text,bigint) from public,anon,authenticated;
grant execute on function public.hq_read_workspace(),public.hq_commit_workspace(bigint,jsonb),public.hq_save_session(text,bigint),public.hq_session_valid(text,bigint),public.hq_revoke_session(text),public.hq_consume_login_attempt(text,bigint) to service_role;

insert into public.hq_workspace(id,document) values(1,$hq_seed${"tasks":[{"id":"HR-001","title":"Company HQ staffing assessment","brief":"Assess the smallest team and skills needed for Company HQ.","owner":"hr","status":"completed","acceptance":"Bounded research and independent artifact review.","allowedActions":"Review scoped company records; research public sources; prepare a staffing report.","budget":0,"deliverable":"Recommended a temporary HQ builder and separate reviewer; no new employee was hired.","reviewEvidence":"Independent review accepted criteria 1–5. Full execution-history audit was not available.","approvedAt":"2026-11-03","approvalSource":"Founder approved the supervised first HR assignment.","createdAt":"2026-11-03","updatedAt":"2026-11-03"}],"messages":[],"events":[{"id":"historic-hr-001-reviewed","agent":"hr","type":"review","title":"First HR assignment reviewed","detail":"The actual staffing report received independent review. No new employee was hired.","createdAt":"2026-11-03","taskId":"HR-001"}],"receipts":{},"lastAgentSeen":null}$hq_seed$::jsonb);
