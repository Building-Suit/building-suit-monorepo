-- SS-HOT-PUBLIC-LEGAL-001: private public-contact submission boundary.
create table public.support_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references public.shops(id) on delete restrict,
  requester_profile_id uuid references public.profiles(id) on delete restrict,
  requester_email text not null check (requester_email = lower(btrim(requester_email)) and requester_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  category text not null check (category in ('general', 'product', 'billing', 'technical', 'account')),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  customer_message text not null check (length(btrim(customer_message)) between 1 and 10000),
  priority text not null default 'normal' check (priority in ('normal', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  created_at timestamptz not null default now()
);
create index support_requests_queue_idx on public.support_requests (status, priority, created_at, id);
create index support_requests_reply_rate_idx on public.support_requests (requester_email, created_at desc);
alter table public.support_requests enable row level security;
revoke all on public.support_requests from public, anon, authenticated, service_role;

create table public.support_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.support_requests(id) on delete restrict,
  recipient text not null check (recipient = 'support@building-suit.com'),
  kind text not null check (kind in ('new_request', 'reminder')),
  delivery_status text not null default 'not_configured' check (delivery_status in ('not_configured', 'queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (request_id, kind)
);
alter table public.support_notification_outbox enable row level security;
revoke all on public.support_notification_outbox from public, anon, authenticated, service_role;

create function shop_private.preserve_support_request_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'SUPPORT_REQUEST_CONTENT_IMMUTABLE' using errcode = '42501';
  end if;
  if new.shop_id is distinct from old.shop_id
    or new.requester_profile_id is distinct from old.requester_profile_id
    or new.requester_email is distinct from old.requester_email
    or new.category is distinct from old.category
    or new.subject is distinct from old.subject
    or new.customer_message is distinct from old.customer_message
    or new.priority is distinct from old.priority
    or new.created_at is distinct from old.created_at
  then
    raise exception 'SUPPORT_REQUEST_CONTENT_IMMUTABLE' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function shop_private.preserve_support_request_content() from public, anon, authenticated, service_role;
create trigger support_request_content_immutable
before update or delete on public.support_requests
for each row execute function shop_private.preserve_support_request_content();

create function public.submit_support_request(
  p_category text,
  p_subject text,
  p_message text,
  p_reply_email text,
  p_consent boolean,
  p_honeypot text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_id uuid;
  v_shop_id uuid;
  v_email text := lower(btrim(p_reply_email));
  v_request_id uuid;
begin
  if coalesce(nullif(btrim(p_honeypot), ''), '') <> '' then
    return jsonb_build_object('ok', true, 'accepted', false);
  end if;

  if not coalesce(p_consent, false)
    or p_category not in ('general', 'product', 'billing', 'technical', 'account')
    or p_subject is null or length(btrim(p_subject)) not between 1 and 200
    or p_message is null or length(btrim(p_message)) not between 1 and 10000
    or p_reply_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'SUPPORT_REQUEST_INVALID' using errcode = '22023';
  end if;

  if v_user_id is not null then
    select profile.id,
      lower(coalesce(nullif(btrim(profile.email_snapshot), ''), nullif(btrim(auth.jwt() ->> 'email'), '')))
    into v_profile_id, v_email
    from public.profiles profile
    where profile.user_id = v_user_id
    order by profile.created_at, profile.id
    limit 1;

    if v_profile_id is null then
      v_email := lower(nullif(btrim(auth.jwt() ->> 'email'), ''));
    else
      select membership.shop_id
      into v_shop_id
      from public.shop_memberships membership
      where membership.profile_id = v_profile_id
        and membership.status = 'active'::public.shop_membership_status
      order by membership.created_at, membership.id
      limit 1;
    end if;
  end if;

  if v_email is null or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'SUPPORT_REQUEST_INVALID' using errcode = '22023';
  end if;

  -- Serialize the read/write rate-limit boundary for each normalized identity.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_email, 0));
  if exists (
    select 1 from public.support_requests request
    where request.requester_email = v_email
      and request.created_at > clock_timestamp() - interval '10 minutes'
  ) then
    raise exception 'SUPPORT_RATE_LIMITED' using errcode = 'P0001';
  end if;

  insert into public.support_requests (
    shop_id, requester_profile_id, requester_email, category, subject, customer_message, priority
  ) values (
    v_shop_id, v_profile_id, v_email, p_category, btrim(p_subject), btrim(p_message),
    case when p_category = 'billing' then 'high' else 'normal' end
  ) returning id into v_request_id;

  insert into public.support_notification_outbox (request_id, recipient, kind)
  values (v_request_id, 'support@building-suit.com', 'new_request');

  return jsonb_build_object('ok', true, 'accepted', true, 'request_id', v_request_id, 'notification', 'not_configured');
end;
$$;
revoke all on function public.submit_support_request(text, text, text, text, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_support_request(text, text, text, text, boolean, text) to anon, authenticated;

comment on function public.submit_support_request(text, text, text, text, boolean, text) is
  'Validates and rate-limits Shop Suit public support submissions without exposing stored request content.';
