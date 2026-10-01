-- SS-HOT-PUBLIC-LEGAL-001: protected anonymous and authenticated support intake.
create temporary table shop_support_fixture as
select gen_random_uuid() as owner_id;
grant select on shop_support_fixture to authenticated;

insert into auth.users (id, email, encrypted_password, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select owner_id, 'support-owner@example.test', 'x', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
from shop_support_fixture;

set local role anon;
do $$
declare v_result jsonb;
begin
  v_result := public.submit_support_request('general', ' Anonymous question ', ' Anonymous request body ', 'ANON-SUPPORT@example.test', true, '');
  if v_result ->> 'accepted' <> 'true' then raise exception 'anonymous request was not accepted'; end if;

  v_result := public.submit_support_request('technical', 'Bot question', 'Bot request body', 'bot-support@example.test', true, 'filled');
  if v_result ->> 'accepted' <> 'false' then raise exception 'honeypot request was not silently rejected'; end if;

  begin
    perform public.submit_support_request('general', 'Repeated question', 'Repeated request body', 'anon-support@example.test', true, '');
    raise exception 'rate limit did not reject repeated identity';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SUPPORT_RATE_LIMITED' then raise; end if;
  end;

  begin
    perform public.submit_support_request('unknown', 'Invalid category', 'Invalid request body', 'invalid@example.test', true, '');
    raise exception 'invalid category was accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'SUPPORT_REQUEST_INVALID' then raise; end if;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', owner_id::text, true),
  set_config('request.jwt.claim.role', 'authenticated', true),
  set_config('request.jwt.claim.email', 'support-owner@example.test', true)
from shop_support_fixture;
set local role authenticated;
do $$
declare v_shop uuid; v_result jsonb;
begin
  v_shop := public.create_owner_shop('Support fixture shop', 'team', 'mixed');
  v_result := public.submit_support_request('billing', 'Billing question', 'Authenticated request body', 'spoofed@example.test', true, '');
  if v_result ->> 'notification' <> 'not_configured' then raise exception 'delivery handoff state was not recorded'; end if;
end;
$$;
reset role;

do $$
begin
  if (select count(*) from public.support_requests) <> 2 then raise exception 'only human support submissions should persist'; end if;
  if not exists (
    select 1 from public.support_requests request
    where request.requester_email = 'anon-support@example.test'
      and request.requester_profile_id is null and request.shop_id is null
  ) then raise exception 'anonymous identity was not normalized'; end if;
  if not exists (
    select 1
    from public.support_requests request
    join public.profiles profile on profile.id = request.requester_profile_id
    join public.shop_memberships membership on membership.shop_id = request.shop_id and membership.profile_id = profile.id
    where profile.user_id = (select owner_id from shop_support_fixture)
      and request.requester_email = 'support-owner@example.test'
      and request.category = 'billing' and request.priority = 'high'
      and request.subject = 'Billing question' and request.customer_message = 'Authenticated request body'
  ) then raise exception 'authenticated request did not use trusted profile and shop context'; end if;
  if (select count(*) from public.support_notification_outbox where recipient = 'support@building-suit.com' and delivery_status = 'not_configured') <> 2 then
    raise exception 'notification handoff was not recorded for each human request';
  end if;
  if has_table_privilege('anon', 'public.support_requests', 'select')
    or has_table_privilege('authenticated', 'public.support_requests', 'select')
    or has_table_privilege('service_role', 'public.support_requests', 'select')
    or has_table_privilege('anon', 'public.support_notification_outbox', 'select')
  then raise exception 'private support tables are directly readable'; end if;
end;
$$;
