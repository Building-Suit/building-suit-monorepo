-- HOT-09: seven-day boundary, owner isolation, manual notice review,
-- approval idempotency, read-only expiry, and immutable evidence.

create temporary table shop_billing_fixture as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id,
  gen_random_uuid() as operator_id, gen_random_uuid() as observer_id,
  gen_random_uuid() as notice_request_id, gen_random_uuid() as approval_request_id;
grant select on shop_billing_fixture to authenticated;

insert into auth.users (
  id, email, encrypted_password, aud, role,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select id, id::text || '@ss-billing-001.invalid', 'x', 'authenticated',
  'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from (
  select owner_id as id from shop_billing_fixture
  union all select outsider_id from shop_billing_fixture
  union all select operator_id from shop_billing_fixture
  union all select observer_id from shop_billing_fixture
) users;

do $$
declare function_row record;
begin
  for function_row in
    select procedure.oid, procedure.proname, procedure.prosecdef, procedure.proconfig
    from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'shop_billing_read', 'submit_shop_billing_notice',
      'platform_admin_billing_read', 'platform_admin_billing_command'
    ])
  loop
    if not function_row.prosecdef
      or function_row.proconfig is distinct from array['search_path=""']::text[]
      or not has_function_privilege('authenticated', function_row.oid, 'execute')
      or has_function_privilege('anon', function_row.oid, 'execute') then
      raise exception 'unsafe billing wrapper: %', function_row.proname;
    end if;
  end loop;
  if has_table_privilege('authenticated', 'public.shop_billing_submissions', 'insert')
    or has_table_privilege('authenticated', 'public.shop_billing_submissions', 'update')
    or has_table_privilege('authenticated', 'public.shop_billing_configuration', 'select')
    or has_table_privilege('authenticated', 'public.platform_billing_events', 'select') then
    raise exception 'billing tables bypass supported RPCs';
  end if;
  if exists (
    select 1 from public.plans plan join public.portals portal on portal.id = plan.portal_id
    where portal.key = 'shop-crm' and plan.trial_days <> 7
  ) then raise exception 'canonical trial policy is not 7 days'; end if;
  begin
    update public.plans set trial_days = 30 where slug = 'solo';
    raise exception '30-day Shop trial policy was accepted';
  exception when check_violation then
    if sqlerrm <> 'SHOP_TRIAL_DAYS_MUST_BE_7' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid;
  v_trial_start timestamptz;
  v_trial_end timestamptz;
  v_notice uuid;
  v_replay uuid;
begin
  v_shop := public.create_owner_shop('Billing fixture shop', 'team', 'mixed');
  perform set_config('ss_billing.shop', v_shop::text, true);
  select subscription.trial_start_at, subscription.trial_end_at
  into v_trial_start, v_trial_end
  from public.subscriptions subscription
  join public.shop_memberships membership on membership.profile_id = subscription.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  if v_trial_end <> v_trial_start + interval '7 days'
    or public.shop_billing_read(v_shop) #>> '{subscription,trialDaysRemaining}' not in ('6', '7') then
    raise exception 'new trial is not exactly 7 days';
  end if;

  v_notice := public.submit_shop_billing_notice(
    (select notice_request_id from shop_billing_fixture), v_shop, 1199, current_date, 'IPN-SS-001'
  );
  v_replay := public.submit_shop_billing_notice(
    (select notice_request_id from shop_billing_fixture), v_shop, 1199, current_date, 'IPN-SS-001'
  );
  if v_notice <> v_replay
    or public.shop_billing_read(v_shop) #>> '{submissions,0,status}' <> 'submitted'
    or public.shop_billing_read(v_shop) #>> '{subscription,status}' <> 'trialing' then
    raise exception 'notice retry or no-self-activation invariant failed';
  end if;
  perform set_config('ss_billing.notice', v_notice::text, true);
  begin
    perform public.submit_shop_billing_notice(
      (select notice_request_id from shop_billing_fixture), v_shop, 1200, current_date, 'IPN-SS-001'
    );
    raise exception 'notice request key accepted different payload';
  exception when sqlstate '22023' then
    if sqlerrm <> 'BILLING_NOTICE_KEY_REUSED' then raise; end if;
  end;
  begin
    perform public.platform_admin_billing_command(
      gen_random_uuid(), 'approve', v_notice, 'Owner self activation', '{}'::jsonb
    );
    raise exception 'owner self-activated billing';
  exception when insufficient_privilege then null; end;
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 1199, current_date, 'IPN-SS-REJECT'
  );
  perform set_config('ss_billing.reject_notice', v_notice::text, true);
end;
$$;
reset role;

insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
select outsider_id, (select id from public.portals where key = 'shop-crm'),
  'Billing employee', outsider_id::text || '@ss-billing-001.invalid'
from shop_billing_fixture;
insert into public.shop_memberships (shop_id, profile_id, role, status)
select current_setting('ss_billing.shop')::uuid, profile.id, 'employee', 'active'
from public.profiles profile join shop_billing_fixture fixture on fixture.outsider_id = profile.user_id;

-- A Shop employee cannot inspect owner billing or self-activate.
select set_config('request.jwt.claim.sub', outsider_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  begin perform public.shop_billing_read(v_shop); raise exception 'employee read owner billing';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_shop_billing_notice(gen_random_uuid(), v_shop, 1, current_date, 'EMPLOYEE'); raise exception 'employee submitted billing';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- An unrelated authenticated account remains isolated from the Shop.
select set_config('request.jwt.claim.sub', observer_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  begin perform public.shop_billing_read(v_shop); raise exception 'cross-shop billing read';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_shop_billing_notice(gen_random_uuid(), v_shop, 1, current_date, 'CROSS-SHOP'); raise exception 'cross-shop billing submission';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

insert into public.platform_admins (user_id, role, display_name)
select operator_id, 'operator', 'Billing operator' from shop_billing_fixture
union all select observer_id, 'observer', 'Billing observer' from shop_billing_fixture;

-- Observer reads the queue but cannot review or configure it.
select set_config('request.jwt.claim.sub', observer_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_submission uuid;
begin
  v_submission := (public.platform_admin_billing_read('queue') #>> '{items,0,id}')::uuid;
  if v_submission is null then raise exception 'observer cannot read billing queue'; end if;
  begin
    perform public.platform_admin_billing_command(gen_random_uuid(), 'reject', v_submission, 'Observer denial', '{}'::jsonb);
    raise exception 'observer reviewed billing';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('ss_billing.shop')::uuid;
  v_submission uuid;
  v_before_end timestamptz;
  v_after_end timestamptz;
  v_replayed jsonb;
begin
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'configure_instructions', null, 'Publish current InstaPay recipient',
    '{"recipientAlias":"building-suit@instapay","paymentLink":"https://instapay.example/pay/building-suit","qrImageUrl":"https://instapay.example/qr/building-suit.png","instructionsEn":"Transfer, then submit the bank reference for manual review.","instructionsAr":"حوّل ثم أرسل مرجع التحويل للمراجعة اليدوية."}'::jsonb
  );
  if public.platform_admin_billing_read('configuration') ->> 'recipientAlias' <> 'building-suit@instapay' then
    raise exception 'operator configuration missing';
  end if;
  v_submission := current_setting('ss_billing.notice')::uuid;
  perform public.platform_admin_billing_command(gen_random_uuid(), 'mark_under_review', v_submission, 'Started bank statement comparison', '{}'::jsonb);
  v_before_end := (public.platform_admin_read('shop', v_shop) #>> '{subscription,periodEnd}')::timestamptz;
  perform public.platform_admin_billing_command(
    (select approval_request_id from shop_billing_fixture), 'approve', v_submission,
    'Matched the external InstaPay statement',
    jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001',
      'receivedDate', current_date::text,
      'amountOverrideReason', 'Pilot transfer includes an explicitly verified service adjustment')
  );
  v_after_end := (public.platform_admin_read('shop', v_shop) #>> '{subscription,periodEnd}')::timestamptz;
  v_replayed := public.platform_admin_billing_command(
    (select approval_request_id from shop_billing_fixture), 'approve', v_submission,
    'Matched the external InstaPay statement',
    jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001',
      'receivedDate', current_date::text,
      'amountOverrideReason', 'Pilot transfer includes an explicitly verified service adjustment')
  );
  if not (v_replayed ->> 'replayed')::boolean
    or v_after_end <> v_before_end + interval '1 month'
    or not exists (
      select 1 from jsonb_array_elements(public.platform_admin_billing_read('queue', 'approved') -> 'items') item
      where (item ->> 'id')::uuid = v_submission
    )
    or (select count(*) from jsonb_array_elements(public.platform_admin_billing_read('audit') -> 'items') item
      where item ->> 'action' = 'approve' and (item ->> 'submissionId')::uuid = v_submission) <> 1 then
    raise exception 'approval did not activate exactly once';
  end if;
  begin
    perform public.platform_admin_billing_command(gen_random_uuid(), 'approve', v_submission, 'Duplicate approval', jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001', 'receivedDate', current_date::text, 'amountOverrideReason', 'Duplicate mismatch override'));
    raise exception 'second approval extended subscription';
  exception when sqlstate '22023' then
    if sqlerrm <> 'BILLING_NOTICE_STATE_INVALID' then raise; end if;
  end;
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'reject', current_setting('ss_billing.reject_notice')::uuid,
    'Reference was not found in the external statement', '{}'::jsonb
  );
  if not exists (
    select 1 from jsonb_array_elements(public.platform_admin_billing_read('queue', 'rejected') -> 'items') item
    where (item ->> 'id')::uuid = current_setting('ss_billing.reject_notice')::uuid
      and item ->> 'reviewReason' = 'Reference was not found in the external statement'
  ) then raise exception 'rejection reason was not preserved'; end if;
end;
$$;
reset role;

-- A requested upgrade is quoted immutably and does not alter entitlements
-- before the operator approves the externally verified transfer.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid; v_notice uuid; v_read jsonb;
begin
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 'multi', 999, current_date, 'IPN-SS-UPGRADE'
  );
  v_read := public.shop_billing_read(v_shop);
  if v_read #>> '{subscription,planSlug}' <> 'team'
    or not exists (select 1 from jsonb_array_elements(v_read -> 'submissions') item
      where (item ->> 'id')::uuid = v_notice
        and item ->> 'requestedPlanSlug' = 'multi'
        and item ->> 'billingInterval' = 'monthly'
        and (item ->> 'listPriceAmount')::numeric = 999
        and (item ->> 'effectivePriceAmount')::numeric = 999) then
    raise exception 'plan-change notice mutated access or lost its quote';
  end if;
  perform set_config('ss_billing.upgrade_notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'approve', current_setting('ss_billing.upgrade_notice')::uuid,
    'Verified upgrade transfer',
    jsonb_build_object('receivedAmount', 999, 'receivedReference', 'BANK-SS-UPGRADE', 'receivedDate', current_date::text)
  );
  if public.platform_admin_billing_read('queue', 'approved') #>> '{items,0,requestedPlanSlug}' is null
    or public.platform_admin_read('shop', v_shop) #>> '{subscription,planSlug}' <> 'multi' then
    raise exception 'approved upgrade did not activate the exact requested plan';
  end if;

  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'set_price_override', null, 'Expired founder offer evidence',
    jsonb_build_object('shopId', v_shop, 'amount', 399, 'currency', 'EGP',
      'effectiveFrom', clock_timestamp() - interval '2 days',
      'expiresAt', clock_timestamp() - interval '1 day')
  );
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'set_price_override', null, 'Active founder renewal price',
    jsonb_build_object('shopId', v_shop, 'amount', 499, 'currency', 'EGP',
      'effectiveFrom', clock_timestamp() - interval '1 hour', 'expiresAt', null)
  );
  if false /* override storage checked after reset role */ then
    raise exception 'price overrides were not append-only';
  end if;
end;
$$;
reset role;

-- SS-PLAN-BILLING-001 privileged override-storage assertion
-- Authenticated callers exercise billing through supported RPC boundaries.
-- Internal commercial override persistence is asserted only by the test harness.
do $$
declare
  v_shop uuid := current_setting('ss_billing.shop')::uuid;
  v_override_count bigint;
begin
  if has_table_privilege(
    'authenticated',
    'public.subscription_price_overrides',
    'select'
  ) then
    raise exception
      'subscription_price_overrides unexpectedly exposed to authenticated';
  end if;

  select count(*)
  into v_override_count
  from public.subscription_price_overrides price
  join public.shop_memberships membership
    on membership.profile_id = (
      select subscription.profile_id
      from public.subscriptions subscription
      where subscription.id = price.subscription_id
    )
  where membership.shop_id = v_shop;

  if v_override_count <> 2 then
    raise exception
      'plan-aware billing override storage expected 2 rows, found %',
      v_override_count;
  end if;
end;
$$;


select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid; v_notice uuid; v_item jsonb;
begin
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 'multi', 499, current_date, 'IPN-SS-FOUNDER'
  );
  select item into v_item from jsonb_array_elements(public.shop_billing_read(v_shop) -> 'submissions') item
  where (item ->> 'id')::uuid = v_notice;
  if (v_item ->> 'listPriceAmount')::numeric <> 999
    or (v_item ->> 'effectivePriceAmount')::numeric <> 499
    or v_item ->> 'priceSource' <> 'override' then
    raise exception 'active founder price was not frozen into the renewal quote';
  end if;
  perform set_config('ss_billing.founder_notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_notice uuid := current_setting('ss_billing.founder_notice')::uuid;
begin
  begin
    perform public.platform_admin_billing_command(
      gen_random_uuid(), 'approve', v_notice, 'Unexplained amount mismatch',
      jsonb_build_object('receivedAmount', 500, 'receivedReference', 'BANK-SS-MISMATCH', 'receivedDate', current_date::text)
    );
    raise exception 'amount mismatch activated without override evidence';
  exception when sqlstate '22023' then
    if sqlerrm <> 'BILLING_AMOUNT_MISMATCH_OVERRIDE_REQUIRED' then raise; end if;
  end;
  perform public.platform_admin_billing_command(
    gen_random_uuid(), 'approve', v_notice, 'Verified founder renewal transfer',
    jsonb_build_object('receivedAmount', 499, 'receivedReference', 'BANK-SS-FOUNDER', 'receivedDate', current_date::text)
  );
  if false /* commercial-period storage checked after reset role */ then
    raise exception 'negotiated renewal commercial evidence is incomplete';
  end if;
end;
$$;
reset role;

-- SS-PLAN-BILLING-001 privileged commercial-period assertion
-- Client-visible behavior is tested through supported RPCs. Commercial
-- persistence evidence is inspected only by the privileged test harness.
do $$
declare
  v_shop uuid := current_setting('ss_billing.shop')::uuid;
  v_period_count bigint;
begin
  if has_table_privilege(
    'authenticated',
    'public.subscription_commercial_periods',
    'select'
  ) then
    raise exception
      'subscription_commercial_periods unexpectedly exposed to authenticated';
  end if;

  select count(*)
  into v_period_count
  from public.subscription_commercial_periods period
  join public.subscriptions subscription
    on subscription.id = period.subscription_id
  join public.shop_memberships membership
    on membership.profile_id = subscription.profile_id
  where membership.shop_id = v_shop
    and period.price_amount = 499
    and period.list_price_amount = 999
    and period.price_override_id is not null;

  if v_period_count <> 1 then
    raise exception
      'expected exactly one approved overridden commercial period, found %',
      v_period_count;
  end if;
end;
$$;


-- Downgrade approval fails closed while live usage exceeds the requested plan.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_notice uuid;
begin
  v_shop := public.create_owner_shop('Blocked downgrade shop', 'multi', 'mixed');
  perform public.save_shop_location(v_shop, null, 'Second branch', 'BR-2', null, null);
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 'solo', 349, current_date, 'IPN-SS-DOWNGRADE'
  );
  perform set_config('ss_billing.downgrade_shop', v_shop::text, true);
  perform set_config('ss_billing.downgrade_notice', v_notice::text, true);
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.downgrade_shop')::uuid;
  v_notice uuid := current_setting('ss_billing.downgrade_notice')::uuid;
begin
  if jsonb_array_length((select item -> 'usageBlockers'
      from jsonb_array_elements(public.platform_admin_billing_read('queue') -> 'items') item
      where (item ->> 'id')::uuid = v_notice)) = 0 then
    raise exception 'billing queue omitted current downgrade blockers';
  end if;
  begin
    perform public.platform_admin_billing_command(
      gen_random_uuid(), 'approve', v_notice, 'Attempt blocked downgrade',
      jsonb_build_object('receivedAmount', (
      select (item ->> 'expectedAmount')::numeric
      from jsonb_array_elements(
        public.platform_admin_billing_read(
          'queue', null, 1, 100
        ) -> 'items'
      ) item
      where (item ->> 'id')::uuid = v_notice
      limit 1
    ), 'receivedReference', 'BANK-SS-DOWNGRADE', 'receivedDate', current_date::text,
        'amountOverrideReason',
        'Explicit amount override while verifying downgrade quota blockers')
    );
    raise exception 'over-limit downgrade was approved';
  exception when check_violation then
    if sqlerrm <> 'PLAN_CHANGE_BLOCKED' then raise; end if;
  end;
  if public.platform_admin_read('shop', v_shop) #>> '{subscription,planSlug}' <> 'multi' then
    raise exception 'blocked downgrade changed the subscription';
  end if;
end;
$$;
reset role;

-- Exact expiry is read-only for supported writes, while authorized history and
-- billing state remain readable and no records are deleted.
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  perform set_config(
    'ss_billing.history_count_before_expiry',
    (
      select count(*)::text
      from public.shop_billing_submissions submission
      where submission.shop_id = v_shop
    ),
    true
  );

  update public.subscriptions subscription set status = 'trialing',
    trial_end_at = now(), current_period_end = now(), locked_at = now()
  from public.shop_memberships membership
  where membership.profile_id = subscription.profile_id and membership.shop_id = v_shop and membership.role = 'owner';
end;
$$;
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  if public.shop_billing_read(v_shop) #>> '{subscription,accessState}' <> 'read_only'
    or jsonb_array_length(public.shop_billing_read(v_shop) -> 'submissions') <> current_setting('ss_billing.history_count_before_expiry')::integer then
    raise exception 'expiry hid authorized billing history';
  end if;
  begin
    perform public.save_product(v_shop, null, 'Blocked after expiry', null, null, 10);
    raise exception 'exact expiry still allowed writes';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_SUBSCRIPTION_INACTIVE' then raise; end if;
  end;
end;
$$;
reset role;

do $$
begin
  begin
    update public.platform_billing_events set reason = 'rewritten';
    raise exception 'billing audit was mutable';
  exception when sqlstate '55000' then null; end;
end;
$$;

-- SS-SA-EVIDENCE-001: private Storage policy, immutable metadata, requester
-- isolation and the trusted review boundary. Evidence never changes approval.
select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare
  v_submission uuid := current_setting('ss_billing.downgrade_notice')::uuid;
  v_reserved jsonb;
  v_index integer;
  v_affected integer;
  v_immutable_object jsonb;
begin
  v_reserved := public.reserve_shop_billing_payment_evidence(
    v_submission, 'transfer receipt.png', 'image/png', 1024, repeat('a', 64)
  );
  perform set_config('ss_billing.evidence_id', v_reserved ->> 'evidenceId', true);
  perform set_config('ss_billing.evidence_object', v_reserved ->> 'objectName', true);
  if v_reserved ->> 'bucket' <> 'shop-payment-evidence'
    or v_reserved ->> 'objectName' !~ ('^' || current_setting('ss_billing.downgrade_shop')
      || '/' || v_submission::text || '/[0-9a-f-]+\.png$') then
    raise exception 'evidence reservation did not return a safe server path';
  end if;
  if not shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","contentLength":1024}')
    or not shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","size":1024,"contentLength":1024}') then
    raise exception 'Storage preflight contentLength was not authorized';
  end if;
  if shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","size":1024,"contentLength":2048}')
    or shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","size":2048,"contentLength":1024}')
    or shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png"}')
    or shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","contentLength":"invalid"}')
    or shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"image/png","contentLength":null}')
    or shop_private.billing_payment_evidence_upload_allowed(
      v_reserved ->> 'objectName', '{"mimetype":"application/pdf","contentLength":1024}') then
    raise exception 'invalid Storage metadata bypassed immutable reservation';
  end if;
  insert into storage.objects (bucket_id, name, metadata)
  values ('shop-payment-evidence', v_reserved ->> 'objectName',
    jsonb_build_object('mimetype', 'image/png', 'size', 1024));
  if jsonb_array_length(public.shop_billing_payment_evidence_read(v_submission)) <> 1 then
    raise exception 'uploaded owner evidence is not readable';
  end if;
  begin
    perform public.reserve_shop_billing_payment_evidence(
      v_submission, '../unsafe.exe', 'application/octet-stream', 1024, repeat('b', 64));
    raise exception 'unsafe payment evidence was reserved';
  exception when sqlstate '22023' then
    if sqlerrm <> 'BILLING_PAYMENT_EVIDENCE_INVALID' then raise; end if;
  end;
  for v_index in 2..5 loop
    perform public.reserve_shop_billing_payment_evidence(
      v_submission, 'receipt-' || v_index || '.pdf', 'application/pdf', 2048,
      repeat(v_index::text, 64));
  end loop;
  begin
    perform public.reserve_shop_billing_payment_evidence(
      v_submission, 'receipt-6.pdf', 'application/pdf', 2048, repeat('6', 64));
    raise exception 'payment evidence count limit was bypassed';
  exception when sqlstate '22023' then
    if sqlerrm <> 'BILLING_PAYMENT_EVIDENCE_LIMIT_REACHED' then raise; end if;
  end;
  select to_jsonb(object) into strict v_immutable_object
  from storage.objects object
  where object.bucket_id = 'shop-payment-evidence'
    and object.name = current_setting('ss_billing.evidence_object');
  v_affected := 0;
  begin
    update storage.objects set name = name || '.changed'
    where bucket_id = 'shop-payment-evidence' and name = current_setting('ss_billing.evidence_object');
    get diagnostics v_affected = row_count;
  exception when insufficient_privilege then null; end;
  if v_affected <> 0 or v_immutable_object is distinct from (
    select to_jsonb(object) from storage.objects object
    where object.bucket_id = 'shop-payment-evidence'
      and object.name = current_setting('ss_billing.evidence_object')
  ) then raise exception 'owner updated immutable evidence object'; end if;
  v_affected := 0;
  begin
    delete from storage.objects
    where bucket_id = 'shop-payment-evidence' and name = current_setting('ss_billing.evidence_object');
    get diagnostics v_affected = row_count;
  exception when insufficient_privilege then null; end;
  if v_affected <> 0 or v_immutable_object is distinct from (
    select to_jsonb(object) from storage.objects object
    where object.bucket_id = 'shop-payment-evidence'
      and object.name = current_setting('ss_billing.evidence_object')
  ) then raise exception 'owner deleted retained evidence object'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', outsider_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
begin
  if exists (select 1 from storage.objects object
      where object.bucket_id = 'shop-payment-evidence') then
    raise exception 'other user listed payment evidence';
  end if;
  begin
    perform public.reserve_shop_billing_payment_evidence(
      current_setting('ss_billing.downgrade_notice')::uuid,
      'cross-shop.pdf', 'application/pdf', 1024, repeat('7', 64));
    raise exception 'non-requester reserved payment evidence';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('shop-payment-evidence', current_setting('ss_billing.downgrade_shop') || '/'
      || current_setting('ss_billing.downgrade_notice') || '/' || gen_random_uuid()::text || '.png',
      jsonb_build_object('mimetype', 'image/png', 'size', 1024));
    raise exception 'non-requester uploaded payment evidence';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '', true),
  set_config('request.jwt.claim.role', 'anon', true);
set local role anon;
do $$
begin
  if exists (select 1 from storage.objects object
      where object.bucket_id = 'shop-payment-evidence') then
    raise exception 'anonymous user listed payment evidence';
  end if;
  begin
    insert into storage.objects (bucket_id, name, metadata)
    values ('shop-payment-evidence', gen_random_uuid()::text || '.pdf',
      jsonb_build_object('mimetype', 'application/pdf', 'size', 1));
    raise exception 'anonymous user uploaded payment evidence';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

do $$
begin
  if (select public from storage.buckets where id = 'shop-payment-evidence')
    or (select file_size_limit from storage.buckets where id = 'shop-payment-evidence') <> 5242880
    or has_table_privilege('authenticated', 'public.shop_billing_payment_evidence', 'select')
    or has_function_privilege('authenticated',
      'shop_private.billing_payment_evidence_review_access(uuid,uuid,integer)', 'execute')
    or has_function_privilege('authenticated',
      'public.shop_super_admin_bridge_evidence_access(uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'private evidence boundary is exposed';
  end if;
  begin
    update public.shop_billing_payment_evidence set original_file_name = 'rewritten.pdf'
    where id = current_setting('ss_billing.evidence_id')::uuid;
    raise exception 'evidence metadata was mutable';
  exception when sqlstate '55000' then null; end;
  if (select retained_until < created_at + interval '7 years'
      from public.shop_billing_payment_evidence
      where id = current_setting('ss_billing.evidence_id')::uuid) then
    raise exception 'evidence retention metadata is too short';
  end if;
  if (select status from public.shop_billing_submissions
      where id = current_setting('ss_billing.downgrade_notice')::uuid) <> 'submitted' then
    raise exception 'evidence presence changed billing approval state';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', operator_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
begin
  begin
    perform shop_private.billing_payment_evidence_review_access(
      current_setting('ss_billing.downgrade_notice')::uuid,
      current_setting('ss_billing.evidence_id')::uuid, 60);
    raise exception 'platform operator bypassed the trusted bridge';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '', true),
  set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
do $$
declare v_access jsonb;
begin
  begin
    perform shop_private.billing_payment_evidence_review_access(
      current_setting('ss_billing.downgrade_notice')::uuid,
      current_setting('ss_billing.evidence_id')::uuid, 60);
    raise exception 'service role bypassed the trusted bridge context';
  exception when insufficient_privilege then null; end;
  perform set_config('shop.super_admin_bridge_principal_id', gen_random_uuid()::text, true);
  begin
    perform shop_private.billing_payment_evidence_review_access(
      current_setting('ss_billing.downgrade_notice')::uuid,
      current_setting('ss_billing.evidence_id')::uuid, 60);
    raise exception 'service role directly executed private helper with forged bridge context';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;

-- Unit-test helper behavior as its database owner. Browser/service-role direct
-- execution remains denied above; the HTTP harness tests the trusted gateway.
do $$
declare v_access jsonb;
begin
  v_access := shop_private.billing_payment_evidence_review_access(
    current_setting('ss_billing.downgrade_notice')::uuid,
    current_setting('ss_billing.evidence_id')::uuid, 60);
  if v_access ->> 'objectName' <> current_setting('ss_billing.evidence_object')
    or (v_access ->> 'expiresIn')::integer <> 60 then
    raise exception 'trusted review access contract is incomplete';
  end if;
  begin
    perform shop_private.billing_payment_evidence_review_access(
      current_setting('ss_billing.downgrade_notice')::uuid,
      current_setting('ss_billing.evidence_id')::uuid, 301);
    raise exception 'overlong signed access was accepted';
  exception when sqlstate '22023' then null; end;
end;
$$;
reset role;
