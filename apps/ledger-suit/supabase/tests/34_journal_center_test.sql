begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table journal_ids(key text primary key, id uuid);
grant all on journal_ids to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
values
  ('34000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'journal-owner@ledgersuit.test',
   extensions.crypt('pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email"}'::jsonb, '{"full_name":"Journal Owner"}'::jsonb, now(), now()),
  ('34000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'journal-outsider@ledgersuit.test',
   extensions.crypt('pw', extensions.gen_salt('bf')), now(),
   '{"provider":"email"}'::jsonb, '{"full_name":"Journal Outsider"}'::jsonb, now(), now());

select set_config('request.jwt.claims', '{"sub":"34000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into journal_ids values ('org', public.create_organization('Journal Center Org', 'EGP', 'EG', 'Africa/Cairo'));
reset role;
update public.subscriptions
set status='active', provider='paymob', provider_subscription_id='journal_center_test',
    provider_status='active', billing_interval='monthly', checkout_completed_at=now(),
    current_period_start=now(), current_period_end=now()+interval '30 days'
where organization_id=(select id from journal_ids where key='org');
select app.seed_chart_of_accounts((select id from journal_ids where key='org'));
select app.seed_categories((select id from journal_ids where key='org'));
set local role authenticated;

insert into journal_ids
select 'bank', id from public.accounts
where organization_id=(select id from journal_ids where key='org') and system_key='bank';
insert into journal_ids
select 'equity', id from public.accounts
where organization_id=(select id from journal_ids where key='org') and system_key='owner_capital';
insert into journal_ids
select 'rent', id from public.accounts
where organization_id=(select id from journal_ids where key='org') and system_key='rent';

insert into journal_ids values ('original', public.create_adjustment(
  (select id from journal_ids where key='org'), date '2026-09-01',
  jsonb_build_array(
    jsonb_build_object('account_id',(select id from journal_ids where key='bank'),'side','debit','amount_minor',12500),
    jsonb_build_object('account_id',(select id from journal_ids where key='equity'),'side','credit','amount_minor',12500)
  ), 'Journal center adjustment', 'V2-IMP-003', p_idempotency_key=>'journal-center-replay'
));

insert into journal_ids values ('replay', public.create_adjustment(
  (select id from journal_ids where key='org'), date '2026-09-01',
  jsonb_build_array(
    jsonb_build_object('account_id',(select id from journal_ids where key='bank'),'side','debit','amount_minor',12500),
    jsonb_build_object('account_id',(select id from journal_ids where key='equity'),'side','credit','amount_minor',12500)
  ), 'Journal center adjustment', 'V2-IMP-003', p_idempotency_key=>'journal-center-replay'
));

select is((select id from journal_ids where key='replay'), (select id from journal_ids where key='original'), 'Idempotent replay resolves to one journal');
select ok((select journal_reference from public.transactions where id=(select id from journal_ids where key='original')) like 'JRN-%', 'Every journal has an accountant-facing immutable reference');
select is((select length(journal_reference) from public.transactions where id=(select id from journal_ids where key='original')), 36, 'Opaque journal reference retains the full collision-safe UUID payload');

insert into journal_ids values ('second', public.create_adjustment(
  (select id from journal_ids where key='org'), date '2026-09-02',
  jsonb_build_array(
    jsonb_build_object('account_id',(select id from journal_ids where key='bank'),'side','debit','amount_minor',500),
    jsonb_build_object('account_id',(select id from journal_ids where key='equity'),'side','credit','amount_minor',500)
  ), 'Second journal', 'V2-IMP-003 second'
));
select isnt((select journal_reference from public.transactions where id=(select id from journal_ids where key='original')), (select journal_reference from public.transactions where id=(select id from journal_ids where key='second')), 'Separate journals cannot share a reference');

create temp table journal_search as
select * from public.search_transactions(
  (select id from journal_ids where key='org'),
  p_search=>'JRN-', p_from_date=>'2026-09-01', p_to_date=>'2026-09-01',
  p_types=>array['adjustment']::public.transaction_type[],
  p_statuses=>array['posted']::public.transaction_status[],
  p_account_ids=>array[(select id from journal_ids where key='bank')],
  p_sources=>array['manual']::public.transaction_source[]
);
select is((select count(*) from journal_search), 1::bigint, 'Date, account, type, source, status and journal-reference search compose server-side');
select is((select debit_minor from journal_search), 12500::bigint, 'Journal debit total comes from actual lines');
select is((select credit_minor from journal_search), 12500::bigint, 'Journal credit total comes from actual lines');
select is((select base_debit_minor from journal_search), (select base_credit_minor from journal_search), 'Base-currency journal totals reconcile');

insert into journal_ids values ('reversal', public.reverse_transaction((select id from journal_ids where key='original'), 'Focused reversal test', date '2026-09-03'));
select is((select reversed_by_transaction_id from public.transaction_summaries where id=(select id from journal_ids where key='original')), (select id from journal_ids where key='reversal'), 'Original points to its reversal');
select is((select reverses_transaction_id from public.transaction_summaries where id=(select id from journal_ids where key='reversal')), (select id from journal_ids where key='original'), 'Reversal points back to the original');
select is((select source from public.transaction_summaries where id=(select id from journal_ids where key='reversal')), 'reversal'::public.transaction_source, 'Reversal keeps its actual source');
select isnt((select journal_reference from public.transactions where id=(select id from journal_ids where key='reversal')), (select journal_reference from public.transactions where id=(select id from journal_ids where key='original')), 'Reversal receives its own stable identity');

insert into journal_ids values ('commitment', public.create_commitment(
  (select id from journal_ids where key='org'), 'scheduled_expense', 'Journal center rent',
  700, date '2026-09-04', p_linked_account_id=>(select id from journal_ids where key='rent')
));
insert into journal_ids values ('commitment_journal', public.settle_commitment(
  (select id from journal_ids where key='commitment'), (select id from journal_ids where key='bank'),
  p_settled_on=>date '2026-09-04'
));
select is((select source from public.transaction_summaries where id=(select id from journal_ids where key='commitment_journal')), 'commitment'::public.transaction_source, 'Commitment journal exposes its generated source');
select is((select source_record_kind from public.transaction_summaries where id=(select id from journal_ids where key='commitment_journal')), 'commitment', 'Commitment journal exposes an actual source record kind');
select is((select source_record_parent_id from public.transaction_summaries where id=(select id from journal_ids where key='commitment_journal')), (select id from journal_ids where key='commitment'), 'Commitment journal links to the authorized source record');

insert into public.saved_views(organization_id,name,resource,filters,sort,created_by)
values ((select id from journal_ids where key='org'),'September adjustments','journal_center',
  '{"from":"2026-09-01","type":"adjustment","source":"manual"}',
  '{"column":"transaction_date","direction":"desc"}', auth.uid());
select is((select count(*) from public.saved_views where resource='journal_center'), 1::bigint, 'Owner can save validated private Journal Center state');
select throws_ok(
  format($sql$insert into public.saved_views(organization_id,name,resource,filters,sort,created_by) values (%L,'Invalid','journal_center','{"sql":"drop table x"}','{"column":"unsafe","direction":"desc"}',%L)$sql$,
    (select id from journal_ids where key='org'), auth.uid()),
  '23514', null, 'Saved views reject unrecognized executable/query-builder state'
);

reset role;
select set_config('request.jwt.claims', '{"sub":"34000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.saved_views), 0::bigint, 'Unrelated users cannot read private saved views');
select throws_ok(
  format('select * from public.search_transactions(%L)', (select id from journal_ids where key='org')),
  '42501', null, 'Unrelated users cannot search another organization journal stream'
);

select * from finish();
rollback;
