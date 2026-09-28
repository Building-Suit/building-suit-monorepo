-- Disposable local fixtures only; no hosted database execution.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users(id,email,raw_user_meta_data) values
  ('f0000000-0000-4000-8000-000000000001','support-owner-one@example.test','{"full_name":"Support owner one"}'::jsonb),
  ('f0000000-0000-4000-8000-000000000002','support-owner-two@example.test','{"full_name":"Support owner two"}'::jsonb);

select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select is(
  public.submit_support_request('general',' Anonymous question ',' Anonymous request body ','ANON-SUPPORT@example.test',true,'')#>>'{accepted}',
  'true',
  'anonymous visitor can submit a support request'
);
select is(
  public.submit_support_request('technical','Bot question','Bot request body','bot-support@example.test',true,'filled')#>>'{accepted}',
  'false',
  'honeypot submission is accepted without persistence'
);
select throws_ok(
  $$select public.submit_support_request('general','Repeated question','Repeated request body','anon-support@example.test',true,'')$$,
  '42900',
  'SUPPORT_RATE_LIMITED',
  'reply identity is rate limited case-insensitively'
);
select throws_ok(
  $$select public.submit_support_request('unknown','Invalid category','Invalid request body','invalid-support@example.test',true,'')$$,
  '22023',
  'SUPPORT_REQUEST_INVALID',
  'invalid request input is rejected'
);
reset role;

select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok(
  $$select public.create_organization('Support tenant one','EGP')$$,
  'first authenticated requester can establish tenant context'
);
select is(
  public.submit_support_request('billing','Billing question','Authenticated request body','spoofed@example.test',true,'')#>>'{notification}',
  'not_configured',
  'authenticated request records the explicit delivery handoff state'
);
reset role;

select set_config('request.jwt.claims','{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok(
  $$select public.create_organization('Support tenant two','EGP')$$,
  'second authenticated requester can establish separate tenant context'
);
select ok(
  not has_table_privilege('authenticated','public.support_requests','SELECT')
    and not has_table_privilege('authenticated','public.support_notification_outbox','SELECT'),
  'tenant users cannot read support requests or notification outbox rows directly'
);
reset role;

select is(
  (select count(*) from public.support_requests),
  2::bigint,
  'only the anonymous and authenticated human submissions persist'
);
select is(
  (select requester_email::text from public.support_requests where requester_id is null),
  'anon-support@example.test',
  'anonymous reply identity is normalized'
);
select ok(
  exists(
    select 1
    from public.support_requests r
    join public.organization_members m on m.organization_id=r.organization_id and m.user_id=r.requester_id
    where r.requester_id='f0000000-0000-4000-8000-000000000001'
      and r.requester_email='support-owner-one@example.test'
      and r.category='billing'
      and r.priority='high'
      and r.subject='Billing question'
      and r.customer_message='Authenticated request body'
      and r.status='open'
  ),
  'authenticated request uses trusted profile and organization context'
);
select is(
  (select count(*) from public.support_notification_outbox where recipient='support@building-suit.com' and kind='new_request' and delivery_status='not_configured'),
  2::bigint,
  'each persisted request creates an auditable support notification handoff'
);
select ok(
  not has_table_privilege('anon','public.support_requests','SELECT')
    and not has_table_privilege('anon','public.support_notification_outbox','SELECT')
    and not has_table_privilege('service_role','public.support_requests','SELECT')
    and not has_table_privilege('service_role','public.support_notification_outbox','SELECT'),
  'support content remains private from anonymous and service-key table access'
);

select * from finish();
rollback;
