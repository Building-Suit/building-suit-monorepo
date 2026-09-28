-- SS-RPT-LITE-001: known-fixture reconciliation, branch aggregation, and denial.
create temporary table shop_report_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() barber_id;
grant select on shop_report_fixture to authenticated;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select owner_id, 'owner@ss-report.invalid', 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now() from shop_report_fixture
union all
select barber_id, 'barber@ss-report.invalid', 'x', 'authenticated', 'authenticated', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now() from shop_report_fixture;

do $$
declare function_row record;
begin
  select procedure.oid, procedure.prosecdef, procedure.proconfig into function_row
  from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public' and procedure.proname = 'shop_operating_report';
  if not function_row.prosecdef
    or function_row.proconfig is distinct from array['search_path=""']::text[]
    or not has_function_privilege('authenticated', function_row.oid, 'execute')
    or has_function_privilege('anon', function_row.oid, 'execute') then
    raise exception 'unsafe operating report wrapper';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true) from shop_report_fixture;
set local role authenticated;
do $$
declare
  v_shop uuid; v_default uuid; v_branch uuid; v_staff uuid; v_customer uuid;
  v_product uuid; v_service uuid; v_bookable uuid; v_sale uuid; v_branch_sale uuid;
  v_outstanding uuid; v_shift uuid; v_appointment uuid; v_report jsonb; v_branch_report jsonb;
  v_anchor date := (now() at time zone 'Africa/Cairo')::date;
  v_start timestamptz := ((now() at time zone 'Africa/Cairo')::date::timestamp
    + interval '10 hours') at time zone 'Africa/Cairo';
begin
  v_shop := public.create_owner_shop('Operating report fixture', 'pro', 'mixed');
  select id into v_default from public.shop_locations where shop_id = v_shop and is_default;
  v_branch := public.save_shop_location(v_shop, null, 'Branch two', 'BR2', null, null);
  select id into v_staff from public.shop_memberships where shop_id = v_shop and role = 'owner';
  v_customer := public.save_customer(v_shop, null, 'Outstanding customer', null, null, null, null);
  v_product := public.save_product(v_shop, null, 'Report product', 'RPT-1', null, 20);
  v_service := public.save_service(v_shop, null, 'Report service', null, 50, 'amount', 0);
  perform public.adjust_stock(gen_random_uuid(), v_shop, v_product, 5, 10, 'Report fixture stock');

  v_shift := public.open_cash_shift(gen_random_uuid(), v_shop, v_default, 'main', 100, null);
  v_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_default, null,
    v_staff, null, v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','product','source_id',v_product,'quantity',1),
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null,
    v_shop, v_default, v_sale, 70, now(), 'cash', 'RPT-CASH');
  perform public.close_cash_shift(gen_random_uuid(), v_shop, v_shift, 168, 'Known variance');

  v_branch_sale := public.save_pos_sale_draft(gen_random_uuid(), v_shop, v_branch, null,
    v_staff, null, v_customer, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',1)));
  perform public.checkout_pos_sale(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), null,
    v_shop, v_branch, v_branch_sale, 50, now(), 'card', 'RPT-CARD');

  v_outstanding := public.save_location_sale_draft(gen_random_uuid(), v_shop, v_branch, null,
    v_customer, null, null, jsonb_build_array(
      jsonb_build_object('item_type','service','source_id',v_service,'quantity',0.6)));
  perform public.issue_location_sale(gen_random_uuid(), v_shop, v_branch, v_outstanding);

  perform set_config('shop.location_id', v_default::text, true);
  perform public.save_expense(v_shop, null, gen_random_uuid(), 'Default rent', 10,
    'Rent', v_anchor, null);
  perform set_config('shop.location_id', v_branch::text, true);
  perform public.save_expense(v_shop, null, gen_random_uuid(), 'Branch utilities', 5,
    'Utilities', v_anchor, null);

  v_bookable := public.save_service(v_shop, null, 'Scheduled report service', null, 25,
    'amount', 0, true, 30, 0, array[v_default], array[v_staff]);
  perform public.save_staff_schedule(v_shop, v_default, v_staff, 'Africa/Cairo',
    (select jsonb_agg(jsonb_build_object('weekday', day, 'startsLocal', '00:00',
      'endsLocal', '23:59')) from generate_series(0, 6) day), '[]'::jsonb);
  v_appointment := public.save_appointment(gen_random_uuid(), v_shop, null, v_default,
    v_staff, v_bookable, v_start, 'customer', v_customer, null, null, null);
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'arrived');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'waiting');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'in_service');
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'completed');
  v_appointment := public.save_appointment(gen_random_uuid(), v_shop, null, v_default,
    v_staff, v_bookable, v_start + interval '15 minutes', 'walk_in', null,
    'No show customer', null, null);
  perform public.transition_appointment(gen_random_uuid(), v_shop, v_appointment, 'no_show');

  v_report := public.shop_operating_report(v_shop, null, 'month', v_anchor);
  v_branch_report := public.shop_operating_report(v_shop, v_branch, 'month', v_anchor);
  if (v_report ->> 'sales')::numeric <> 150
    or (v_report ->> 'saleCount')::integer <> 3
    or (v_report ->> 'paymentsIn')::numeric <> 120
    or (v_report #>> '{expenses,amount}')::numeric <> 15
    or (v_report #>> '{expenses,operatingBalance}')::numeric <> 135
    or (v_report #>> '{outstanding,amount}')::numeric <> 30
    or (v_report #>> '{outstanding,customerCount}')::integer <> 1
    or (v_report #>> '{appointments,completed}')::integer <> 1
    or (v_report #>> '{appointments,noShow}')::integer <> 1
    or (v_report #>> '{appointments,busiestTimes,0,count}')::integer <> 2
    or (v_report #>> '{cash,variance}')::numeric <> -2
    or jsonb_array_length(v_report -> 'locations') <> 2
    or jsonb_array_length(v_report -> 'staff') <> 1
    or (v_report #>> '{staff,0,sales}')::numeric <> 120
    or (v_report #>> '{staff,0,saleCount}')::integer <> 2
    or (v_report #>> '{staff,0,serviceCount}')::numeric <> 2 then
    raise exception 'operating report did not reconcile known fixtures: %', v_report;
  end if;
  if (v_branch_report ->> 'sales')::numeric <> 80
    or (v_branch_report #>> '{expenses,amount}')::numeric <> 5
    or (v_branch_report #>> '{cash,variance}')::numeric <> 0
    or jsonb_array_length(v_branch_report -> 'locations') <> 1 then
    raise exception 'branch report was not isolated: %', v_branch_report;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_report -> 'salesMix') mix
      where mix ->> 'type' = 'product' and (mix ->> 'amount')::numeric = 20)
    or not exists (select 1 from jsonb_array_elements(v_report -> 'salesMix') mix
      where mix ->> 'type' = 'service' and (mix ->> 'amount')::numeric = 130)
    or not exists (select 1 from jsonb_array_elements(v_report -> 'paymentMix') mix
      where mix ->> 'method' = 'cash' and (mix ->> 'net')::numeric = 70)
    or not exists (select 1 from jsonb_array_elements(v_report -> 'paymentMix') mix
      where mix ->> 'method' = 'card' and (mix ->> 'net')::numeric = 50) then
    raise exception 'sales/payment mixes did not reconcile: %', v_report;
  end if;
  begin
    perform public.shop_operating_report(v_shop, null, 'quarter', v_anchor);
    raise exception 'invalid report period accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'INVALID_REPORT_PERIOD' then raise; end if;
  end;
  perform set_config('ss_report.shop', v_shop::text, true);
  perform set_config('ss_report.default', v_default::text, true);
end;
$$;
reset role;

insert into public.profiles (user_id, portal_id, display_name, email_snapshot)
select fixture.barber_id, shop.portal_id, 'Ordinary barber', 'barber@ss-report.invalid'
from shop_report_fixture fixture join public.shops shop on shop.id = current_setting('ss_report.shop')::uuid;

select set_config('request.jwt.claim.sub', owner_id::text, true) from shop_report_fixture;
set local role authenticated;
select public.invite_shop_member(gen_random_uuid(), current_setting('ss_report.shop')::uuid,
  'barber@ss-report.invalid', 'Ordinary barber', 'barber',
  array[current_setting('ss_report.default')::uuid]);
reset role;

select set_config('request.jwt.claim.sub', barber_id::text, true) from shop_report_fixture;
set local role authenticated;
do $$
begin
  begin
    perform public.shop_operating_report(current_setting('ss_report.shop')::uuid,
      current_setting('ss_report.default')::uuid, 'month',
      (now() at time zone 'Africa/Cairo')::date);
    raise exception 'ordinary barber viewed owner operating metrics';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
