-- Explicit, single-message founder test. This is not a campaign or model tool grant.
begin;
create table public.hq_email_connection_tests (
 id uuid primary key default gen_random_uuid(), founder_user_id uuid not null,
 request_key uuid not null, agent_id text not null default 'AG-EMAIL-002' check(agent_id='AG-EMAIL-002'),
 manager_id text not null default 'AG-EMAIL-001' check(manager_id='AG-EMAIL-001'),
 sender text not null default 'Shop Suit Team <hello@shop.building-suit.com>' check(sender='Shop Suit Team <hello@shop.building-suit.com>'),
 recipient text not null check(length(recipient)<=254 and recipient ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'),
 subject text not null check(octet_length(subject) between 1 and 200 and subject !~ '[\r\n]'),
 body text not null check(octet_length(body) between 1 and 8000),
 digest text not null, state text not null default 'prepared' check(state in('prepared','approved','reserved','accepted','rejected','uncertain','revoked')),
 created_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
 approved_at timestamptz, reserved_at timestamptz, finished_at timestamptz,
 worker_id uuid references hq_private.agent_workers(worker_id), reservation uuid,
 provider_id text, unique(founder_user_id,request_key)
);
alter table public.hq_email_connection_tests enable row level security;
revoke all on public.hq_email_connection_tests from public,anon,authenticated,service_role;

create function hq_private.email_test_digest(p_to text,p_subject text,p_body text) returns text
language sql immutable set search_path='' as $$
 select encode(extensions.digest(
 octet_length('Shop Suit Team <hello@shop.building-suit.com>')::text||':Shop Suit Team <hello@shop.building-suit.com>'||octet_length(p_to)::text||':'||p_to||
 octet_length(p_subject)::text||':'||p_subject||octet_length(p_body)::text||':'||p_body,'sha256'),'hex')
$$;
-- Private projection deliberately never returns the reservation capability.
create function hq_private.email_test_view(t public.hq_email_connection_tests) returns jsonb
language sql stable set search_path='' as $$ select jsonb_build_object(
 'id',t.id,'agentId',t.agent_id,'managerId',t.manager_id,'sender',t.sender,'recipient',t.recipient,
 'subject',t.subject,'body',t.body,'digest',t.digest,'state',t.state,'expiresAt',t.expires_at,
 'providerAccepted',t.state='accepted','delivered',false,'providerId',t.provider_id)
$$;

create function hq_private.email_test_prepare(p_recipient text,p_subject text,p_body text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t public.hq_email_connection_tests; d text;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 if p_request_key is null or p_recipient is null or p_subject is null or p_body is null then raise exception 'HQ_EMAIL_INPUT_REQUIRED'; end if;
 if not exists(select 1 from hq_private.agent_roster a join hq_private.agent_roster m on m.id=a.manager_id
 where a.id='AG-EMAIL-002' and a.name='Dina' and a.enabled and m.id='AG-EMAIL-001' and m.enabled
 and a.department_key='email-lifecycle') then raise exception 'HQ_EMAIL_BINDING_REQUIRED'; end if;
 d:=hq_private.email_test_digest(p_recipient,p_subject,p_body);
 insert into public.hq_email_connection_tests(founder_user_id,request_key,recipient,subject,body,digest)
 values(uid,p_request_key,p_recipient,p_subject,p_body,d) on conflict(founder_user_id,request_key) do nothing;
 select * into t from public.hq_email_connection_tests where founder_user_id=uid and request_key=p_request_key;
 if t.digest<>d then raise exception 'HQ_EMAIL_REQUEST_CONFLICT'; end if;
 return hq_private.email_test_view(t);
end $$;

create function hq_private.email_test_decide(p_id uuid,p_digest text,p_approve boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t public.hq_email_connection_tests;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 select * into t from public.hq_email_connection_tests where id=p_id and founder_user_id=uid for update;
 if not found or t.digest is distinct from p_digest or p_approve is null then raise exception 'HQ_EMAIL_APPROVAL_MISMATCH'; end if;
 if hq_private.founder_uid() is distinct from uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 if t.state not in('prepared','approved') or t.expires_at<=clock_timestamp() then raise exception 'HQ_EMAIL_TEST_NOT_APPROVABLE'; end if;
 update public.hq_email_connection_tests set state=case when p_approve then 'approved' else 'revoked' end,
 approved_at=case when p_approve then clock_timestamp() else null end where id=p_id returning * into t;
 if p_approve then perform realtime.send('{}'::jsonb,'jobs','hq-agent-jobs',true); end if;
 return hq_private.email_test_view(t);
end $$;

create function hq_private.email_test_status(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); t public.hq_email_connection_tests;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 select * into t from public.hq_email_connection_tests where id=p_id and founder_user_id=uid;
 if not found then raise exception 'HQ_EMAIL_TEST_NOT_FOUND'; end if;
 return hq_private.email_test_view(t);
end $$;

create function hq_private.email_test_reserve(p_worker_id uuid,p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.hq_email_connection_tests;
begin
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 -- Same order as worker admission: queue first, then the test ledger.
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'HQ_ADMISSION_ISOLATION'; end if;
 perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
 if exists(select 1 from hq_private.worker_admission_pauses where worker_id=p_worker_id and paused) then
 raise exception 'HQ_ADMISSION_PAUSED'; end if;
 -- Serialize all test reservations; a retry/crash never obtains a second send capability.
 perform pg_advisory_xact_lock(hashtextextended('hq-email-connection-test',0));
 select * into t from public.hq_email_connection_tests where id=p_id for update;
 if not found or t.state<>'approved' or t.approved_at is null or t.expires_at<=clock_timestamp() then raise exception 'HQ_EMAIL_TEST_NOT_AUTHORIZED'; end if;
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 if not exists(select 1 from public.hq_founders f join hq_private.founder_invitations i on i.id=f.invitation_id
 join auth.users u on u.id=f.user_id where f.user_id=t.founder_user_id and f.revoked_at is null and i.revoked_at is null
 and i.bound_user_id=f.user_id and lower(btrim(u.email))=i.email) then raise exception 'HQ_EMAIL_APPROVAL_REVOKED'; end if;
 if not exists(select 1 from hq_private.agent_roster a join hq_private.agent_roster m on m.id=a.manager_id
 where a.id=t.agent_id and a.name='Dina' and a.enabled and m.id=t.manager_id and m.enabled and a.department_key='email-lifecycle') then raise exception 'HQ_EMAIL_BINDING_REQUIRED'; end if;
 if (select count(*) from public.hq_email_connection_tests where reserved_at>clock_timestamp()-interval '24 hours')>=5
 or exists(select 1 from public.hq_email_connection_tests where state in('reserved','uncertain')) then raise exception 'HQ_EMAIL_TEST_BUDGET_OR_RECONCILIATION_REQUIRED'; end if;
 update public.hq_email_connection_tests set state='reserved',reserved_at=clock_timestamp(),worker_id=p_worker_id,reservation=gen_random_uuid()
 where id=p_id returning * into t;
 return hq_private.email_test_view(t)||jsonb_build_object('reservation',t.reservation,'idempotencyKey','hq-email-test/'||t.id::text);
end $$;

-- Existing Oracle drain consumes this authorization ledger; no second host/queue.
create function hq_private.email_test_next(p_worker_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare next_id uuid;
begin
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 if exists(select 1 from public.hq_email_connection_tests where state in('reserved','uncertain'))
 or (select count(*) from public.hq_email_connection_tests where reserved_at>clock_timestamp()-interval '24 hours')>=5 then return null; end if;
 select id into next_id from public.hq_email_connection_tests where state='approved' and expires_at>clock_timestamp()
 order by approved_at,id limit 1;
 return next_id;
end $$;

create function hq_private.email_test_finish(p_worker_id uuid,p_id uuid,p_reservation uuid,p_state text,p_provider_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.hq_email_connection_tests;
begin
 if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
 select * into t from public.hq_email_connection_tests where id=p_id for update;
 if not found or t.worker_id is distinct from p_worker_id or t.reservation is distinct from p_reservation or p_reservation is null
 or p_state not in('accepted','rejected','uncertain') or p_state is null
 or (p_state='accepted' and (p_provider_id is null or p_provider_id !~ '^[0-9a-f-]{36}$'))
 or (p_state<>'accepted' and p_provider_id is not null) then raise exception 'HQ_EMAIL_RECEIPT_INVALID'; end if;
 if t.state=p_state and t.provider_id is not distinct from p_provider_id then return hq_private.email_test_view(t); end if;
 if t.state<>'reserved' then raise exception 'HQ_EMAIL_RECEIPT_CONFLICT'; end if;
 update public.hq_email_connection_tests set state=p_state,provider_id=p_provider_id,finished_at=clock_timestamp() where id=p_id returning * into t;
 return hq_private.email_test_view(t);
end $$;

create function public.hq_email_test_prepare(p_recipient text,p_subject text,p_body text,p_request_key uuid) returns jsonb language sql security invoker set search_path='' as $$select hq_private.email_test_prepare(p_recipient,p_subject,p_body,p_request_key)$$;
create function public.hq_email_test_decide(p_id uuid,p_digest text,p_approve boolean) returns jsonb language sql security invoker set search_path='' as $$select hq_private.email_test_decide(p_id,p_digest,p_approve)$$;
create function public.hq_email_test_status(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select hq_private.email_test_status(p_id)$$;
create function public.hq_email_test_reserve(p_worker_id uuid,p_id uuid) returns jsonb language sql security invoker set search_path='' as $$select hq_private.email_test_reserve(p_worker_id,p_id)$$;
create function public.hq_email_test_next(p_worker_id uuid) returns uuid language sql security invoker set search_path='' as $$select hq_private.email_test_next(p_worker_id)$$;
create function public.hq_email_test_finish(p_worker_id uuid,p_id uuid,p_reservation uuid,p_state text,p_provider_id text) returns jsonb language sql security invoker set search_path='' as $$select hq_private.email_test_finish(p_worker_id,p_id,p_reservation,p_state,p_provider_id)$$;
-- No table, secret, generic execution, or model authority is granted.
revoke all on function hq_private.email_test_digest(text,text,text),hq_private.email_test_view(public.hq_email_connection_tests) from public,anon,authenticated,service_role;
do $$declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in('public','hq_private') and p.proname in('email_test_next','hq_email_test_next','email_test_prepare','email_test_decide','email_test_status','email_test_reserve','email_test_finish','hq_email_test_prepare','hq_email_test_decide','hq_email_test_status','hq_email_test_reserve','hq_email_test_finish') loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 execute format('grant execute on function %s to authenticated',f.signature);
 end loop;
end $$;
create table hq_private.email_test_host_readiness (
 worker_id uuid primary key references hq_private.agent_workers(worker_id),
 configured boolean not null, observed_at timestamptz not null default clock_timestamp()
);
alter table hq_private.email_test_host_readiness enable row level security;
revoke all on hq_private.email_test_host_readiness from public,anon,authenticated,service_role;
create function hq_private.email_test_readiness(p_worker_id uuid default null,p_configured boolean default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ready boolean:=false;
begin
 if p_worker_id is not null then
  if hq_private.agent_worker_uid(p_worker_id) is null or p_configured is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  insert into hq_private.email_test_host_readiness(worker_id,configured) values(p_worker_id,p_configured)
  on conflict(worker_id) do update set configured=excluded.configured,observed_at=clock_timestamp();
 elsif hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 select coalesce(bool_or(r.configured),false) into ready from hq_private.email_test_host_readiness r join hq_private.agent_workers w using(worker_id)
 where w.enabled and r.observed_at>clock_timestamp()-interval '15 minutes';
 return jsonb_build_object('agentId','AG-EMAIL-002','managerId','AG-EMAIL-001','domain','shop.building-suit.com',
 'sender','Shop Suit Team <hello@shop.building-suit.com>','configured',ready,
 'providerTested',exists(select 1 from public.hq_email_connection_tests where state='accepted'),
 'scope','founder-test-only','automaticSending',false,'credentialScopeVerified',false);
end $$;
create function public.hq_email_test_readiness(p_worker_id uuid default null,p_configured boolean default null) returns jsonb
language sql security invoker set search_path='' as $$select hq_private.email_test_readiness(p_worker_id,p_configured)$$;
revoke all on function hq_private.email_test_readiness(uuid,boolean),public.hq_email_test_readiness(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function hq_private.email_test_readiness(uuid,boolean),public.hq_email_test_readiness(uuid,boolean) to authenticated;
commit;
