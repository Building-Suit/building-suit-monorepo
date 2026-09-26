-- Read-only pre/post migration snapshot, usable before inventory tables exist.
-- In the same disposable fixture, run with psql -v organization_id=<fixture UUID>.
-- Migration-only before/after output must match byte for byte. Do not include
-- source posting between these snapshots; source postings are tested separately.
select jsonb_build_object(
 'organization_id', :'organization_id',
 'transactions', (select count(*) from public.transactions where organization_id=:'organization_id'::uuid),
 'entries', (select count(*) from public.transaction_entries where organization_id=:'organization_id'::uuid),
 'posted_debits_minor', (select coalesce(sum(base_amount_minor),0)::text from public.transaction_entries
   where organization_id=:'organization_id'::uuid and posted_at is not null and side='debit'),
 'posted_credits_minor', (select coalesce(sum(base_amount_minor),0)::text from public.transaction_entries
   where organization_id=:'organization_id'::uuid and posted_at is not null and side='credit'),
 'inventory_accounts', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb)
   from (select id,account_role,currency from public.accounts where organization_id=:'organization_id'::uuid and subtype='inventory') a)
);
