-- Read-only CORE-08 snapshot. Requires the V2 reporting/control RPCs.
-- Supply organization_id, actor_id, from_date and to_date with psql -v.
-- Run identically before/after each candidate forward migration on an owned
-- disposable clone. No postings between snapshots. Save with -X -Atq.
\set ON_ERROR_STOP on
begin read only;
select set_config('request.jwt.claims',jsonb_build_object('sub',:'actor_id','role','authenticated')::text,true) as claims \gset
set local role authenticated;
select jsonb_build_object(
 'organization_id',:'organization_id','from_date',:'from_date','to_date',:'to_date',
 'journals',(select count(*) from public.transactions where organization_id=:'organization_id'::uuid),
 'entries',(select count(*) from public.transaction_entries where organization_id=:'organization_id'::uuid),
 'posted_debits_minor',(select coalesce(sum(base_amount_minor),0)::text from public.transaction_entries
   where organization_id=:'organization_id'::uuid and posted_at is not null and side='debit'),
 'posted_credits_minor',(select coalesce(sum(base_amount_minor),0)::text from public.transaction_entries
   where organization_id=:'organization_id'::uuid and posted_at is not null and side='credit'),
 'unbalanced_journals',(select count(*) from (
   select transaction_id from public.transaction_entries where organization_id=:'organization_id'::uuid and posted_at is not null
   group by transaction_id having sum(case when side='debit' then base_amount_minor else -base_amount_minor end)<>0) x),
 'posted_identity_digest',(select md5(coalesce(string_agg(jsonb_build_array(id,transaction_date,posting_date,type,source,status,
   reference,currency_code,exchange_rate,posted_at,reverses_transaction_id,reversed_by_transaction_id,correction_of_transaction_id,idempotency_key)::text,
   E'\n' order by id),'')) from public.transactions where organization_id=:'organization_id'::uuid and posted_at is not null),
 'posted_entry_digest',(select md5(coalesce(string_agg(jsonb_build_array(id,transaction_id,account_id,entry_index,side,amount_minor,
   currency_code,base_amount_minor,base_currency_code,exchange_rate,entry_date,posted_at,memo,dimensions)::text,E'\n' order by id),''))
   from public.transaction_entries where organization_id=:'organization_id'::uuid and posted_at is not null),
 'trial_balance',(select coalesce(jsonb_agg(to_jsonb(r) order by account_id),'[]')
   from public.report_trial_balance(:'organization_id'::uuid,:'from_date'::date,:'to_date'::date) r),
 'balance_sheet',(select coalesce(jsonb_agg(to_jsonb(r) order by section,account_id nulls last),'[]')
   from public.report_balance_sheet(:'organization_id'::uuid,:'to_date'::date) r),
 'profit_loss',(select coalesce(jsonb_agg(to_jsonb(r) order by section,account_id),'[]')
   from public.report_profit_and_loss(:'organization_id'::uuid,:'from_date'::date,:'to_date'::date) r),
 'control_reconciliation',(select coalesce(jsonb_agg(to_jsonb(r) order by control_account_id),'[]')
   from public.reconcile_control_accounts(:'organization_id'::uuid,:'to_date'::date) r)
);
rollback;
