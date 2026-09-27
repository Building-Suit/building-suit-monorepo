-- LS-FIX-002 / FS-08: account renames and archival preserve the labels that
-- were attached to posted history, without changing journals or amounts.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table label_test_ids(key text primary key, id uuid not null);
create temp table label_test_before(key text primary key, value text not null);
grant all on label_test_ids, label_test_before to authenticated;

insert into auth.users(id, email, raw_user_meta_data, raw_app_meta_data)
values ('49000000-0000-4000-8000-000000000002', 'historical-labels@test.local', '{}', '{}');
select set_config(
  'request.jwt.claims',
  '{"sub":"49000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

insert into label_test_ids values
  ('org', public.create_organization('Historical label fixture', 'EGP'));
insert into label_test_ids values
  ('cash', public.create_account(
    (select id from label_test_ids where key = 'org'),
    'R02 Cash original', 'asset', 'bank', p_code => 'R100'
  )),
  ('revenue', public.create_account(
    (select id from label_test_ids where key = 'org'),
    'R02 Revenue original', 'revenue', 'service_revenue', p_code => 'R400'
  ));

insert into label_test_ids values (
  'mapping',
  public.schedule_account_financial_mapping(
    (select id from label_test_ids where key = 'org'),
    (select id from label_test_ids where key = 'revenue'),
    'profit_loss', 'operating_revenue', '2036-01-01',
    'R02 pinned historical-label fixture', gen_random_uuid()
  )
);

insert into label_test_ids values (
  'journal',
  public.create_adjustment(
    (select id from label_test_ids where key = 'org'),
    '2036-01-15',
    jsonb_build_array(
      jsonb_build_object(
        'account_id', (select id from label_test_ids where key = 'cash'),
        'side', 'debit', 'amount_minor', 12500
      ),
      jsonb_build_object(
        'account_id', (select id from label_test_ids where key = 'revenue'),
        'side', 'credit', 'amount_minor', 12500
      )
    ),
    'R02 historical label sale', 'R02-001'
  )
);
set constraints all immediate;

insert into label_test_before values
  ('transaction_digest', (
    select md5(string_agg(to_jsonb(t)::text, '' order by t.id))
    from public.transactions t
    where t.id = (select id from label_test_ids where key = 'journal')
  )),
  ('entry_digest', (
    select md5(string_agg(to_jsonb(e)::text, '' order by e.id))
    from public.transaction_entries e
    where e.transaction_id = (select id from label_test_ids where key = 'journal')
  )),
  ('mapping_digest', (
    select md5(to_jsonb(m)::text)
    from public.account_financial_mappings m
    where m.id = (select id from label_test_ids where key = 'mapping')
  ));

select is(
  (select name from public.report_profit_and_loss(
    (select id from label_test_ids where key = 'org'), '2036-01-01', '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'revenue')),
  'R02 Revenue original',
  'the pinned fixture starts with the original P&L label'
);
select is(
  (select name from public.report_balance_sheet(
    (select id from label_test_ids where key = 'org'), '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'cash')),
  'R02 Cash original',
  'the pinned fixture starts with the original Balance Sheet label'
);

select public.update_account(
  (select id from label_test_ids where key = 'revenue'),
  'R02 Revenue renamed', 'R400'
);
select public.update_account(
  (select id from label_test_ids where key = 'cash'),
  'R02 Cash renamed', 'R100'
);
select public.archive_account((select id from label_test_ids where key = 'revenue'));
select public.archive_account((select id from label_test_ids where key = 'cash'));

select is(
  (select name from public.accounts where id = (select id from label_test_ids where key = 'revenue')),
  'R02 Revenue renamed',
  'account management exposes the current renamed label'
);
select ok(
  (select bool_and(is_archived) from public.accounts
   where id in (
     (select id from label_test_ids where key = 'cash'),
     (select id from label_test_ids where key = 'revenue')
   )),
  'both accounts are archived after the historical journal was posted'
);
select is(
  (select count(*) from public.account_label_versions
   where account_id = (select id from label_test_ids where key = 'revenue')),
  2::bigint,
  'the rename adds one prospective immutable label version'
);

select is(
  (select name from public.report_profit_and_loss(
    (select id from label_test_ids where key = 'org'), '2036-01-01', '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'revenue')),
  'R02 Revenue original',
  'the historical P&L screen retains the original label after rename/archive'
);
select is(
  (select amount_minor from public.report_profit_and_loss(
    (select id from label_test_ids where key = 'org'), '2036-01-01', '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'revenue')),
  12500::bigint,
  'the historical P&L amount is unchanged'
);
select is(
  (select name from public.report_balance_sheet(
    (select id from label_test_ids where key = 'org'), '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'cash')),
  'R02 Cash original',
  'the historical Balance Sheet screen retains the original label'
);
select is(
  (select name from public.report_trial_balance(
    (select id from label_test_ids where key = 'org'), '2036-01-01', '2036-01-31'
  ) where account_id = (select id from label_test_ids where key = 'revenue')),
  'R02 Revenue original',
  'the historical Trial Balance screen retains the original label'
);
select ok(
  public.export_financial_report_csv(
    (select id from label_test_ids where key = 'org'),
    'profit_loss', '2036-01-01', '2036-01-31'
  ) like '%R02 Revenue original,125.00,EGP%',
  'the P&L export uses the same historical label and exact amount as the screen'
);
select ok(
  public.export_financial_report_csv(
    (select id from label_test_ids where key = 'org'),
    'profit_loss', '2036-01-01', '2036-01-31'
  ) not like '%R02 Revenue renamed%',
  'the current label does not silently restate the historical export'
);
select is(
  (select account_name from public.ledger_entries
   where transaction_id = (select id from label_test_ids where key = 'journal')
     and account_id = (select id from label_test_ids where key = 'revenue')),
  'R02 Revenue original',
  'the posted-line detail screen retains the original account label'
);
select is(
  (
    select row ->> 'account_name'
    from jsonb_array_elements(public.read_activity_journal(
      (select id from label_test_ids where key = 'org'),
      (select id from label_test_ids where key = 'journal')
    ) -> 'rows') row
    where row ->> 'account_id' = (select id::text from label_test_ids where key = 'revenue')
  ),
  'R02 Revenue original',
  'journal drill-down retains the original account label and link'
);

select is(
  (select md5(string_agg(to_jsonb(t)::text, '' order by t.id))
   from public.transactions t
   where t.id = (select id from label_test_ids where key = 'journal')),
  (select value from label_test_before where key = 'transaction_digest'),
  'rename/archive does not mutate the posted journal'
);
select is(
  (select md5(string_agg(to_jsonb(e)::text, '' order by e.id))
   from public.transaction_entries e
   where e.transaction_id = (select id from label_test_ids where key = 'journal')),
  (select value from label_test_before where key = 'entry_digest'),
  'rename/archive does not mutate posted entries or amounts'
);
select is(
  (select md5(to_jsonb(m)::text)
   from public.account_financial_mappings m
   where m.id = (select id from label_test_ids where key = 'mapping')),
  (select value from label_test_before where key = 'mapping_digest'),
  'the effective statement mapping remains byte-for-byte unchanged'
);
select is(
  (select count(*) from public.transaction_entries
   where transaction_id = (select id from label_test_ids where key = 'journal')),
  2::bigint,
  'the archived-account journal remains accessible through its stable links'
);
select is(
  (select sum(base_amount_minor) filter (where side = 'debit')
   from public.transaction_entries
   where transaction_id = (select id from label_test_ids where key = 'journal')),
  12500::numeric,
  'the exact debit amount remains intact'
);
select is(
  (select sum(base_amount_minor) filter (where side = 'credit')
   from public.transaction_entries
   where transaction_id = (select id from label_test_ids where key = 'journal')),
  12500::numeric,
  'the exact credit amount remains intact'
);

select * from finish();
rollback;
