-- SS-BILLING-001: 14-day boundary, owner isolation, manual notice review,
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
    where portal.key = 'shop-crm' and plan.trial_days <> 14
  ) then raise exception 'canonical trial policy is not 14 days'; end if;
  begin
    update public.plans set trial_days = 30 where slug = 'basic';
    raise exception '30-day Shop trial policy was accepted';
  exception when check_violation then
    if sqlerrm <> 'SHOP_TRIAL_DAYS_MUST_BE_14' then raise; end if;
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
  v_shop := public.create_owner_shop('Billing fixture shop', 'pro', 'mixed');
  perform set_config('ss_billing.shop', v_shop::text, true);
  select subscription.trial_start_at, subscription.trial_end_at
  into v_trial_start, v_trial_end
  from public.subscriptions subscription
  join public.shop_memberships membership on membership.profile_id = subscription.profile_id
  where membership.shop_id = v_shop and membership.role = 'owner';
  if v_trial_end <> v_trial_start + interval '14 days'
    or public.shop_billing_read(v_shop) #>> '{subscription,trialDaysRemaining}' not in ('13', '14') then
    raise exception 'new trial is not exactly 14 days';
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
  v_notice := public.submit_shop_billing_notice(
    gen_random_uuid(), v_shop, 1199, current_date, 'IPN-SS-REJECT'
  );
  perform set_config('ss_billing.reject_notice', v_notice::text, true);
end;
$$;
reset role;

-- An unrelated tenant cannot inspect or submit against the owner's Shop.
select set_config('request.jwt.claim.sub', outsider_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true)
from shop_billing_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
  begin perform public.shop_billing_read(v_shop); raise exception 'outsider read billing';
  exception when insufficient_privilege then null; end;
  begin perform public.submit_shop_billing_notice(gen_random_uuid(), v_shop, 1, current_date, 'CROSS-TENANT'); raise exception 'outsider submitted billing';
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
    jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001', 'receivedDate', current_date::text, 'days', 30)
  );
  v_after_end := (public.platform_admin_read('shop', v_shop) #>> '{subscription,periodEnd}')::timestamptz;
  v_replayed := public.platform_admin_billing_command(
    (select approval_request_id from shop_billing_fixture), 'approve', v_submission,
    'Matched the external InstaPay statement',
    jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001', 'receivedDate', current_date::text, 'days', 30)
  );
  if not (v_replayed ->> 'replayed')::boolean
    or v_after_end <> v_before_end + interval '30 days'
    or not exists (
      select 1 from jsonb_array_elements(public.platform_admin_billing_read('queue', 'approved') -> 'items') item
      where (item ->> 'id')::uuid = v_submission
    )
    or (select count(*) from jsonb_array_elements(public.platform_admin_billing_read('audit') -> 'items') item
      where item ->> 'action' = 'approve' and (item ->> 'submissionId')::uuid = v_submission) <> 1 then
    raise exception 'approval did not activate exactly once';
  end if;
  begin
    perform public.platform_admin_billing_command(gen_random_uuid(), 'approve', v_submission, 'Duplicate approval', jsonb_build_object('receivedAmount', 1199, 'receivedReference', 'BANK-SS-001', 'receivedDate', current_date::text, 'days', 30));
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

-- Exact expiry is read-only for supported writes, while authorized history and
-- billing state remain readable and no records are deleted.
do $$
declare v_shop uuid := current_setting('ss_billing.shop')::uuid;
begin
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
    or jsonb_array_length(public.shop_billing_read(v_shop) -> 'submissions') <> 2 then
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
