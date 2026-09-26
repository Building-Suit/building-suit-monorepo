-- LS-FIX-001: V2-D03 journal sequence semantics at the shared posting boundary.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table journal_sequence_ids(key text primary key, id uuid);
grant all on journal_sequence_ids to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '47000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'journal-sequences@ledgersuit.test',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb, '{"full_name":"Journal Sequences"}'::jsonb,
  now(), now()
), (
  '47000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'journal-sequences-beta@ledgersuit.test',
  extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider":"email"}'::jsonb, '{"full_name":"Journal Sequences Beta"}'::jsonb,
  now(), now()
);

select set_config(
  'request.jwt.claims',
  '{"sub":"47000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

insert into journal_sequence_ids values ('org_a', public.create_organization(
  'Journal Sequence Alpha', 'EGP', 'EG', 'Africa/Cairo',
  p_fiscal_year_start_month => 4::smallint
));
select set_config(
  'request.jwt.claims',
  '{"sub":"47000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
insert into journal_sequence_ids values ('org_b', public.create_organization(
  'Journal Sequence Beta', 'EGP', 'EG', 'Africa/Cairo',
  p_fiscal_year_start_month => 4::smallint
));

reset role;
insert into public.organization_members (organization_id, user_id, role, status)
values (
  (select id from journal_sequence_ids where key = 'org_b'),
  '47000000-0000-4000-8000-000000000001', 'accountant', 'active'
);
update public.subscriptions
set status = 'active', provider = 'paymob',
    provider_subscription_id = 'journal_sequence_' || organization_id::text,
    provider_status = 'active', billing_interval = 'monthly',
    checkout_completed_at = now(), current_period_start = now(),
    current_period_end = now() + interval '30 days'
where organization_id in (
  (select id from journal_sequence_ids where key = 'org_a'),
  (select id from journal_sequence_ids where key = 'org_b')
);
select app.seed_chart_of_accounts((select id from journal_sequence_ids where key = 'org_a'));
select app.seed_chart_of_accounts((select id from journal_sequence_ids where key = 'org_b'));

select set_config(
  'request.jwt.claims',
  '{"sub":"47000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
insert into journal_sequence_ids
select 'bank_a', id from public.accounts
where organization_id = (select id from journal_sequence_ids where key = 'org_a')
  and system_key = 'bank';
insert into journal_sequence_ids
select 'capital_a', id from public.accounts
where organization_id = (select id from journal_sequence_ids where key = 'org_a')
  and system_key = 'owner_capital';
insert into journal_sequence_ids
select 'bank_b', id from public.accounts
where organization_id = (select id from journal_sequence_ids where key = 'org_b')
  and system_key = 'bank';
insert into journal_sequence_ids
select 'capital_b', id from public.accounts
where organization_id = (select id from journal_sequence_ids where key = 'org_b')
  and system_key = 'owner_capital';

insert into journal_sequence_ids values ('draft', public.create_draft_transaction(
  (select id from journal_sequence_ids where key = 'org_a'),
  'adjustment', date '2025-04-01',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 100),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 100)
  ), p_description => 'Number only after posting',
  p_adjustment_reason => 'LS-FIX-001 fixture'
));

select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'draft')),
  null::text,
  'drafts do not have successful journal numbers'
);

select public.post_transaction((select id from journal_sequence_ids where key = 'draft'));
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'draft')),
  'JRN-2026-000001',
  'the first journal uses the fiscal-year ending label and first scoped number'
);

insert into journal_sequence_ids values ('retry_original', public.create_adjustment(
  (select id from journal_sequence_ids where key = 'org_a'), date '2025-04-02',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 200),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 200)
  ), 'Idempotent journal', 'LS-FIX-001 fixture',
  p_idempotency_key => 'journal-sequence-retry'
));
insert into journal_sequence_ids values ('retry_equal', public.create_adjustment(
  (select id from journal_sequence_ids where key = 'org_a'), date '2025-04-02',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 200),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 200)
  ), 'Idempotent journal', 'LS-FIX-001 fixture',
  p_idempotency_key => 'journal-sequence-retry'
));

select is(
  (select id from journal_sequence_ids where key = 'retry_equal'),
  (select id from journal_sequence_ids where key = 'retry_original'),
  'equal retry returns the original journal'
);
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'retry_original')),
  'JRN-2026-000002',
  'equal retry consumes only one scoped number'
);

insert into journal_sequence_ids values ('prior_year', public.create_adjustment(
  (select id from journal_sequence_ids where key = 'org_a'), date '2025-03-31',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 300),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 300)
  ), 'Prior fiscal year', 'LS-FIX-001 fixture'
));
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'prior_year')),
  'JRN-2025-000001',
  'the sequence resets at the configured fiscal-year boundary'
);

insert into journal_sequence_ids values ('other_org', public.create_adjustment(
  (select id from journal_sequence_ids where key = 'org_b'), date '2025-04-01',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_b'), 'side', 'debit', 'amount_minor', 400),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_b'), 'side', 'credit', 'amount_minor', 400)
  ), 'Other organization', 'LS-FIX-001 fixture'
));
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'other_org')),
  'JRN-2026-000001',
  'each organization has an independent fiscal-year sequence'
);

insert into journal_sequence_ids values ('reversal', public.reverse_transaction(
  (select id from journal_sequence_ids where key = 'retry_original'),
  'LS-FIX-001 reversal identity', date '2025-04-03'
));
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'reversal')),
  'JRN-2026-000003',
  'a reversal receives its own next journal number'
);
select is(
  (select reverses_transaction_id from public.transactions where id = (select id from journal_sequence_ids where key = 'reversal')),
  (select id from journal_sequence_ids where key = 'retry_original'),
  'the reversal retains its original-journal link'
);

insert into journal_sequence_ids values ('void_draft', public.create_draft_transaction(
  (select id from journal_sequence_ids where key = 'org_a'),
  'adjustment', date '2025-04-04',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 500),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 500)
  ), p_description => 'Void without number',
  p_adjustment_reason => 'LS-FIX-001 fixture'
));
select public.void_transaction((select id from journal_sequence_ids where key = 'void_draft'), 'fixture void');
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'void_draft')),
  null::text,
  'an unposted void never receives a successful journal number'
);

reset role;
update app.journal_number_sequences
set last_number = 999999
where organization_id = (select id from journal_sequence_ids where key = 'org_a')
  and fiscal_year_start = date '2025-04-01';
set local role authenticated;

insert into journal_sequence_ids values ('overflow_draft', public.create_draft_transaction(
  (select id from journal_sequence_ids where key = 'org_a'),
  'adjustment', date '2025-04-05',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 600),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 600)
  ), p_description => 'Overflow must fail',
  p_adjustment_reason => 'LS-FIX-001 fixture'
));
select throws_ok(
  format('select public.post_transaction(%L)', (select id from journal_sequence_ids where key = 'overflow_draft')),
  '22003', null,
  'the six-digit scope fails closed instead of wrapping or reusing a number'
);
select is(
  (select status from public.transactions where id = (select id from journal_sequence_ids where key = 'overflow_draft')),
  'draft'::public.transaction_status,
  'an exhausted-sequence post remains a draft'
);
select is(
  (select journal_reference from public.transactions where id = (select id from journal_sequence_ids where key = 'overflow_draft')),
  null::text,
  'a failed post is not represented as a numbered journal'
);

select throws_ok(
  format('update public.transactions set journal_reference=%L where id=%L',
    'JRN-2026-999998', (select id from journal_sequence_ids where key = 'retry_original')),
  '42501', null,
  'a posted journal reference is immutable'
);

-- Build a valid posted adjustment before simulating its pre-migration identity.
-- Keep the required reason and balanced ledger lines under normal validation.
insert into journal_sequence_ids values ('legacy', public.create_adjustment(
  (select id from journal_sequence_ids where key = 'org_a'),
  date '2024-03-31',
  jsonb_build_array(
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'bank_a'), 'side', 'debit', 'amount_minor', 100),
    jsonb_build_object('account_id', (select id from journal_sequence_ids where key = 'capital_a'), 'side', 'credit', 'amount_minor', 100)
  ), 'Pre-repair legacy reference fixture', 'LS-FIX-001 legacy fixture'
));

reset role;
set constraints all immediate;
alter table public.transactions disable trigger transactions_assign_posted_journal_reference;
update public.transactions
set journal_reference = 'JRN-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
where id = (select id from journal_sequence_ids where key = 'legacy');
alter table public.transactions enable trigger transactions_assign_posted_journal_reference;
select is(
  (select journal_reference from public.transactions where description = 'Pre-repair legacy reference fixture'),
  'JRN-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  'legacy posted references remain readable without renumbering'
);

select * from finish();
rollback;
