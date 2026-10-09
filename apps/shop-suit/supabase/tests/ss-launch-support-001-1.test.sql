begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

select ok(not has_function_privilege('anon', 'public.claim_support_notification()', 'execute'), 'anonymous cannot drain outbox');
select ok(not has_function_privilege('authenticated', 'public.prepare_support_notification(uuid,uuid,jsonb)', 'execute'), 'authenticated cannot prepare delivery');
select ok(not has_function_privilege('authenticated', 'public.finish_support_notification(uuid,uuid,text,text,text)', 'execute'), 'authenticated cannot change status');
select ok(not has_table_privilege('service_role', 'public.support_requests', 'select'), 'service sender has only narrow RPC access');

-- Isolate synthetic fixtures without deleting or rewriting stored support requests.
update public.support_notification_outbox set next_attempt_at = now() + interval '1 day';
set local role anon;
select ok((public.submit_support_request('technical', 'Support delivery test', 'Immutable body', 'ss-launch-support@example.test', true, '') ->> 'accepted')::boolean, 'intake accepted before sender runs');
reset role;
select is((select count(*)::integer from public.support_notification_outbox o join public.support_requests r on r.id = o.request_id where r.requester_email = 'ss-launch-support@example.test'), 1, 'one atomic outbox per accepted request');

create temporary table support_claim (data jsonb);
insert into support_claim select public.claim_support_notification();
select is((select delivery_status from public.support_notification_outbox where id = (select (data ->> 'id')::uuid from support_claim)), 'sending', 'claim enters sending');
select is(public.claim_support_notification(), null::jsonb, 'live lease excludes competing worker');
select throws_ok($$select public.prepare_support_notification((select (data ->> 'id')::uuid from support_claim), gen_random_uuid(), '{}'::jsonb)$$, '42501', 'SUPPORT_LEASE_INVALID', 'wrong fencing token cannot prepare');

select lives_ok($$select public.prepare_support_notification((select (data ->> 'id')::uuid from support_claim), (select (data ->> 'lease_token')::uuid from support_claim), '{"from":"shop@building-suit.com","to":["support@building-suit.com"],"reply_to":"ss-launch-support@example.test","subject":"Support","text":"Immutable body"}'::jsonb)$$, 'payload persisted before send');
select ok(public.finish_support_notification((select (data ->> 'id')::uuid from support_claim), (select (data ->> 'lease_token')::uuid from support_claim), 'failed', null, 'provider_result_uncertain'), 'temporary failure recorded');
select ok((select failed_at is not null and delivered_at is null and next_attempt_at > now() from public.support_notification_outbox where id = (select (data ->> 'id')::uuid from support_claim)), 'failure has timestamp and backoff, not delivery');

-- Make only the synthetic row due and recover it with a new fenced lease.
update public.support_notification_outbox set next_attempt_at = now() - interval '1 minute' where id = (select (data ->> 'id')::uuid from support_claim);
update support_claim set data = public.claim_support_notification();
select is(public.prepare_support_notification((select (data ->> 'id')::uuid from support_claim), (select (data ->> 'lease_token')::uuid from support_claim), '{"to":["support@building-suit.com"],"reply_to":"ss-launch-support@example.test","text":"CHANGED"}'::jsonb) ->> 'text', 'Immutable body', 'retry freezes original payload');
select ok(public.finish_support_notification((select (data ->> 'id')::uuid from support_claim), (select (data ->> 'lease_token')::uuid from support_claim), 'sent', 'synthetic-resend-id', null), 'provider acceptance recorded');

update public.support_notification_outbox set next_attempt_at = now() - interval '1 minute' where id = (select (data ->> 'id')::uuid from support_claim);
update support_claim set data = public.claim_support_notification();
select is((select data ->> 'provider_email_id' from support_claim), 'synthetic-resend-id', 'sent retry is polling, never another send');
select ok(public.finish_support_notification((select (data ->> 'id')::uuid from support_claim), (select (data ->> 'lease_token')::uuid from support_claim), 'delivered', 'synthetic-resend-id', null), 'delivery completion succeeds');
select ok((select sent_at is not null and delivered_at is not null from public.support_notification_outbox where id = (select (data ->> 'id')::uuid from support_claim)), 'confirmed delivery timestamps recorded');

-- Additional invariant checks fail the executable even independently of pgTAP.
do $$
declare v_id uuid; v_old_token uuid; v_claim jsonb;
begin
  if public.claim_support_notification() is not null then raise exception 'delivered email was reclaimable'; end if;
  begin
    insert into public.support_notification_outbox (request_id, recipient, kind)
    select id, 'support@building-suit.com', 'new_request' from public.support_requests where requester_email = 'ss-launch-support@example.test';
    raise exception 'duplicate new-request outbox accepted';
  exception when unique_violation then null; end;
  begin
    update public.support_requests set customer_message = 'Changed' where requester_email = 'ss-launch-support@example.test';
    raise exception 'support content was mutable';
  exception when insufficient_privilege then null; end;
  begin
    perform public.submit_support_request('technical', 'Repeated', 'Body', 'ss-launch-support@example.test', true, '');
    raise exception 'rate limiting was lost';
  exception when sqlstate 'P0001' then if sqlerrm <> 'SUPPORT_RATE_LIMITED' then raise; end if; end;
  begin
    perform public.submit_support_request('general', 'No consent', 'Body', 'ss-no-consent@example.test', false, '');
    raise exception 'consent was not enforced';
  exception when sqlstate '22023' then null; end;
  perform public.submit_support_request('general', 'Bot', 'Body', 'ss-bot@example.test', true, 'bot');
  if exists (select 1 from public.support_requests where requester_email = 'ss-bot@example.test') then raise exception 'honeypot persisted'; end if;

  perform public.submit_support_request('general', 'Expiry', 'Body', 'ss-expiry@example.test', true, '');
  v_claim := public.claim_support_notification();
  v_id := (v_claim ->> 'id')::uuid; v_old_token := (v_claim ->> 'lease_token')::uuid;
  update public.support_notification_outbox set lease_until = now() - interval '1 minute', next_attempt_at = now() - interval '1 minute' where id = v_id;
  v_claim := public.claim_support_notification();
  if (v_claim ->> 'lease_token')::uuid = v_old_token then raise exception 'lease was not fenced'; end if;
  if public.finish_support_notification(v_id, v_old_token, 'failed', null, 'stale') then raise exception 'stale completion accepted'; end if;
  update public.support_notification_outbox set lease_until = now() - interval '1 minute', first_attempt_at = now() - interval '23 hours', next_attempt_at = now() - interval '1 minute' where id = v_id;
  if public.claim_support_notification() is not null then raise exception 'expired idempotency window was retried'; end if;
  if (select delivery_status from public.support_notification_outbox where id = v_id) <> 'review_required' then raise exception 'expired send must need reconciliation'; end if;
  if not exists (select 1 from public.support_requests where requester_email = 'ss-expiry@example.test') then raise exception 'failure lost accepted request'; end if;
  perform public.submit_support_request('general', 'Attempt cap', 'Body', 'ss-cap@example.test', true, '');
  v_claim := public.claim_support_notification();
  v_id := (v_claim ->> 'id')::uuid;
  update public.support_notification_outbox set attempts = 12, lease_until = now() - interval '1 minute' where id = v_id;
  if public.claim_support_notification() is not null then raise exception 'attempt cap did not stop retries'; end if;
  if (select delivery_status from public.support_notification_outbox where id = v_id) <> 'review_required' then raise exception 'attempt cap did not flag review'; end if;
end;
$$;
select * from finish();
rollback;
