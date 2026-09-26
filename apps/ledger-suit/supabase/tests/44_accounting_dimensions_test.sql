-- V2-IMP-012: controlled values, exact allocations, history, permissions, and reconciliation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table dim_ids(key text primary key,id uuid not null);
grant all on dim_ids to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('45000000-0000-4000-8000-000000000001','dimension-owner@test.local','{}','{}'),
 ('45000000-0000-4000-8000-000000000002','dimension-viewer@test.local','{}','{}'),
 ('45000000-0000-4000-8000-000000000003','dimension-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into dim_ids values('org',public.create_organization('Dimension fixture','EGP'));
insert into dim_ids values
 ('expense',public.create_account((select id from dim_ids where key='org'),'Dimension expense','expense','other_expense',p_code=>'DIM500')),
 ('cash',public.create_account((select id from dim_ids where key='org'),'Dimension cash','asset','cash',p_code=>'DIM100')),
 ('required',public.create_account((select id from dim_ids where key='org'),'Required dimension expense','expense','other_expense',p_code=>'DIM510'));
insert into dim_ids values
 ('cc_a',public.save_dimension_value((select id from dim_ids where key='org'),'cost_center','CC-A','Cairo','North office','45000000-0000-4000-8000-000000000101')),
 ('cc_b',public.save_dimension_value((select id from dim_ids where key='org'),'cost_center','CC-B','Alexandria',null,'45000000-0000-4000-8000-000000000102')),
 ('project',public.save_dimension_value((select id from dim_ids where key='org'),'project','PR-1','Implementation',null,'45000000-0000-4000-8000-000000000103'));
select is(public.save_dimension_value((select id from dim_ids where key='org'),'cost_center','CC-A','Cairo','North office','45000000-0000-4000-8000-000000000101'),
  (select id from dim_ids where key='cc_a'),'value creation retry returns the stable controlled value');

insert into dim_ids values('posted',public.create_draft_transaction(
  (select id from dim_ids where key='org'),'adjustment','2034-03-01',jsonb_build_array(
    jsonb_build_object('account_id',(select id from dim_ids where key='expense'),'side','debit','amount_minor',10000,
      'allocations',jsonb_build_array(
        jsonb_build_object('dimension_value_id',(select id from dim_ids where key='cc_a'),'amount_minor','6000','base_amount_minor','6000'),
        jsonb_build_object('dimension_value_id',(select id from dim_ids where key='cc_b'),'amount_minor','4000','base_amount_minor','4000'),
        jsonb_build_object('dimension_value_id',(select id from dim_ids where key='project'),'amount_minor','10000','base_amount_minor','10000'))),
    jsonb_build_object('account_id',(select id from dim_ids where key='cash'),'side','credit','amount_minor',10000)),
  p_description=>'Allocated journal',p_adjustment_reason=>'Dimension fixture',p_idempotency_key=>'dimension-posted'));
select public.post_transaction((select id from dim_ids where key='posted'));
select is((select count(*) from public.transaction_entry_dimension_allocations a join public.transaction_entries e on e.id=a.entry_id where e.transaction_id=(select id from dim_ids where key='posted')),3::bigint,'one line supports multiple allocations across both controlled dimensions');
select is((select sum(a.amount_minor) from public.transaction_entry_dimension_allocations a join public.transaction_entries e on e.id=a.entry_id where e.transaction_id=(select id from dim_ids where key='posted') and a.kind='cost_center'),10000::numeric,'multi-allocation sums exactly to the journal-line amount');
reset role;
select throws_ok(format('update public.transaction_entry_dimension_allocations set amount_minor=5999 where dimension_value_id=%L',(select id from dim_ids where key='cc_a')),
  '42501','POSTED_DIMENSIONS_IMMUTABLE','posted allocations cannot be rewritten');
set local role authenticated;

select is((public.report_by_accounting_dimension((select id from dim_ids where key='org'),'trial_balance','cost_center','2034-01-01','2034-12-31')->'reconciliation_difference'->>'period_debit_minor'),'0','assigned plus Unassigned debit reconciles to the unfiltered Trial Balance');
select is((public.report_by_accounting_dimension((select id from dim_ids where key='org'),'general_ledger','cost_center','2034-01-01','2034-12-31')->'reconciliation_difference'->>'period_credit_minor'),'0','assigned plus Unassigned credit reconciles to the unfiltered General Ledger');
select ok(exists(select 1 from jsonb_array_elements(public.report_by_accounting_dimension((select id from dim_ids where key='org'),'profit_loss','cost_center','2034-01-01','2034-12-31')->'groups') g where g->>'code'='UNASSIGNED'),'approved statement grouping always exposes explicit Unassigned');

select public.set_account_dimension_policy((select id from dim_ids where key='org'),(select id from dim_ids where key='required'),'project','required');
insert into dim_ids values('missing_required',public.create_draft_transaction(
  (select id from dim_ids where key='org'),'adjustment','2034-03-02',jsonb_build_array(
    jsonb_build_object('account_id',(select id from dim_ids where key='required'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select id from dim_ids where key='cash'),'side','credit','amount_minor',1000)),
  p_adjustment_reason=>'Required fixture'));
select throws_ok(format('select public.post_transaction(%L)',(select id from dim_ids where key='missing_required')),
  '23514',format('DIMENSION_REQUIRED: project is required for account %s',(select id from dim_ids where key='required')),'required account context rejects an unassigned new posting');
select throws_ok(format($sql$select public.create_draft_transaction(%L,'adjustment','2034-03-03',%L::jsonb,p_adjustment_reason=>'Over allocation')$sql$,
  (select id from dim_ids where key='org'),jsonb_build_array(
    jsonb_build_object('account_id',(select id from dim_ids where key='expense'),'side','debit','amount_minor',1000,'allocations',jsonb_build_array(
      jsonb_build_object('dimension_value_id',(select id from dim_ids where key='cc_a'),'amount_minor','700','base_amount_minor','700'),
      jsonb_build_object('dimension_value_id',(select id from dim_ids where key='cc_b'),'amount_minor','400','base_amount_minor','400'))),
    jsonb_build_object('account_id',(select id from dim_ids where key='cash'),'side','credit','amount_minor',1000))::text),
  '23514','DIMENSION_ALLOCATION_MISMATCH: cost_center allocation must equal journal line','over-allocation is rejected atomically');

select public.archive_dimension_value((select id from dim_ids where key='org'),(select id from dim_ids where key='cc_a'),'45000000-0000-4000-8000-000000000104');
select is((select count(*) from public.transaction_entry_dimension_allocations where dimension_value_id=(select id from dim_ids where key='cc_a')),1::bigint,'archiving preserves the posted historical reference');
insert into dim_ids values('reversal',public.reverse_transaction((select id from dim_ids where key='posted'),'Correct allocated journal','2034-03-02'));
select is((select count(*) from public.transaction_entry_dimension_allocations a join public.transaction_entries e on e.id=a.entry_id where e.transaction_id=(select id from dim_ids where key='reversal')),3::bigint,'reversal mirrors allocations even when a historical value is now inactive');
select is((public.report_by_accounting_dimension((select id from dim_ids where key='org'),'general_ledger','cost_center','2034-01-01','2034-12-31')->'reconciliation_difference'->>'period_debit_minor'),'0','original and reversal remain dimension-neutral and reconciled');
select throws_ok(format($sql$select public.create_draft_transaction(%L,'adjustment','2034-03-04',%L::jsonb,p_adjustment_reason=>'Inactive value')$sql$,
  (select id from dim_ids where key='org'),jsonb_build_array(
    jsonb_build_object('account_id',(select id from dim_ids where key='expense'),'side','debit','amount_minor',1000,'allocations',jsonb_build_array(
      jsonb_build_object('dimension_value_id',(select id from dim_ids where key='cc_a'),'amount_minor','1000','base_amount_minor','1000'))),
    jsonb_build_object('account_id',(select id from dim_ids where key='cash'),'side','credit','amount_minor',1000))::text),
  '23514','DIMENSION_VALUE_INACTIVE_OR_INVALID','inactive values cannot be used on new postings');

-- Legacy generic JSON remains evidence but is deliberately Unassigned.
insert into dim_ids values('legacy',public.create_draft_transaction((select id from dim_ids where key='org'),'adjustment','2034-03-05',jsonb_build_array(
  jsonb_build_object('account_id',(select id from dim_ids where key='expense'),'side','debit','amount_minor',500,'dimensions',jsonb_build_object('cost_center','untrusted-old-code')),
  jsonb_build_object('account_id',(select id from dim_ids where key='cash'),'side','credit','amount_minor',500)),p_adjustment_reason=>'Legacy dry run'));
select public.post_transaction((select id from dim_ids where key='legacy'));
select ok((public.read_dimension_workspace((select id from dim_ids where key='org'))->>'legacy_uncontrolled_count')::int>0,'workspace reports legacy JSON without assuming it is controlled');
select is((select count(*) from public.transaction_entry_dimension_allocations a join public.transaction_entries e on e.id=a.entry_id where e.transaction_id=(select id from dim_ids where key='legacy')),0::bigint,'legacy JSON is not converted into controlled allocations');

reset role;
insert into public.organization_members(organization_id,user_id,role,status) values
 ((select id from dim_ids where key='org'),'45000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_dimension_workspace(%L)',(select id from dim_ids where key='org')),'viewer can read dimension history and reports');
select throws_ok(format('select public.archive_dimension_value(%L,%L,%L)',(select id from dim_ids where key='org'),(select id from dim_ids where key='cc_b'),'45000000-0000-4000-8000-000000000105'),
  '42501','INSUFFICIENT_PERMISSION: dimensions.manage is required','viewer cannot maintain controlled values');
select set_config('request.jwt.claims','{"sub":"45000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.accounting_dimension_values),0::bigint,'RLS hides another tenant dimension values');
select throws_ok(format('select public.read_dimension_workspace(%L)',(select id from dim_ids where key='org')),
  '42501','TENANT_ACCESS_DENIED: not a member of this organization','foreign tenant cannot read dimension workspace');
select * from finish();
rollback;
