-- V2-IMP-005: Control roles, bindings, trusted posting, adjustments, and reconciliation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create temp table control_ids (key text primary key, value uuid not null);
grant all on control_ids to authenticated;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '37000000-0000-4000-8000-000000000001',
  '00000000-0000-0000-8000-000000000000',
  'authenticated', 'authenticated', 'control-owner@test.local',
  extensions.crypt('password', extensions.gen_salt('bf')), now(), '{}', '{}', now(), now()
), (
  '37000000-0000-4000-8000-000000000002',
  '00000000-0000-0000-8000-000000000000',
  'authenticated', 'authenticated', 'control-viewer@test.local',
  extensions.crypt('password', extensions.gen_salt('bf')), now(), '{}', '{}', now(), now()
);

select set_config('request.jwt.claims',
  '{"sub":"37000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into control_ids values ('org', public.create_organization(
  'Control Contract Org', 'EGP', p_fiscal_year_start_month => 4::smallint));
reset role;
insert into public.organization_members (organization_id, user_id, role, status)
values ((select value from control_ids where key='org'),
  '37000000-0000-4000-8000-000000000002', 'viewer', 'active');
set local role authenticated;

insert into control_ids values
  ('ar', public.create_account((select value from control_ids where key='org'),
    'Domestic AR Control', 'asset', 'accounts_receivable', p_code=>'CTRL110',
    p_account_role=>'control', p_control_subledger_type=>'customer')),
  ('ap', public.create_account((select value from control_ids where key='org'),
    'Domestic AP Control', 'liability', 'accounts_payable', p_code=>'CTRL210',
    p_account_role=>'control', p_control_subledger_type=>'supplier')),
  ('ar_two', public.create_account((select value from control_ids where key='org'),
    'Foreign AR Control', 'asset', 'accounts_receivable', p_code=>'CTRL120',
    p_account_role=>'control', p_control_subledger_type=>'customer')),
  ('cash', public.create_account((select value from control_ids where key='org'),
    'Control Cash', 'asset', 'cash', p_code=>'CTRL100')),
  ('revenue', public.create_account((select value from control_ids where key='org'),
    'Control Revenue', 'revenue', 'service_revenue', p_code=>'CTRL400')),
  ('group', public.create_account((select value from control_ids where key='org'),
    'Control Asset Group', 'asset', 'other_asset', p_code=>'CTRL000', p_account_role=>'group'));

select is((select account_role from public.accounts where id=(select value from control_ids where key='ar')),
  'control', 'AR account has the explicit Control role');
select is((select subledger_type from public.control_account_bindings where account_id=(select value from control_ids where key='ar')),
  'customer'::public.control_subledger_type, 'AR Control is bound to customer subledger');
select is((select subledger_type from public.control_account_bindings where account_id=(select value from control_ids where key='ap')),
  'supplier'::public.control_subledger_type, 'AP Control is bound to supplier subledger');
select is((select count(*) from public.control_account_bindings where organization_id=(select value from control_ids where key='org') and subledger_type='customer'),
  2::bigint, 'multiple explicitly routed Controls may share one subledger type');
select is((select count(*) from public.control_account_bindings where account_id=(select value from control_ids where key='ar')),
  1::bigint, 'one Control account has exactly one binding');

select throws_ok(format($q$select public.create_account(%L,'Unbound','asset','accounts_receivable',p_account_role=>'control')$q$,
  (select value from control_ids where key='org')),
  '22023', 'CONTROL_BINDING_REQUIRED: choose a subledger type',
  'Control creation without a binding is rejected atomically');
select is((select count(*) from public.accounts where organization_id=(select value from control_ids where key='org') and name='Unbound'),
  0::bigint, 'failed creation leaves no orphan Control account');
select throws_ok(format($q$select public.create_account(%L,'Wrong AR','liability','accounts_payable',p_account_role=>'control',p_control_subledger_type=>'customer')$q$,
  (select value from control_ids where key='org')),
  '23514', 'CONTROL_ACCOUNT_INCOMPATIBLE: customer Control requires debit-normal Accounts Receivable asset',
  'customer binding rejects incompatible liability classification');
select throws_ok(format($q$select public.create_account(%L,'Wrong AP','asset','accounts_receivable',p_account_role=>'control',p_control_subledger_type=>'supplier')$q$,
  (select value from control_ids where key='org')),
  '23514', 'CONTROL_ACCOUNT_INCOMPATIBLE: supplier Control requires credit-normal Accounts Payable liability',
  'supplier binding rejects incompatible asset classification');

select throws_ok(format($q$select public.create_adjustment(%L,'2030-01-10',%L::jsonb,'Direct Control','ordinary adjustment')$q$,
  (select value from control_ids where key='org'), jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000))),
  '23514', 'ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE: use the linked subledger or privileged Control adjustment pathway',
  'ordinary manual adjustment cannot post to Control');
select throws_ok(format($q$select public.create_draft_transaction(%L,'adjustment','2030-01-10',%L::jsonb,p_description=>'spoof',p_adjustment_reason=>'spoof',p_source=>'control_adjustment',p_metadata=>%L::jsonb)$q$,
  (select value from control_ids where key='org'), jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000)),
    jsonb_build_object('trusted',true,'control_account_id',(select value from control_ids where key='ar'))),
  '23514', 'ACCOUNT_CONTROL_NOT_DIRECTLY_POSTABLE: use the linked subledger or privileged Control adjustment pathway',
  'spoofed source and metadata do not authorize a Control entry');
select throws_ok(format($q$select public.record_income(p_organization_id=>%L,p_amount_minor=>1000,p_destination_account_id=>%L,p_category_id=>%L,p_transaction_date=>'2030-01-10',p_description=>'wrapper bypass')$q$,
  (select value from control_ids where key='org'),
  (select value from control_ids where key='ar'),
  (select id from public.categories where organization_id=(select value from control_ids where key='org') and default_account_id=(select value from control_ids where key='revenue'))),
  '23514', null, 'a normal transaction wrapper cannot use Control as a destination');
select is((select count(*) from public.transactions where organization_id=(select value from control_ids where key='org')),
  0::bigint, 'rejected direct and spoofed postings have no journal side effects');

select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2030-01-15',%L::jsonb,'Missing reason','', 'reconciliation_case','REC-001','ctrl-missing-reason')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000))),
  '22023', 'INVALID_CONTROL_ADJUSTMENT: reason is required', 'Control adjustment requires a reason');
select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2030-01-15',%L::jsonb,'Missing ref','Reviewed', 'reconciliation_case','','ctrl-missing-ref')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000))),
  '22023', 'INVALID_CONTROL_ADJUSTMENT: reconciliation or subledger reference is required',
  'Control adjustment requires an explicit reference');

insert into control_ids values ('adjustment', public.create_control_adjustment(
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  '2030-01-15', jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000)),
  'AR reconciliation correction', 'Reviewed legacy variance',
  'reconciliation_case', 'REC-2030-001', 'ctrl-adjust-001'));
select is((select status from public.transactions where id=(select value from control_ids where key='adjustment')),
  'posted'::public.transaction_status, 'authorized Control adjustment posts one journal');
select is((select source from public.transactions where id=(select value from control_ids where key='adjustment')),
  'control_adjustment'::public.transaction_source, 'Journal Center source distinguishes the Control adjustment');
select is((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end)
  from public.transaction_entries where transaction_id=(select value from control_ids where key='adjustment')),
  0::numeric, 'Control adjustment uses the balanced shared ledger engine');
select is((select count(*) from public.control_adjustments where transaction_id=(select value from control_ids where key='adjustment')),
  1::bigint, 'one immutable Control-adjustment evidence row is linked');
select is((select reconciliation_reference from public.control_adjustments where transaction_id=(select value from control_ids where key='adjustment')),
  'REC-2030-001', 'evidence retains the structured reconciliation reference');
select is(public.create_control_adjustment(
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  '2030-01-15', jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000)),
  'AR reconciliation correction', 'Reviewed legacy variance',
  'reconciliation_case', 'REC-2030-001', 'ctrl-adjust-001'),
  (select value from control_ids where key='adjustment'), 'same-payload retry returns the original journal');
select is((select count(*) from public.transactions where idempotency_key='ctrl-adjust-001'),
  1::bigint, 'Control adjustment retry creates one journal');
select is((select count(*) from public.control_adjustments where idempotency_key='ctrl-adjust-001'),
  1::bigint, 'Control adjustment retry creates one evidence row');
select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2030-01-15',%L::jsonb,'Changed payload','Reviewed legacy variance','reconciliation_case','REC-2030-001','ctrl-adjust-001')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',1000),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1000))),
  '23505', 'IDEMPOTENCY_CONFLICT: key was already used for a different request',
  'same key with a changed Control-adjustment payload conflicts');

reset role;
select throws_ok(format('update public.control_account_bindings set subledger_type=%L where account_id=%L',
  'supplier',(select value from control_ids where key='ar')),
  '55000', 'IMMUTABLE_CONTROL_EVIDENCE: Control evidence is append-only',
  'Control binding cannot be changed after history');
set local role authenticated;
select throws_ok(format('update public.accounts set account_role=%L where id=%L',
  'posting',(select value from control_ids where key='ar')),
  '23514', 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning',
  'historical Control cannot become Posting');
select throws_ok(format('update public.accounts set account_role=%L where id=%L',
  'group',(select value from control_ids where key='ar')),
  '23514', 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning',
  'historical Control cannot become Group');

select is((select status from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-01-31') where control_account_id=(select value from control_ids where key='ar')),
  'unreconciled'::public.control_reconciliation_status,
  'real AR provider exposes the unmatched Control adjustment');
select is((select subledger_balance_minor from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-01-31') where control_account_id=(select value from control_ids where key='ar')),
  0::bigint, 'empty authoritative AR subledger has a real zero balance');
select is((select gl_balance_minor from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-01-31') where control_account_id=(select value from control_ids where key='ar')),
  1000::bigint, 'dated reconciliation derives the Control balance from posted GL entries');

reset role;
create or replace function app.control_subledger_balance(
  p_organization_id uuid, p_control_account_id uuid,
  p_subledger_type public.control_subledger_type, p_as_of_date date
)
returns table (provider_available boolean, balance_minor bigint, provider_reference text)
language sql stable security definer set search_path = '' as $$
  select true,
    case when p_as_of_date = date '2030-01-31' then 1000::bigint else 900::bigint end,
    'test-only-provider'::text;
$$;
revoke all on function app.control_subledger_balance(uuid,uuid,public.control_subledger_type,date)
  from public, anon, authenticated;
set local role authenticated;
select is((select status from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-01-31') where control_account_id=(select value from control_ids where key='ar')),
  'reconciled'::public.control_reconciliation_status, 'equal authoritative and GL balances reconcile');
select is((select variance_minor from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-02-28') where control_account_id=(select value from control_ids where key='ar')),
  100::bigint, 'variance equals GL Control balance minus authoritative provider balance');
select is((select status from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-02-28') where control_account_id=(select value from control_ids where key='ar')),
  'unreconciled'::public.control_reconciliation_status, 'nonzero unexplained variance remains unreconciled');
select public.explain_control_variance(
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  '2030-02-28', 'Provider cut-off timing reviewed', 'reconciliation_case', 'REC-2030-002');
select is((select status from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-02-28') where control_account_id=(select value from control_ids where key='ar')),
  'explained_variance'::public.control_reconciliation_status,
  'immutable evidence marks but does not hide an explained variance');
select is((select variance_minor from public.reconcile_control_accounts(
  (select value from control_ids where key='org'),'2030-02-28') where control_account_id=(select value from control_ids where key='ar')),
  100::bigint, 'explained variance remains numerically visible');

select set_config('request.jwt.claims',
  '{"sub":"37000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2030-03-01',%L::jsonb,'Viewer attempt','No authority','reconciliation_case','REC-X','viewer-control')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',100))),
  '42501', 'INSUFFICIENT_PERMISSION: transactions.adjust is required',
  'user without adjustment privileges is rejected');

select set_config('request.jwt.claims',
  '{"sub":"37000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
insert into control_ids values ('period', public.create_accounting_period(
  (select value from control_ids where key='org'),'2031-05-01','2031-05-31'));
select public.transition_accounting_period((select value from control_ids where key='period'),'soft_closed');
select lives_ok(format($q$select public.create_control_adjustment(%L,%L,'2031-05-10',%L::jsonb,'Soft-close Control adjustment','Dual privilege confirmed','reconciliation_case','REC-SOFT','ctrl-soft')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',50),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',50))),
  'authorized reasoned Control adjustment may post in Soft Closed');
select public.transition_accounting_period((select value from control_ids where key='period'),'hard_closed','Reviewed');
select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2031-05-11',%L::jsonb,'Hard-close Control adjustment','Must fail','reconciliation_case','REC-HARD','ctrl-hard')$q$,
  (select value from control_ids where key='org'), (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',50),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',50))),
  '42501', 'ACCOUNTING_PERIOD_HARD_CLOSED', 'Hard Closed has no Control-specific bypass');

select set_config('request.jwt.claims',
  '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.reconcile_control_accounts(
  (select id from public.organizations where name='Beta Supplies'),'2030-01-31')),
  0::bigint, 'another organization cannot inspect Control reconciliation rows');
select throws_ok(format($q$select public.create_control_adjustment(%L,%L,'2030-03-01',%L::jsonb,'Foreign account','Must fail','reconciliation_case','REC-FOREIGN','ctrl-foreign')$q$,
  (select id from public.organizations where name='Beta Supplies'),
  (select value from control_ids where key='ar'),
  jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='ar'),'side','debit','amount_minor',100),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',100))),
  '23514', 'CONTROL_BINDING_MISMATCH: Control account is not bound in this organization',
  'foreign organization cannot use another tenant Control account');

select set_config('request.jwt.claims',
  '{"sub":"37000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok(format($q$select public.create_draft_transaction(%L,'adjustment','2030-03-01',%L::jsonb,p_description=>'Group attempt',p_adjustment_reason=>'Must fail')$q$,
  (select value from control_ids where key='org'), jsonb_build_array(
    jsonb_build_object('account_id',(select value from control_ids where key='group'),'side','debit','amount_minor',1),
    jsonb_build_object('account_id',(select value from control_ids where key='cash'),'side','credit','amount_minor',1))),
  '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account',
  'Group accounts remain non-postable at the entry boundary');
select is((select account_role from public.accounts where id=(select value from control_ids where key='group')),
  'group', 'Group role remains intact');
select is((select account_role from public.accounts where id=(select value from control_ids where key='cash')),
  'posting', 'ordinary Posting role remains intact');
select is((select closing_debit_minor from public.report_trial_balance(
  (select value from control_ids where key='org'),'2030-01-01','2030-01-31')
  where account_id=(select value from control_ids where key='ar')),
  '1000', 'Control is a real GL account in Trial Balance');

select * from finish();
rollback;
