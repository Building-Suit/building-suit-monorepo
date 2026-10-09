-- Run in a transaction on the disposable local Shop database; roll back fixtures.
create temporary table private_offer_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() other_id, gen_random_uuid() operator_id,
  gen_random_uuid() principal_id, gen_random_uuid() source_id, gen_random_uuid() binding_id,
  gen_random_uuid() environment_id, gen_random_uuid() offer_id, gen_random_uuid() blocked_offer_id,
  gen_random_uuid() expired_offer_id, gen_random_uuid() request_id,
  null::uuid shop_id, null::uuid other_shop_id, null::uuid notice_id,
  null::uuid blocked_notice_id, null::jsonb catalog_before;
grant select on private_offer_fixture to authenticated, service_role;
insert into auth.users (id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id || '@private-offer.invalid','x','authenticated','authenticated','{}'::jsonb,'{}'::jsonb,now(),now()
from (select owner_id id from private_offer_fixture union all select other_id from private_offer_fixture
  union all select operator_id from private_offer_fixture) users;
insert into public.platform_admins (user_id,role,display_name)
select operator_id,'operator','Private offer reviewer' from private_offer_fixture;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',owner_id::text,true) from private_offer_fixture;
update private_offer_fixture set shop_id = public.create_owner_shop('Private offer owner','team','mixed'::public.business_mode);
select set_config('request.jwt.claim.sub',other_id::text,true) from private_offer_fixture;
update private_offer_fixture set other_shop_id = public.create_owner_shop('Other offer owner','team','mixed'::public.business_mode);
select set_config('request.jwt.claim.sub',owner_id::text,true) from private_offer_fixture;
insert into public.products (shop_id,name,sale_price,created_by_profile_id)
select f.shop_id, name,10,profile.id from private_offer_fixture f
join public.profiles profile on profile.user_id = f.owner_id
cross join (values ('Offer product one'),('Offer product two')) products(name);
update private_offer_fixture set catalog_before = (select jsonb_agg(to_jsonb(c) order by c.slug,c.plan_variant,c.billing_interval)
  from public.shop_public_plan_catalog() c);
insert into public.shop_super_admin_integrations (id,source_binding_id,target_binding_id,target_environment_id,
  audience,key_id,allowed_operations,max_clock_skew_seconds,nonce_retention_seconds,valid_from,enabled)
select principal_id,source_id,binding_id,environment_id,'shop-suit:offers-test','private-offer-test',
  array['adapter.capabilities.read','shop.billing.command'],300,3600,clock_timestamp()-interval '1 minute',true
from private_offer_fixture;

do $$
begin
  if has_table_privilege('authenticated','public.shop_private_offers','select')
    or has_table_privilege('anon','public.shop_private_offer_redemptions','select')
    or has_function_privilege('anon',
      'public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text)','execute')
    or has_function_privilege('authenticated',
      'shop_private.register_private_offer(uuid,text,jsonb)','execute') then
    raise exception 'private offer authority exposed to browser roles';
  end if;
end;
$$;

-- Exercise the actual bridge, including its nonce, envelope, audit and retry path.
create function pg_temp.issue_private_offer(p_payload jsonb, p_request uuid default gen_random_uuid())
returns jsonb language plpgsql as $$
declare f private_offer_fixture; v_nonce uuid := gen_random_uuid(); v_envelope jsonb; v_digest text;
begin
  select * into f from private_offer_fixture;
  perform set_config('request.jwt.claim.role','service_role',true);
  perform set_config('request.jwt.claim.sub','',true);
  v_envelope := jsonb_build_object('protocolVersion','1.0','operationVersion','1.0',
    'operation','shop.billing.command','requestId',p_request,'correlationId',f.request_id,
    'sourceBindingId',f.source_id,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,
    'actor',jsonb_build_object('authorityBindingId',f.source_id,'subjectId',f.operator_id,
      'roleSnapshot','super-admin-operator','sessionId','offer-test'),
    'reason','Approved private commercial agreement',
    'payload',jsonb_build_object('action','register_private_offer','payload',p_payload));
  v_digest := encode(extensions.digest(v_envelope::text,'sha256'),'hex');
  perform public.shop_super_admin_bridge_accept_nonce(f.principal_id,'private-offer-test',v_nonce,p_request,
    extract(epoch from clock_timestamp())::bigint,v_digest);
  return public.shop_super_admin_bridge_invoke(f.principal_id,v_nonce,v_digest,v_envelope);
end;
$$;
create function pg_temp.offer_payload(p_id uuid, p_products integer, p_expiry timestamptz)
returns jsonb language sql as $$
select jsonb_build_object('offerId',p_id,'offerVersion',3,'shopId',f.shop_id,'recipientUserId',f.owner_id,
  'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id,'suit','shop-suit',
  'expiresAt',p_expiry,'planId',(select plan.id from public.plans plan join public.portals portal
    on portal.id=plan.portal_id where portal.key='shop-crm' and plan.slug='solo'),
  'displayName','Private annual agreement','billingInterval','annual','currency','EGP','priceAmount',123.45,
  'resourceLimits',jsonb_build_object('active_locations',1,'active_members',2,'active_products',p_products,
    'active_services',10,'active_customers',10,'active_suppliers',10)) from private_offer_fixture f;
$$;

do $$
declare f private_offer_fixture; v_payload jsonb; v_request uuid := gen_random_uuid(); v_result jsonb;
begin
  select * into f from private_offer_fixture;
  v_payload := pg_temp.offer_payload(f.offer_id,10,clock_timestamp()+interval '1 day');
  begin
    perform pg_temp.issue_private_offer(v_payload || '{"suit":"ledger-suit"}');
    raise exception 'wrong Suit accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' then raise; end if;
  end;
  begin
    perform pg_temp.issue_private_offer(v_payload || jsonb_build_object('targetEnvironmentId',gen_random_uuid()));
    raise exception 'wrong environment accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' then raise; end if;
  end;
  begin
    perform pg_temp.issue_private_offer(v_payload || '{"priceAmount":123.456}');
    raise exception 'rounded offer price accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_INVALID' then raise; end if;
  end;
  v_result := pg_temp.issue_private_offer(v_payload,v_request);
  if v_result #>> '{data,offerId}' <> f.offer_id::text then raise exception 'bridge registration failed'; end if;
  v_result := pg_temp.issue_private_offer(v_payload,v_request);
  if not (v_result ->> 'replayed')::boolean then raise exception 'registration retry mutated'; end if;
  begin
    perform pg_temp.issue_private_offer(v_payload || '{"priceAmount":120}',v_request);
    raise exception 'changed registration replay accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'SHOP_SUPER_ADMIN_IDEMPOTENCY_KEY_REUSED' then raise; end if;
  end;
  perform pg_temp.issue_private_offer(pg_temp.offer_payload(f.blocked_offer_id,1,clock_timestamp()+interval '1 day'));
  perform pg_temp.issue_private_offer(pg_temp.offer_payload(f.expired_offer_id,10,clock_timestamp()+interval '100 milliseconds'));
  perform pg_sleep(0.2);
end;
$$;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',owner_id::text,true) from private_offer_fixture;
set local role authenticated;
do $$
declare f private_offer_fixture; v_notice uuid;
begin
  select * into f from private_offer_fixture;
  begin
    perform public.platform_admin_billing_command(gen_random_uuid(),'register_private_offer',null,
      'Forged owner registration','{}');
    raise exception 'browser registration accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.redeem_shop_private_offer(gen_random_uuid(),f.expired_offer_id,3,f.shop_id,
      f.binding_id,f.environment_id,123.45,current_date,'Expired offer');
    raise exception 'expired offer accepted';
  exception when invalid_parameter_value then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_EXPIRED' then raise; end if;
  end;
  begin
    perform public.redeem_shop_private_offer(gen_random_uuid(),f.offer_id,4,f.shop_id,
      f.binding_id,f.environment_id,123.45,current_date,'Wrong version');
    raise exception 'wrong version accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' then raise; end if;
  end;
  begin
    perform public.redeem_shop_private_offer(gen_random_uuid(),f.offer_id,3,f.shop_id,
      f.binding_id,gen_random_uuid(),123.45,current_date,'Wrong environment');
    raise exception 'wrong environment redemption accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_BINDING_MISMATCH' then raise; end if;
  end;
  v_notice := public.redeem_shop_private_offer(f.request_id,f.offer_id,3,f.shop_id,
    f.binding_id,f.environment_id,120,current_date,'Offer payment');
  if public.redeem_shop_private_offer(f.request_id,f.offer_id,3,f.shop_id,
    f.binding_id,f.environment_id,120,current_date,'Offer payment') <> v_notice then
    raise exception 'exact redemption retry changed notice';
  end if;
  begin
    perform public.redeem_shop_private_offer(gen_random_uuid(),f.offer_id,3,f.shop_id,
      f.binding_id,f.environment_id,120,current_date,'Offer payment');
    raise exception 'second redemption accepted';
  exception when unique_violation then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_ALREADY_REDEEMED' then raise; end if;
  end;
  begin
    perform public.redeem_shop_private_offer(f.request_id,f.offer_id,3,f.shop_id,
      f.binding_id,f.environment_id,121,current_date,'Offer payment');
    raise exception 'changed payment replay accepted';
  exception when unique_violation then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub',other_id::text,true) from private_offer_fixture;
do $$
declare f private_offer_fixture;
begin
  select * into f from private_offer_fixture;
  begin
    perform public.redeem_shop_private_offer(gen_random_uuid(),f.blocked_offer_id,3,f.other_shop_id,
      f.binding_id,f.environment_id,123.45,current_date,'Stolen offer');
    raise exception 'wrong recipient accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' then raise; end if;
  end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub',owner_id::text,true) from private_offer_fixture;
update private_offer_fixture set blocked_notice_id = public.redeem_shop_private_offer(gen_random_uuid(),
  blocked_offer_id,3,shop_id,binding_id,environment_id,123.45,current_date,'Blocked offer');
update private_offer_fixture set notice_id = (select submission_id from public.shop_private_offer_redemptions
  where offer_id = private_offer_fixture.offer_id);

-- Neither RLS reads nor public selection expose the newly appended private terms.
set local role anon;
do $$
begin
  if exists (select 1 from public.plan_catalog_terms where plan_variant='private_offer') then
    raise exception 'anonymous private terms disclosure';
  end if;
end;
$$;
reset role;
do $$
declare f private_offer_fixture; v_notice public.shop_billing_submissions; v_terms public.plan_catalog_terms;
begin
  select * into f from private_offer_fixture;
  if f.catalog_before is distinct from (select jsonb_agg(to_jsonb(c) order by c.slug,c.plan_variant,c.billing_interval)
    from public.shop_public_plan_catalog() c) then raise exception 'public catalog changed'; end if;
  select * into v_notice from public.shop_billing_submissions where id=f.notice_id;
  select * into v_terms from public.plan_catalog_terms where id=v_notice.catalog_terms_id;
  if v_notice.effective_price_amount <> 123.45 or v_notice.currency <> 'EGP'
    or v_notice.billing_interval_snapshot <> 'annual' or v_terms.private_offer_id <> f.offer_id
    or v_terms.is_public or v_terms.is_purchasable or v_notice.status <> 'submitted'
    or v_notice.resource_limits_snapshot is distinct from (select resource_limits from public.shop_private_offers where id=f.offer_id)
    or not exists (select 1 from public.subscriptions subscription join public.profiles profile
      on profile.id=subscription.profile_id where profile.user_id=f.owner_id and subscription.status='trialing') then
    raise exception 'offer snapshot/activation invariant failed';
  end if;
  begin
    update public.subscriptions subscription set catalog_terms_id=v_terms.id, plan_id=v_terms.plan_id
    from public.profiles profile where profile.id=subscription.profile_id and profile.user_id=f.owner_id;
    raise exception 'private subscription self-activation accepted';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_APPROVAL_REQUIRED' then raise; end if;
  end;
  begin
    update public.subscriptions subscription set catalog_terms_id=v_terms.id, plan_id=v_terms.plan_id
    from public.profiles profile where profile.id=subscription.profile_id and profile.user_id=f.other_id;
    raise exception 'private terms transplanted to another account';
  exception when insufficient_privilege then
    if sqlerrm <> 'SHOP_PRIVATE_OFFER_RECIPIENT_MISMATCH' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',f.other_id::text,true);
  begin
    perform public.submit_shop_billing_notice(gen_random_uuid(),f.other_shop_id,'solo',v_terms.id,123.45,current_date,'Private catalog purchase');
    raise exception 'private terms purchased through public billing';
  exception when invalid_parameter_value then
    if sqlerrm <> 'PLAN_UNAVAILABLE' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
  if not exists (select 1 from public.shop_super_admin_requests request
    join public.shop_private_offers offer on offer.integration_principal_id=request.integration_principal_id
      and request.target_resource_id=offer.shop_id
    where offer.id=f.offer_id and request.external_subject_id=f.operator_id
      and request.reason='Approved private commercial agreement') then
    raise exception 'private registration external audit missing';
  end if;
  begin
    update public.shop_billing_submissions set effective_price_amount=1 where id=f.notice_id;
    raise exception 'payment price snapshot mutated';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.plan_catalog_terms set price_amount=1 where id=v_terms.id;
    raise exception 'private catalog snapshot mutated';
  exception when object_not_in_prerequisite_state then null;
  end;
  begin
    update public.shop_private_offers set price_amount=1 where id=f.offer_id;
    raise exception 'offer mutated';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;
select set_config('request.jwt.claim.sub',operator_id::text,true) from private_offer_fixture;
set local role authenticated;
do $$
declare f private_offer_fixture; v_approval uuid := gen_random_uuid(); v_payload jsonb; v_result jsonb;
begin
  select * into f from private_offer_fixture;
  v_payload := jsonb_build_object('receivedAmount',123.45,'receivedReference','Bank confirmed offer','receivedDate',current_date);
  begin
    perform public.platform_admin_billing_command(gen_random_uuid(),'approve',f.blocked_notice_id,'Verified low-limit transfer',v_payload);
    raise exception 'over-limit private offer activated';
  exception when check_violation then
    if sqlerrm <> 'PLAN_CHANGE_BLOCKED' then raise; end if;
  end;
  begin
    perform public.platform_admin_billing_command(v_approval,'approve',f.notice_id,'Verified private transfer',v_payload);
    raise exception 'payment mismatch accepted without reason';
  exception when invalid_parameter_value then
    if sqlerrm <> 'BILLING_AMOUNT_MISMATCH_OVERRIDE_REQUIRED' then raise; end if;
  end;
  v_payload := v_payload || '{"amountOverrideReason":"Verified short transfer explicitly accepted"}';
  perform public.platform_admin_billing_command(v_approval,'mark_under_review',f.notice_id,'Review private transfer','{}');
  v_approval := gen_random_uuid();
  perform public.platform_admin_billing_command(v_approval,'approve',f.notice_id,'Verified private transfer',v_payload);
  v_result := public.platform_admin_billing_command(v_approval,'approve',f.notice_id,'Verified private transfer',v_payload);
  if not (v_result ->> 'replayed')::boolean then raise exception 'approval retry changed period'; end if;
end;
$$;
reset role;
do $$
declare f private_offer_fixture; v_period public.subscription_commercial_periods;
begin
  select * into f from private_offer_fixture;
  select * into v_period from public.subscription_commercial_periods where billing_submission_id=f.notice_id;
  if v_period.id is null or v_period.price_amount <> 123.45 or v_period.currency <> 'EGP'
    or v_period.billing_interval <> 'annual' or v_period.period_end <> v_period.period_start + interval '1 year'
    or (select count(*) from public.subscription_commercial_periods where billing_submission_id=f.notice_id) <> 1
    or (select count(*) from public.products where shop_id=f.shop_id and is_active) <> 2
    or (select status from public.shop_billing_submissions where id=f.blocked_notice_id) <> 'submitted' then
    raise exception 'commercial period, quota rollback or data preservation failed';
  end if;
  begin
    update public.subscription_commercial_periods set price_amount=1 where id=v_period.id;
    raise exception 'commercial period mutated';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

-- Secure source-dependency acceptance: existing bridge / same redemption RPC.
create temporary table secure_offer_fixture as select gen_random_uuid() offer_id,
 gen_random_uuid() revoked_id,gen_random_uuid() expired_id,gen_random_uuid() request_id,
 null::text token,null::text revoked_token,null::text expired_token,null::uuid notice_id;
grant select on secure_offer_fixture to authenticated;
create function pg_temp.secure_dispatch(p_action text,p_payload jsonb,p_request uuid default gen_random_uuid())
returns jsonb language plpgsql as $$
declare f private_offer_fixture; nonce uuid:=gen_random_uuid(); envelope jsonb; digest text;
begin
 select * into f from private_offer_fixture;
 perform set_config('request.jwt.claim.role','service_role',true);
 perform set_config('request.jwt.claim.sub','',true);
 envelope:=jsonb_build_object('protocolVersion','1.0','operationVersion','1.0','operation','shop.billing.command',
 'requestId',p_request,'correlationId',f.request_id,'sourceBindingId',f.source_id,'targetBindingId',f.binding_id,
 'targetEnvironmentId',f.environment_id,'actor',jsonb_build_object('authorityBindingId',f.source_id,'subjectId',f.operator_id,
 'roleSnapshot','super-admin-operator','sessionId','secure-offer-test'),'reason','Reviewed secure offer source',
 'payload',jsonb_build_object('action',p_action,'payload',p_payload));
 digest:=encode(extensions.digest(envelope::text,'sha256'),'hex');
 perform public.shop_super_admin_bridge_accept_nonce(f.principal_id,'private-offer-test',nonce,p_request,
 extract(epoch from clock_timestamp())::bigint,digest);
 return public.shop_super_admin_bridge_invoke(f.principal_id,nonce,digest,envelope);
end $$;
do $$
declare f private_offer_fixture; s secure_offer_fixture; result jsonb; first_request uuid:=gen_random_uuid(); payload jsonb;
begin
 select * into f from private_offer_fixture;select * into s from secure_offer_fixture;
 payload:=pg_temp.offer_payload(s.offer_id,10,clock_timestamp()+interval '1 day')||'{"entitlements":{"appointments":true,"reports":false}}';
 result:=pg_temp.secure_dispatch('register_secure_private_offer',payload,first_request);
 update secure_offer_fixture set token=result#>>'{data,redemptionToken}';
 if result#>>'{data,redemptionToken}'!~'^[A-Za-z0-9_-]{43}$' then raise exception 'opaque token missing'; end if;
 result:=pg_temp.secure_dispatch('register_secure_private_offer',payload,first_request);
 if not(result->>'replayed')::boolean or result#>>'{data,redemptionToken}' is distinct from (select token from secure_offer_fixture) then
  raise exception 'issuance retry replaced token'; end if;
 begin
  perform pg_temp.secure_dispatch('register_secure_private_offer',payload||'{"entitlements":{"appointments":false}}',first_request);
  raise exception 'changed signed terms replay accepted';
 exception when invalid_parameter_value then if sqlerrm<>'SHOP_SUPER_ADMIN_IDEMPOTENCY_KEY_REUSED' then raise; end if;end;
 result:=pg_temp.secure_dispatch('register_secure_private_offer',pg_temp.offer_payload(s.revoked_id,10,clock_timestamp()+interval '1 day')||'{"entitlements":{}}');
 update secure_offer_fixture set revoked_token=result#>>'{data,redemptionToken}';
 payload:=jsonb_build_object('offerId',s.revoked_id,'offerVersion',3,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id);
 first_request:=gen_random_uuid();
 result:=pg_temp.secure_dispatch('revoke_secure_private_offer',payload,first_request);
 if result#>>'{data,state}'<>'revoked' then raise exception 'target revocation not committed'; end if;
 result:=pg_temp.secure_dispatch('revoke_secure_private_offer',payload,first_request);
 if not(result->>'replayed')::boolean then raise exception 'revocation retry mutated'; end if;
 result:=pg_temp.secure_dispatch('register_secure_private_offer',pg_temp.offer_payload(s.expired_id,10,clock_timestamp()+interval '100 milliseconds')||'{"entitlements":{}}');
 update secure_offer_fixture set expired_token=result#>>'{data,redemptionToken}';
 perform pg_sleep(0.2);
 if has_table_privilege('authenticated','public.shop_private_offer_security','select') or
 has_function_privilege('authenticated','shop_private.secure_offer_command(uuid,text,text,jsonb)','execute') or
 has_function_privilege('anon','public.redeem_shop_private_offer(uuid,uuid,integer,uuid,uuid,uuid,numeric,date,text,text)','execute') then
  raise exception 'secure offer authority exposed'; end if;
end $$;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',owner_id::text,true) from private_offer_fixture;
set local role authenticated;
do $$
declare f private_offer_fixture; s secure_offer_fixture; notice uuid;
begin
 select * into f from private_offer_fixture;select * into s from secure_offer_fixture;
 begin
  perform public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer');
  raise exception 'UUID path bypassed secure token';
 exception when insufficient_privilege then if sqlerrm<>'SHOP_PRIVATE_OFFER_TOKEN_REQUIRED' then raise; end if;end;
 begin
  perform public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer',repeat('x',43));
  raise exception 'wrong token accepted';
 exception when insufficient_privilege then if sqlerrm<>'SHOP_PRIVATE_OFFER_TOKEN_INVALID' then raise; end if;end;
 begin
  perform public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.shop_id,f.binding_id,gen_random_uuid(),123.45,current_date,'Secure transfer',s.token);
  raise exception 'wrong environment accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',f.other_id::text,true);
 begin
  perform public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.other_shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer',s.token);
  raise exception 'recipient transplant accepted';
 exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',f.owner_id::text,true);
 begin
  perform public.redeem_shop_private_offer(gen_random_uuid(),s.revoked_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Revoked transfer',s.revoked_token);
  raise exception 'revoked link accepted';
 exception when insufficient_privilege then if sqlerrm<>'SHOP_PRIVATE_OFFER_REVOKED' then raise; end if;end;
 begin
  perform public.redeem_shop_private_offer(gen_random_uuid(),s.expired_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Expired transfer',s.expired_token);
  raise exception 'expired link accepted';
 exception when invalid_parameter_value then if sqlerrm<>'SHOP_PRIVATE_OFFER_EXPIRED' then raise; end if;end;
 notice:=public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer',s.token);
 if notice is distinct from public.redeem_shop_private_offer(s.request_id,s.offer_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer',s.token) then
  raise exception 'secure redemption retry duplicated notice'; end if;
 begin
  perform public.redeem_shop_private_offer(gen_random_uuid(),s.offer_id,3,f.shop_id,f.binding_id,f.environment_id,123.45,current_date,'Secure transfer',s.token);
  raise exception 'one-time redemption accepted new request';
 exception when unique_violation then if sqlerrm<>'SHOP_PRIVATE_OFFER_ALREADY_REDEEMED' then raise; end if;end;
end $$;
reset role;
update secure_offer_fixture set notice_id=(select submission_id from public.shop_private_offer_redemptions where offer_id=secure_offer_fixture.offer_id);
do $$
declare s secure_offer_fixture;f private_offer_fixture;
begin
 select * into s from secure_offer_fixture;select * into f from private_offer_fixture;
 if (select offer_entitlements from public.shop_billing_submissions where id=s.notice_id)<>'{"appointments":true,"reports":false}'::jsonb then
  raise exception 'secure entitlement snapshot lost'; end if;
 begin
  update public.shop_billing_submissions set offer_entitlements='{}' where id=s.notice_id;
  raise exception 'entitlement snapshot mutated';
 exception when object_not_in_prerequisite_state then null;end;
 begin
  perform pg_temp.secure_dispatch('revoke_secure_private_offer',jsonb_build_object('offerId',s.offer_id,'offerVersion',3,'targetBindingId',f.binding_id,'targetEnvironmentId',f.environment_id));
  raise exception 'redeemed terms revoked destructively';
 exception when unique_violation then if sqlerrm<>'SHOP_PRIVATE_OFFER_ALREADY_REDEEMED' then raise; end if;end;
end $$;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub',operator_id::text,true) from private_offer_fixture;
set local role authenticated;
do $$
declare s secure_offer_fixture; request uuid:=gen_random_uuid(); result jsonb;
begin
 select * into s from secure_offer_fixture;
 perform public.platform_admin_billing_command(gen_random_uuid(),'mark_under_review',s.notice_id,'Review secure offer payment','{}');
 result:=public.platform_admin_billing_command(request,'approve',s.notice_id,'Confirmed secure offer payment',jsonb_build_object('receivedAmount',123.45,'receivedReference','Secure transfer','receivedDate',current_date));
 result:=public.platform_admin_billing_command(request,'approve',s.notice_id,'Confirmed secure offer payment',jsonb_build_object('receivedAmount',123.45,'receivedReference','Secure transfer','receivedDate',current_date));
 if not(result->>'replayed')::boolean then raise exception 'secure payment replay duplicated activation'; end if;
end $$;
reset role;
do $$
declare s secure_offer_fixture;
begin
 select * into s from secure_offer_fixture;
 if (select count(*) from public.subscription_commercial_periods where billing_submission_id=s.notice_id)<>1 or
 (select offer_entitlements from public.subscription_commercial_periods where billing_submission_id=s.notice_id)<>'{"appointments":true,"reports":false}'::jsonb then
 raise exception 'secure period snapshot or exactly-once activation failed';end if;
end $$;
