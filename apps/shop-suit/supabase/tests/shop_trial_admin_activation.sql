-- Disposable fixtures only. Exercise durable target guards, never hosted accounts.
create temporary table trial_activation_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() operator_id, gen_random_uuid() outsider_id,
  gen_random_uuid() other_owner_id;
grant select on trial_activation_fixture to authenticated;
insert into auth.users(id,email,encrypted_password,aud,role,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,id||'@trial-activation.invalid','x','authenticated','authenticated','{}','{}',now(),now()
from trial_activation_fixture f cross join lateral unnest(array[f.owner_id,f.operator_id,f.outsider_id,f.other_owner_id]) id;
insert into public.platform_admins(user_id,role,display_name)
select operator_id,'operator','Trial activation test' from trial_activation_fixture;

select set_config('request.jwt.claim.sub',owner_id::text,true),
  set_config('request.jwt.claim.role','authenticated',true) from trial_activation_fixture;
set local role authenticated;
select set_config('trial_activation.shop',public.create_owner_shop('Trial activation fixture','team','mixed')::text,true);
select set_config('request.jwt.claim.sub',other_owner_id::text,true) from trial_activation_fixture;
select set_config('trial_activation.other_shop',public.create_owner_shop('Other tenant trial fixture','team','mixed')::text,true);
reset role;

do $$
declare
  f trial_activation_fixture; shop uuid := current_setting('trial_activation.shop')::uuid;
  subscription public.subscriptions; after_value public.subscriptions;
  other_subscription public.subscriptions;
  selected_plan uuid; activation_request_id uuid; result_value jsonb; day_value integer;
  billing_count bigint; payment_count bigint; trial_start timestamptz; trial_end timestamptz;
begin
  select * into f from trial_activation_fixture;
  select s.* into subscription from public.subscriptions s join public.shop_memberships m on m.profile_id=s.profile_id
    where m.shop_id=shop and m.role='owner';
  select id into selected_plan from public.plans where slug='team';
  select s.* into other_subscription from public.subscriptions s join public.shop_memberships m on m.profile_id=s.profile_id
    where m.shop_id=current_setting('trial_activation.other_shop')::uuid and m.role='owner';
  select count(*) into billing_count from public.platform_billing_events;
  select count(*) into payment_count from public.shop_billing_submissions;

  perform set_config('request.jwt.claim.sub',f.outsider_id::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform public.platform_plan_command(gen_random_uuid(),'activate_trial','Untrusted early activation',selected_plan,shop,
      jsonb_build_object('subscriptionId',subscription.id));
    raise exception 'outsider activation accepted';
  exception when insufficient_privilege then null; end;

  perform set_config('request.jwt.claim.sub',f.operator_id::text,true);
  for day_value in 1..6 loop
    if day_value not in (1,6) then continue; end if;
    trial_start := clock_timestamp()-make_interval(days=>day_value-1);
    trial_end := trial_start+interval '7 days';
    perform set_config('shop.billing_approval','approved',true);
    update public.subscriptions set status='trialing',trial_start_at=trial_start,trial_end_at=trial_end,
      current_period_start=null,current_period_end=null where id=subscription.id;
    activation_request_id := gen_random_uuid();
    begin
      perform public.platform_plan_command(gen_random_uuid(),'activate_trial','Wrong tenant subscription selection',selected_plan,shop,
        jsonb_build_object('subscriptionId',other_subscription.id));
      raise exception 'mismatched subscription accepted';
    exception when invalid_parameter_value then null; end;
    result_value := public.platform_plan_command(activation_request_id,'activate_trial','Owner approved early activation',selected_plan,shop,
      jsonb_build_object('subscriptionId',subscription.id));
    select * into after_value from public.subscriptions where id=subscription.id;
    if after_value.status<>'active' or after_value.plan_id<>selected_plan
      or after_value.trial_start_at is distinct from trial_start or after_value.trial_end_at is distinct from trial_end
      or after_value.current_period_start < now() or after_value.current_period_start > clock_timestamp()
      or after_value.current_period_end <> after_value.current_period_start+interval '1 month' then
      raise exception 'day % activation changed history or incorrect entitlement/dates',day_value;
    end if;
    if (public.platform_plan_command(activation_request_id,'activate_trial','Owner approved early activation',selected_plan,shop,
      jsonb_build_object('subscriptionId',subscription.id))->>'replayed')::boolean is distinct from true then
      raise exception 'exact retry failed';
    end if;
    begin
      perform public.platform_plan_command(activation_request_id,'activate_trial','Changed reason on reused key',selected_plan,shop,
        jsonb_build_object('subscriptionId',subscription.id));
      raise exception 'changed-input replay accepted';
    exception when invalid_parameter_value then null; end;
    begin
      perform public.platform_plan_command(gen_random_uuid(),'activate_trial','Attempt overwrite active subscription',selected_plan,shop,
        jsonb_build_object('subscriptionId',subscription.id));
      raise exception 'active subscription overwritten';
    exception when check_violation then null; end;
    if (select count(*) from public.platform_plan_events e where e.request_id=activation_request_id and e.action='activate_trial'
      and e.actor_user_id=f.operator_id and e.reason='Owner approved early activation')<>1 then
      raise exception 'activation audit not exactly once';
    end if;
  end loop;
  if (select to_jsonb(s) from public.subscriptions s where s.id=other_subscription.id) is distinct from to_jsonb(other_subscription) then
    raise exception 'cross-tenant activation changed the other subscription';
  end if;
  if (select email_confirmed_at from auth.users where id=f.owner_id) is not null then
    raise exception 'activation auto-confirmed owner email';
  end if;
  if (select count(*) from public.platform_billing_events)<>billing_count
    or (select count(*) from public.shop_billing_submissions)<>payment_count then
    raise exception 'activation fabricated payment evidence';
  end if;
end $$;
