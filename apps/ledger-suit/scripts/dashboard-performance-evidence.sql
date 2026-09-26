-- LS-PERF-001 read-only reproduction probe. No migrations, seed, or history writes.
-- Run before/after on the SAME authorized synthetic database, with no intervening
-- postings; pass organization_id, actor_id, from_date, to_date, and after=true/false.
-- Save stdout separately for each phase. This script does NOT alter statement_timeout.
\set ON_ERROR_STOP on
begin read only;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'actor_id','role','authenticated')::text,true) as claims \gset
set local role authenticated;
select version(), current_setting('statement_timeout') as statement_timeout,
  current_setting('work_mem') as work_mem;
select count(*) as journals from public.transactions where organization_id=:'organization_id'::uuid;
select count(*) as posted_lines from public.transaction_entries
where organization_id=:'organization_id'::uuid and posted_at is not null;

-- One warm-up before each measured request; discard payload, execute the read.
select count(*) from public.dashboard_summary(:'organization_id'::uuid,:'to_date'::date);
explain (analyze,buffers,settings)
select public.dashboard_summary(:'organization_id'::uuid,:'to_date'::date);
select count(*) from public.report_monthly_series(:'organization_id'::uuid,6,:'to_date'::date);
explain (analyze,buffers,settings)
select * from public.report_monthly_series(:'organization_id'::uuid,6,:'to_date'::date);
select count(*) from public.search_transactions(:'organization_id'::uuid,p_limit=>8);
explain (analyze,buffers,settings)
select * from public.search_transactions(:'organization_id'::uuid,p_limit=>8);
\if :after
select count(*) from public.dashboard_liquid_accounts(:'organization_id'::uuid);
explain (analyze,buffers,settings)
select * from public.dashboard_liquid_accounts(:'organization_id'::uuid);
\else
select count(*) from public.account_balances
where organization_id=:'organization_id'::uuid and is_liquid and not is_archived;
explain (analyze,buffers,settings)
select account_id,name,currency,net_debit_minor,subtype from public.account_balances
where organization_id=:'organization_id'::uuid and is_liquid and not is_archived;
\endif

-- Stable accounting snapshot. Compare JSON values, not formatted EXPLAIN output.
select jsonb_build_object(
 'trial_balance',(select coalesce(jsonb_agg(to_jsonb(r) order by account_id),'[]')
   from public.report_trial_balance(:'organization_id'::uuid,:'from_date'::date,:'to_date'::date) r),
 'profit_loss',(select coalesce(jsonb_agg(to_jsonb(r) order by section,account_id),'[]')
   from public.report_profit_and_loss(:'organization_id'::uuid,:'from_date'::date,:'to_date'::date) r),
 'balance_sheet',(select coalesce(jsonb_agg(to_jsonb(r) order by section,account_id nulls last),'[]')
   from public.report_balance_sheet(:'organization_id'::uuid,:'to_date'::date) r),
 'controls',(select coalesce(jsonb_agg(to_jsonb(r) order by control_account_id),'[]')
   from public.reconcile_control_accounts(:'organization_id'::uuid,:'to_date'::date) r),
 'vat',public.read_egypt_vat_report(:'organization_id'::uuid,:'from_date'::date,:'to_date'::date),
 'inventory',public.read_inventory_workspace(:'organization_id'::uuid,:'to_date'::date),
 'fixed_assets',(select coalesce(jsonb_agg(to_jsonb(r) order by account_id,account_kind),'[]')
   from public.reconcile_fixed_assets(:'organization_id'::uuid,:'to_date'::date) r)
) as accounting_snapshot;
rollback;
