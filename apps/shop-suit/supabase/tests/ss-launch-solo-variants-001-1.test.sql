begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select extensions.plan(7);

select extensions.is((select count(*)::integer from public.shop_public_plan_catalog()), 10,
  'ten offers remain grouped into three public families');
select extensions.is((select count(distinct id)::integer from public.shop_public_plan_catalog()), 3,
  'Solo remains one public family');
select extensions.is((select jsonb_agg(jsonb_build_array(plan_variant, billing_interval,
  price_amount, resource_limits) order by plan_variant, billing_interval)
  from public.shop_public_plan_catalog() where slug = 'solo'), '[
  ["solo_1","annual",2847.84,{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}],
  ["solo_1","monthly",349,{"active_locations":1,"active_members":1,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}],
  ["solo_2","annual",4071.84,{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}],
  ["solo_2","monthly",499,{"active_locations":1,"active_members":2,"active_products":250,"active_services":50,"active_customers":500,"active_suppliers":50}]
]'::jsonb, 'exact prices, member allowances, and unchanged non-member quotas');
select extensions.ok(not exists (select 1 from public.shop_public_plan_catalog()
  where slug = 'solo' and plan_variant = 'standard') and exists (
  select 1 from public.plan_catalog_terms terms join public.plans plan on plan.id = terms.plan_id
  where plan.slug = 'solo' and terms.plan_variant = 'standard' and terms.price_amount = 349
    and terms.resource_limits ->> 'active_members' = '2'),
  'historical Solo terms survive but cannot be newly selected');

create temporary table solo_fixture as select gen_random_uuid() owner_id,
  gen_random_uuid() operator_id, gen_random_uuid() staff_id;
grant select on solo_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id, id::text || '@solo-variants.invalid', 'x', 'authenticated','authenticated',
  now(),'{}'::jsonb,'{}'::jsonb,now(),now() from (
  select owner_id id from solo_fixture union all select operator_id from solo_fixture
  union all select staff_id from solo_fixture) users;
insert into public.platform_admins(user_id,role,display_name)
select operator_id,'operator','Solo test operator' from solo_fixture;
select set_config('request.jwt.claim.sub',owner_id::text,true),
  set_config('request.jwt.claim.role','authenticated',true) from solo_fixture;
set local role authenticated;
do $$
declare v_shop uuid;
begin
  v_shop := public.create_owner_shop('Solo variant fixture','solo','mixed');
  if (public.shop_billing_read(v_shop) #>> '{subscription,planVariant}') <> 'solo_1' then
    raise exception 'default Solo selection did not resolve Solo 1';
  end if;
  begin
    perform public.submit_shop_billing_notice(gen_random_uuid(),v_shop,'solo',
      (select terms.id from public.plan_catalog_terms terms join public.plans plan on plan.id=terms.plan_id
        where plan.slug='solo' and terms.plan_variant='standard' order by terms.version desc limit 1),
      349,current_date,'HISTORICAL-NOT-OFFERED');
    raise exception 'historical Solo term accepted as a new selection';
  exception when invalid_parameter_value then
    if sqlerrm <> 'PLAN_UNAVAILABLE' then raise; end if;
  end;
  perform set_config('solo_test.shop',v_shop::text,true);
  begin
    perform public.invite_shop_member(gen_random_uuid(),v_shop,
      'no-seat@solo-variants.invalid','No seat','cashier',
      array[(select id from public.shop_locations where shop_id=v_shop and is_default)]);
    raise exception 'Solo 1 accepted an invitation above its member limit';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_members:%' then raise; end if;
  end;
  perform set_config('solo_test.notice', public.submit_shop_billing_notice(gen_random_uuid(),v_shop,'solo',
    (select catalog_terms_id from public.shop_public_plan_catalog()
      where plan_variant='solo_2' and billing_interval='monthly'),
    499,current_date,'SOLO2-TEST')::text,true);
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',operator_id::text,true),
  set_config('shop.billing_approval','approved',true) from solo_fixture;
set local role authenticated;
select public.platform_admin_billing_command(gen_random_uuid(),'approve',
  current_setting('solo_test.notice')::uuid,'Matched Solo 2 selection',
  jsonb_build_object('receivedAmount',499,'receivedReference','SOLO2-BANK',
    'receivedDate',current_date::text));
reset role;
select set_config('request.jwt.claim.sub',owner_id::text,true) from solo_fixture;
set local role authenticated;
do $$
declare v_shop uuid := current_setting('solo_test.shop')::uuid; v_invite jsonb;
begin
  v_invite := public.invite_shop_member(gen_random_uuid(),v_shop,
    (select staff_id::text || '@solo-variants.invalid' from solo_fixture),'Staff','cashier',
    array[(select id from public.shop_locations where shop_id=v_shop and is_default)]);
  perform set_config('solo_test.code',v_invite->>'invitationCode',true);
  begin
    perform public.invite_shop_member(gen_random_uuid(),v_shop,
      'third@solo-variants.invalid','Third','cashier',
      array[(select id from public.shop_locations where shop_id=v_shop and is_default)]);
    raise exception 'pending invitation did not reserve the second seat';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_REACHED:active_members:%' then raise; end if;
  end;
  perform public.submit_shop_billing_notice(gen_random_uuid(),v_shop,'solo',
    (select catalog_terms_id from public.shop_public_plan_catalog()
      where plan_variant='solo_1' and billing_interval='monthly'),
    349,current_date,'SOLO1-DOWNGRADE');
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',operator_id::text,true) from solo_fixture;
do $$
declare v_shop uuid := current_setting('solo_test.shop')::uuid; v_limits jsonb;
  v_before jsonb;
begin
  select resource_limits into v_limits from public.shop_public_plan_catalog()
  where plan_variant='solo_1' and billing_interval='monthly';
  if shop_private.plan_change_blockers(v_shop,v_limits) <> '[{"resource":"active_members","used":2,"limit":1,"excess":1}]'::jsonb then
    raise exception 'Solo downgrade did not include its pending invitation';
  end if;
  select to_jsonb(subscription) into v_before from public.subscriptions subscription
  join public.shop_memberships membership on membership.profile_id=subscription.profile_id
  where membership.shop_id=v_shop and membership.role='owner';
  begin
    update public.subscriptions set catalog_terms_id=(select catalog_terms_id
      from public.shop_public_plan_catalog() where plan_variant='solo_1' and billing_interval='monthly')
    where profile_id in (select profile_id from public.shop_memberships where shop_id=v_shop and role='owner');
    raise exception 'Solo 2 to Solo 1 bypassed reserved-seat downgrade blocker';
  exception when check_violation then
    if sqlerrm not like 'PLAN_RESOURCE_LIMIT_EXCEEDED:active_members:%' then raise; end if;
  end;
  if not exists (select 1 from public.subscriptions subscription
    where subscription.id=(v_before->>'id')::uuid and to_jsonb(subscription)=v_before) then
    raise exception 'blocked downgrade mutated the subscription';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub',staff_id::text,true) from solo_fixture;
set local role authenticated;
select public.accept_shop_invitation(gen_random_uuid(),current_setting('solo_test.code')::uuid);
reset role;
select extensions.is(shop_private.plan_change_blockers(current_setting('solo_test.shop')::uuid,
  (select resource_limits from public.shop_public_plan_catalog()
    where plan_variant='solo_1' and billing_interval='monthly')),
  '[{"resource":"active_members","used":2,"limit":1,"excess":1}]'::jsonb,
  'accepted active members also block Solo 2 to Solo 1 downgrade');
select extensions.is(shop_private.plan_resource_usage(current_setting('solo_test.shop')::uuid,'active_members'),
  2::bigint,'acceptance converts the reservation to a member without double counting');

-- Pin a synthetic historical subscription and run catalog reconciliation.
-- Neither historical catalog rows nor the pinned subscription may be changed.
create temporary table solo_history as select terms.id, to_jsonb(terms) snapshot
from public.plan_catalog_terms terms join public.plans plan on plan.id=terms.plan_id
where plan.slug='solo' and terms.catalog_generation < 3;
do $$
declare v_profile uuid; v_subscription uuid; v_before jsonb;
  v_portal uuid := (select id from public.portals where key='shop-crm');
begin
  insert into public.profiles(user_id,portal_id,display_name)
  select operator_id,v_portal,'Historical customer' from solo_fixture returning id into v_profile;
  insert into public.subscriptions(profile_id,plan_id,catalog_terms_id,status)
  select v_profile,plan_id,id,'active' from public.plan_catalog_terms
  where id=(select id from solo_history order by id limit 1) returning id into v_subscription;
  select to_jsonb(subscription) into v_before from public.subscriptions subscription where id=v_subscription;
  perform shop_private.reconcile_plan_catalog_v2();
  if (select to_jsonb(subscription) from public.subscriptions subscription where id=v_subscription) <> v_before
    or exists (select 1 from solo_history history join public.plan_catalog_terms terms on terms.id=history.id
      where to_jsonb(terms)<>history.snapshot) then raise exception 'historical snapshots were rewritten'; end if;
  begin
    update public.plan_catalog_terms set price_amount=1 where id=(select id from solo_history limit 1);
    raise exception 'historical catalog allowed mutation';
  exception when sqlstate '55000' then null;
  end;
end;
$$;
select extensions.pass('catalog reconciliation preserves historical subscription and immutable terms');
select * from extensions.finish();
rollback;
