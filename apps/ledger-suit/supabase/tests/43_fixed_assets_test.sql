-- V2-IMP-011: acquisition-to-disposal, schedule, reconciliation, and corrections.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table asset_ids(key text primary key,id uuid not null);
create temp table asset_values(key text primary key,value text not null);
grant all on asset_ids,asset_values to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('44000000-0000-4000-8000-000000000001','asset-owner@test.local','{}','{}'),
 ('44000000-0000-4000-8000-000000000002','asset-viewer@test.local','{}','{}'),
 ('44000000-0000-4000-8000-000000000003','asset-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"44000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into asset_ids values('org',public.create_organization('Asset fixture','EGP'));
insert into asset_ids values
 ('cost',public.create_account((select id from asset_ids where key='org'),'Equipment cost','asset','equipment',p_code=>'FA100')),
 ('cash',public.create_account((select id from asset_ids where key='org'),'Asset cash','asset','cash',p_code=>'FA110')),
 ('depreciation',public.create_account((select id from asset_ids where key='org'),'Depreciation expense','expense','depreciation',p_code=>'FA500')),
 ('impairment',public.create_account((select id from asset_ids where key='org'),'Impairment expense','expense','other_expense',p_code=>'FA510')),
 ('gainloss',public.create_account((select id from asset_ids where key='org'),'Disposal gain loss','expense','other_expense',p_code=>'FA520'));
insert into asset_ids values('accumulated',public.create_account((select id from asset_ids where key='org'),'Accumulated depreciation','asset','equipment',p_code=>'FA101',p_normal_balance=>'credit',p_contra_account_id=>(select id from asset_ids where key='cost')));
insert into asset_ids values('acquisition',public.record_asset_purchase((select id from asset_ids where key='org'),120000,
 (select id from asset_ids where key='cost'),(select id from asset_ids where key='cash'),p_transaction_date=>'2034-01-01',p_description=>'Reviewed machine',p_reference=>'ACQ-1',p_idempotency_key=>'asset-acquisition'));
select is((select count(*) from public.fixed_assets where organization_id=(select id from asset_ids where key='org')),0::bigint,'historical acquisition journals are never inferred into the register');
insert into asset_values select 'financial_before',count(*)::text||':'||coalesce(sum(case when side='debit' then base_amount_minor else -base_amount_minor end),0)::text
 from public.transaction_entries where organization_id=(select id from asset_ids where key='org');
insert into asset_ids values('asset',public.register_fixed_asset(
 p_organization_id=>(select id from asset_ids where key='org'),p_asset_code=>'M-001',p_name=>'Machine',p_acquisition_transaction_id=>(select id from asset_ids where key='acquisition'),
 p_cost_account_id=>(select id from asset_ids where key='cost'),p_accumulated_depreciation_account_id=>(select id from asset_ids where key='accumulated'),
 p_depreciation_expense_account_id=>(select id from asset_ids where key='depreciation'),p_impairment_expense_account_id=>(select id from asset_ids where key='impairment'),p_gain_loss_account_id=>(select id from asset_ids where key='gainloss'),
 p_acquisition_cost_minor=>120000,p_acquisition_date=>'2034-01-01',p_in_service_date=>'2034-01-16',p_useful_life_months=>12,p_residual_value_minor=>12000,p_idempotency_key=>'register-M-001'));
select is((select count(*)::text||':'||coalesce(sum(case when side='debit' then base_amount_minor else -base_amount_minor end),0)::text from public.transaction_entries where organization_id=(select id from asset_ids where key='org')),
 (select value from asset_values where key='financial_before'),'additive register migration/registration preserves the pre-existing financial fingerprint');

select is(public.register_fixed_asset(
 p_organization_id=>(select id from asset_ids where key='org'),p_asset_code=>'M-001',p_name=>'Machine',p_acquisition_transaction_id=>(select id from asset_ids where key='acquisition'),
 p_cost_account_id=>(select id from asset_ids where key='cost'),p_accumulated_depreciation_account_id=>(select id from asset_ids where key='accumulated'),p_depreciation_expense_account_id=>(select id from asset_ids where key='depreciation'),
 p_impairment_expense_account_id=>(select id from asset_ids where key='impairment'),p_gain_loss_account_id=>(select id from asset_ids where key='gainloss'),p_acquisition_cost_minor=>120000,p_acquisition_date=>'2034-01-01',p_in_service_date=>'2034-01-16',p_useful_life_months=>12,p_residual_value_minor=>12000,p_idempotency_key=>'register-M-001'),
 (select id from asset_ids where key='asset'),'registration retry returns the stable asset identity');
select is((select acquisition_transaction_id from public.fixed_assets where id=(select id from asset_ids where key='asset')),(select id from asset_ids where key='acquisition'),'register traces to reviewed acquisition journal');
select is((select sum(depreciation_minor) from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='asset')),108000::numeric,'straight-line schedule allocates exact depreciable basis');
select is((select min(period_start) from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='asset')),'2034-01-16'::date,'capitalization starts on in-service date');
select is((select closing_book_value_minor from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='asset') order by period_end desc limit 1),12000::bigint,'schedule ends at residual value');

insert into asset_ids values('declining_acquisition',public.record_asset_purchase((select id from asset_ids where key='org'),60000,
 (select id from asset_ids where key='cost'),(select id from asset_ids where key='cash'),p_transaction_date=>'2034-01-02',p_description=>'Declining fixture',p_reference=>'ACQ-DB',p_idempotency_key=>'asset-acquisition-db'));
insert into asset_ids values('declining_asset',public.register_fixed_asset(
 p_organization_id=>(select id from asset_ids where key='org'),p_asset_code=>'M-DB',p_name=>'Declining machine',p_acquisition_transaction_id=>(select id from asset_ids where key='declining_acquisition'),
 p_cost_account_id=>(select id from asset_ids where key='cost'),p_accumulated_depreciation_account_id=>(select id from asset_ids where key='accumulated'),p_depreciation_expense_account_id=>(select id from asset_ids where key='depreciation'),p_impairment_expense_account_id=>(select id from asset_ids where key='impairment'),p_gain_loss_account_id=>(select id from asset_ids where key='gainloss'),
 p_acquisition_cost_minor=>60000,p_acquisition_date=>'2034-01-02',p_in_service_date=>'2034-01-10',p_useful_life_months=>24,p_residual_value_minor=>6000,p_method=>'declining_balance',p_declining_rate_basis_points=>2000,p_idempotency_key=>'register-M-DB'));
select is((select sum(depreciation_minor) from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='declining_asset')),54000::numeric,'declining-balance schedule also allocates exactly to approved residual');
do $$ declare s record; begin for s in select id,period_start from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='declining_asset') and period_end<'2035-01-01' order by period_start loop perform public.post_asset_depreciation((select id from asset_ids where key='org'),s.id,'post-db-'||s.period_start::text); end loop; end $$;
insert into asset_ids values('future_period',public.create_accounting_period((select id from asset_ids where key='org'),'2035-01-01','2035-12-31'));
insert into asset_ids values('policy_v2',public.change_asset_depreciation_policy((select id from asset_ids where key='org'),(select id from asset_ids where key='declining_asset'),'2035-01-01',5000,12,'straight_line',null,'Reviewed prospective estimate','policy-M-DB'));
select is((select effective_from from public.asset_policy_versions where id=(select id from asset_ids where key='policy_v2')),'2035-01-01'::date,'estimate/method change starts at the next open period');
select ok((select count(*)>0 from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='declining_asset') and status='superseded' and period_end>='2035-01-01'),'prospective change preserves superseded future schedule evidence');

insert into asset_ids select 'jan_schedule',id from public.asset_depreciation_schedule where asset_id=(select id from asset_ids where key='asset') order by period_start limit 1;
insert into asset_ids values('jan_depreciation',public.post_asset_depreciation((select id from asset_ids where key='org'),(select id from asset_ids where key='jan_schedule'),'post-jan'));
select is(public.post_asset_depreciation((select id from asset_ids where key='org'),(select id from asset_ids where key='jan_schedule'),'post-jan'),(select id from asset_ids where key='jan_depreciation'),'depreciation retry returns one journal');
select is((select count(*) from public.asset_events where asset_id=(select id from asset_ids where key='asset') and kind='depreciation' and event_date='2034-01-31'),1::bigint,'one depreciation event exists for the asset-period');
select is((select (asset->>'nbv_minor')::bigint from jsonb_array_elements(public.read_fixed_asset_workspace((select id from asset_ids where key='org'),'2034-01-31')->'assets') asset where asset->>'id'=(select id::text from asset_ids where key='asset')),
 (select closing_book_value_minor from public.asset_depreciation_schedule where id=(select id from asset_ids where key='jan_schedule')),'cost minus accumulated depreciation equals dated NBV');
select ok((select bool_and(variance_minor=0) from public.reconcile_fixed_assets((select id from asset_ids where key='org'),'2034-01-31')),'cost and accumulated-depreciation register balances reconcile to GL');

-- Explicit impairment is separately posted and visible; no silent cost rewrite.
insert into asset_ids values('impairment_event_tx',public.record_asset_impairment((select id from asset_ids where key='org'),(select id from asset_ids where key='asset'),'2034-01-31',1000,'Reviewed damage','impair-M-001'));
select is((select amount_minor from public.asset_events where transaction_id=(select id from asset_ids where key='impairment_event_tx')),1000::bigint,'explicit impairment reduces carrying amount with its own event');

-- Disposal posts all remaining daily-prorated depreciation through June 15,
-- clears cost/accumulated depreciation, and records the balancing gain/loss.
insert into asset_ids values('disposal',public.dispose_fixed_asset((select id from asset_ids where key='org'),(select id from asset_ids where key='asset'),'2034-06-15',70000,(select id from asset_ids where key='cash'),'Approved sale','dispose-M-001'));
select is((select status from public.fixed_assets where id=(select id from asset_ids where key='asset')),'disposed'::public.fixed_asset_status,'asset is disposed without deleting its register history');
select is((select sum(case when account_id=(select id from asset_ids where key='cost') and side='credit' then amount_minor else 0 end) from public.transaction_entries where transaction_id=(select id from asset_ids where key='disposal')),120000::numeric,'disposal removes original cost');
select is((select gain_loss_minor from public.asset_disposals where asset_id=(select id from asset_ids where key='asset')),
 (select proceeds_minor-carrying_value_minor from public.asset_disposals where asset_id=(select id from asset_ids where key='asset')),'disposal stores exact proceeds less carrying-value gain/loss');
select ok((select bool_and(variance_minor=0) from public.reconcile_fixed_assets((select id from asset_ids where key='org'),'2034-06-15')),'disposed register balances and cleared GL control accounts reconcile to zero');

insert into asset_ids select 'disposal_event',id from public.asset_events where transaction_id=(select id from asset_ids where key='disposal');
insert into asset_ids values('disposal_reversal',public.reverse_fixed_asset_event((select id from asset_ids where key='org'),(select id from asset_ids where key='disposal_event'),'2034-06-16','Sale cancelled','reverse-disposal'));
select is((select status from public.fixed_assets where id=(select id from asset_ids where key='asset')),'active'::public.fixed_asset_status,'linked disposal reversal restores active state without rewriting disposal');
select is((select count(*) from public.asset_events where reverses_event_id=(select id from asset_ids where key='disposal_event')),1::bigint,'correction retains one immutable reversal link');
insert into asset_ids select 'latest_depreciation_event',id from public.asset_events where asset_id=(select id from asset_ids where key='asset') and kind='depreciation' order by event_date desc limit 1;
select public.reverse_fixed_asset_event((select id from asset_ids where key='org'),(select id from asset_ids where key='latest_depreciation_event'),'2034-06-16','Correct final proration','reverse-final-depreciation');
select is((select count(*) from public.asset_depreciation_schedule replacement join public.asset_events original on original.schedule_id=replacement.replaces_schedule_id where original.id=(select id from asset_ids where key='latest_depreciation_event') and replacement.status='scheduled'),1::bigint,'depreciation correction preserves the original row and creates one replacement slot');

-- Acquisition correction uses the asset lifecycle, not generic reversal, and
-- a reviewed replacement has its own identity/journal while linking history.
insert into asset_ids values('correction_acquisition',public.record_asset_purchase((select id from asset_ids where key='org'),10000,
 (select id from asset_ids where key='cost'),(select id from asset_ids where key='cash'),p_transaction_date=>'2034-07-01',p_reference=>'ACQ-CORR',p_idempotency_key=>'asset-acquisition-correction'));
insert into asset_ids values('correction_asset',public.register_fixed_asset(
 p_organization_id=>(select id from asset_ids where key='org'),p_asset_code=>'M-OLD',p_name=>'Incorrect asset',p_acquisition_transaction_id=>(select id from asset_ids where key='correction_acquisition'),
 p_cost_account_id=>(select id from asset_ids where key='cost'),p_accumulated_depreciation_account_id=>(select id from asset_ids where key='accumulated'),p_depreciation_expense_account_id=>(select id from asset_ids where key='depreciation'),p_impairment_expense_account_id=>(select id from asset_ids where key='impairment'),p_gain_loss_account_id=>(select id from asset_ids where key='gainloss'),
 p_acquisition_cost_minor=>10000,p_acquisition_date=>'2034-07-01',p_in_service_date=>'2034-07-10',p_useful_life_months=>12,p_idempotency_key=>'register-M-OLD'));
select throws_ok(format('select public.reverse_transaction(%L,%L,%L)',(select id from asset_ids where key='correction_acquisition'),'bypass','2034-07-02'),
 '23514','ASSET_USE_LINKED_REVERSAL','generic journal reversal cannot bypass asset correction history');
insert into asset_ids select 'correction_acquisition_event',id from public.asset_events where asset_id=(select id from asset_ids where key='correction_asset') and kind='acquisition';
select public.reverse_fixed_asset_event((select id from asset_ids where key='org'),(select id from asset_ids where key='correction_acquisition_event'),'2034-07-02','Wrong asset details','reverse-M-OLD');
insert into asset_ids values('replacement_acquisition',public.record_asset_purchase((select id from asset_ids where key='org'),10000,
 (select id from asset_ids where key='cost'),(select id from asset_ids where key='cash'),p_transaction_date=>'2034-07-02',p_reference=>'ACQ-REPLACEMENT',p_idempotency_key=>'asset-acquisition-replacement'));
insert into asset_ids values('replacement_asset',public.register_fixed_asset(
 p_organization_id=>(select id from asset_ids where key='org'),p_asset_code=>'M-NEW',p_name=>'Corrected asset',p_acquisition_transaction_id=>(select id from asset_ids where key='replacement_acquisition'),
 p_cost_account_id=>(select id from asset_ids where key='cost'),p_accumulated_depreciation_account_id=>(select id from asset_ids where key='accumulated'),p_depreciation_expense_account_id=>(select id from asset_ids where key='depreciation'),p_impairment_expense_account_id=>(select id from asset_ids where key='impairment'),p_gain_loss_account_id=>(select id from asset_ids where key='gainloss'),
 p_acquisition_cost_minor=>10000,p_acquisition_date=>'2034-07-02',p_in_service_date=>'2034-07-10',p_useful_life_months=>12,p_replaces_asset_id=>(select id from asset_ids where key='correction_asset'),p_idempotency_key=>'register-M-NEW'));
select is((select replaces_asset_id from public.fixed_assets where id=(select id from asset_ids where key='replacement_asset')),(select id from asset_ids where key='correction_asset'),'replacement asset links the corrected original without rewriting it');

reset role;
insert into public.organization_members(organization_id,user_id,role,status) values((select id from asset_ids where key='org'),'44000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"44000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_fixed_asset_workspace(%L,%L)',(select id from asset_ids where key='org'),'2034-06-16'),'viewer can read register and audit history');
select throws_ok(format('select public.post_asset_depreciation(%L,%L,%L)',(select id from asset_ids where key='org'),(select id from asset_ids where key='jan_schedule'),'viewer-post'),'42501','INSUFFICIENT_PERMISSION: assets.depreciate is required','viewer cannot post depreciation');
select set_config('request.jwt.claims','{"sub":"44000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.fixed_assets),0::bigint,'RLS hides foreign asset registers');
select throws_ok(format('select public.read_fixed_asset_workspace(%L,%L)',(select id from asset_ids where key='org'),'2034-06-16'),'42501','TENANT_ACCESS_DENIED: not a member of this organization','foreign tenant cannot read asset workspace');
select * from finish();
rollback;
