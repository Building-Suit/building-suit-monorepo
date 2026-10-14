-- SS-LAUNCH-SUPPORT-001. Intake remains atomic and browser roles retain no outbox access.
alter table public.support_notification_outbox
  drop constraint support_notification_outbox_delivery_status_check,
  add constraint support_notification_outbox_delivery_status_check check (
    delivery_status in ('not_configured', 'queued', 'sending', 'sent', 'failed', 'delivered', 'bounced', 'review_required')
  ),
  add column attempts integer not null default 0,
  add column first_attempt_at timestamptz,
  add column last_attempt_at timestamptz,
  add column next_attempt_at timestamptz not null default now(),
  add column lease_token uuid,
  add column lease_until timestamptz,
  add column sent_at timestamptz,
  add column failed_at timestamptz,
  add column provider_email_id text,
  add column last_error text,
  add column email_payload jsonb;
create unique index support_notification_provider_id_idx
  on public.support_notification_outbox (provider_email_id) where provider_email_id is not null;
create index support_notification_due_idx on public.support_notification_outbox (next_attempt_at, created_at);

-- An already-sent legacy row without a provider receipt must never be resent.
update public.support_notification_outbox set delivery_status = 'review_required',
  last_error = 'legacy_receipt_missing'
where delivery_status = 'sent' and provider_email_id is null;

-- The sender drains one committed row at a time. SKIP LOCKED and fencing tokens
-- isolate concurrent workers. Uncertain sends stop before Resend's 24h key expiry.
create function public.claim_support_notification()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.support_notification_outbox; v_request public.support_requests;
begin
  update public.support_notification_outbox
  set delivery_status = 'review_required', last_error = 'retry_window_exhausted',
      failed_at = clock_timestamp(), lease_token = null, lease_until = null
  where provider_email_id is null and delivery_status in ('sending', 'failed')
    and (lease_until is null or lease_until < clock_timestamp())
    and (first_attempt_at <= clock_timestamp() - interval '23 hours' or attempts >= 12);

  select * into v_row from public.support_notification_outbox
  where kind = 'new_request'
    and delivery_status in ('not_configured', 'queued', 'sending', 'failed', 'sent')
    and next_attempt_at <= clock_timestamp()
    and (lease_until is null or lease_until < clock_timestamp())
    and (provider_email_id is not null or first_attempt_at is null
      or first_attempt_at > clock_timestamp() - interval '23 hours')
  order by next_attempt_at, created_at, id for update skip locked limit 1;
  if v_row.id is null then return null; end if;

  update public.support_notification_outbox
  set lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '2 minutes',
      delivery_status = case when provider_email_id is null then 'sending' else 'sent' end,
      attempts = attempts + case when provider_email_id is null then 1 else 0 end,
      first_attempt_at = case when provider_email_id is null then coalesce(first_attempt_at, clock_timestamp()) else first_attempt_at end,
      last_attempt_at = clock_timestamp()
  where id = v_row.id returning * into v_row;
  select * into v_request from public.support_requests where id = v_row.request_id;
  return jsonb_build_object('id', v_row.id, 'lease_token', v_row.lease_token,
    'provider_email_id', v_row.provider_email_id, 'email_payload', v_row.email_payload,
    'request_id', v_row.request_id, 'requester_email', v_request.requester_email,
    'category', v_request.category, 'subject', v_request.subject,
    'customer_message', v_request.customer_message, 'priority', v_request.priority);
end;
$$;

-- Persist the exact provider payload before any HTTP send. Retries reuse it even
-- after a deployment or sender configuration change.
create function public.prepare_support_notification(p_id uuid, p_lease_token uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  update public.support_notification_outbox o
  set email_payload = coalesce(o.email_payload, p_payload)
  from public.support_requests r
  where o.id = p_id and o.request_id = r.id and o.lease_token = p_lease_token
    and o.lease_until > clock_timestamp() and o.delivery_status = 'sending'
    and o.first_attempt_at > clock_timestamp() - interval '23 hours'
    and p_payload -> 'to' = '["support@building-suit.com"]'::jsonb
    and p_payload ->> 'reply_to' = r.requester_email
  returning o.email_payload into v_payload;
  if v_payload is null then raise exception 'SUPPORT_LEASE_INVALID' using errcode = '42501'; end if;
  return v_payload;
end;
$$;

create function public.finish_support_notification(
  p_id uuid, p_lease_token uuid, p_status text, p_provider_email_id text default null, p_error text default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.support_notification_outbox;
begin
  select * into v_row from public.support_notification_outbox
  where id = p_id and lease_token = p_lease_token and lease_until > clock_timestamp()
  for update;
  if v_row.id is null then return false; end if;
  if p_status not in ('sent', 'failed', 'delivered', 'bounced', 'review_required') or p_status is null
    or (p_status in ('sent', 'delivered', 'bounced') and coalesce(v_row.provider_email_id, nullif(p_provider_email_id, '')) is null)
    or (v_row.provider_email_id is not null and p_status in ('failed', 'review_required'))
    or (v_row.provider_email_id is null and p_status in ('delivered', 'bounced'))
    or (v_row.provider_email_id is not null and p_provider_email_id is distinct from v_row.provider_email_id)
    or (p_status = 'sent' and v_row.email_payload is null)
  then raise exception 'SUPPORT_TRANSITION_INVALID' using errcode = '22023'; end if;
  update public.support_notification_outbox
  set delivery_status = p_status,
    provider_email_id = coalesce(provider_email_id, nullif(p_provider_email_id, '')),
    sent_at = case when p_status in ('sent', 'delivered', 'bounced') then coalesce(sent_at, clock_timestamp()) else sent_at end,
    delivered_at = case when p_status = 'delivered' then clock_timestamp() else delivered_at end,
    failed_at = case when p_status in ('failed', 'bounced', 'review_required') then clock_timestamp() else failed_at end,
    last_error = case when p_error ~ '^[a-z0-9_]{1,64}$' then p_error else null end,
    next_attempt_at = clock_timestamp() + case when p_status = 'failed'
      then make_interval(secs => least(1800, 30 * power(2, least(attempts, 6)))::integer)
      else interval '5 minutes' end,
    lease_token = null, lease_until = null
  where id = p_id;
  return true;
end;
$$;

revoke all on function public.claim_support_notification() from public, anon, authenticated, service_role;
revoke all on function public.prepare_support_notification(uuid, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.finish_support_notification(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.claim_support_notification() to service_role;
grant execute on function public.prepare_support_notification(uuid, uuid, jsonb) to service_role;
grant execute on function public.finish_support_notification(uuid, uuid, text, text, text) to service_role;
