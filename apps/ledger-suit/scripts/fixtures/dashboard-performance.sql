-- Only loaded by test-dashboard-performance-embedded.mjs into a NEW disposable
-- database. Never apply to the seeded accountant reproduction database.
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
select ('51000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  'perf-' || i || '@ledger.test', '{}', jsonb_build_object('full_name','PERF User ' || i)
from generate_series(1,4) i;
create table public.perf_ids(key text primary key, id uuid);
grant select on public.perf_ids to authenticated;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',false);
do $$
declare org uuid; bank uuid; equity uuid; small uuid; revenue uuid; rent uuid; output_vat uuid; input_vat uuid; txn uuid; cat uuid; contact uuid; tag uuid;
begin
  org := public.create_organization('PERF Alpha','EGP');
  insert into public.perf_ids values ('org',org);
  insert into public.organization_members(organization_id,user_id,role) values
    (org,'51000000-0000-4000-8000-000000000002','accountant'),
    (org,'51000000-0000-4000-8000-000000000003','viewer');
  bank := public.create_account(org,'PERF Cash','asset','cash');
  equity := public.create_account(org,'PERF Equity','equity','owner_capital');
  small := public.create_account(org,'PERF Small','asset','other_asset');
  revenue := public.create_account(org,'PERF Revenue','revenue','service_revenue');
  rent := public.create_account(org,'PERF Rent','expense','rent');
  output_vat := public.create_account(org,'PERF Output VAT','liability','taxes_payable');
  input_vat := public.create_account(org,'PERF Input VAT','asset','other_asset');
  perform public.configure_egypt_vat(org,'PERF-REGISTRATION','2026-01-01',output_vat,input_vat);
  contact := public.create_counterparty(org,'PERF Contact','customer');
  insert into public.categories(organization_id,name,kind,default_account_id,created_by)
    values (org,'PERF Category','income',revenue,auth.uid()) returning id into cat;
  insert into public.tags(organization_id,name,created_by)
    values (org,'PERF Tag',auth.uid()) returning id into tag;
  insert into public.perf_ids values ('bank',bank),('equity',equity),('category',cat),('contact',contact),('tag',tag);
  for i in 1..12 loop
    txn := public.create_adjustment(org, date '2026-09-01' + (i / 2), jsonb_build_array(
      jsonb_build_object('account_id',bank,'side','debit','amount_minor',i*100),
      jsonb_build_object('account_id',small,'side','debit','amount_minor',1),
      jsonb_build_object('account_id',equity,'side','credit','amount_minor',i*100+1)
    ),'Journal ' || i,'PERF regression');
    insert into public.transaction_tags(organization_id,transaction_id,tag_id) values (org,txn,tag);
  end loop;
  perform public.reverse_transaction(txn,'PERF reversal',date '2026-09-10');
  perform public.record_income(org,400,bank,p_category_id=>cat,p_counterparty_id=>contact,
    p_transaction_date=>'2026-09-08',p_description=>'PERF receipt');
  perform public.record_income(org,700,bank,p_revenue_account_id=>revenue,
    p_transaction_date=>'2026-08-08',p_description=>'Previous month receipt');
  perform public.record_expense(org,200,bank,p_expense_account_id=>rent,
    p_transaction_date=>'2026-09-09',p_description=>'PERF expense');
  perform public.create_draft_transaction(org,'income','2026-09-11',jsonb_build_array(
    jsonb_build_object('account_id',bank,'side','debit','amount_minor',444),
    jsonb_build_object('account_id',revenue,'side','credit','amount_minor',444)
  ),p_description=>'Unposted draft');
  txn := public.create_commitment(org,'scheduled_expense','PERF commitment',300,
    date '2026-09-12',p_linked_account_id=>rent);
  perform public.settle_commitment(txn,bank,p_settled_on=>date '2026-09-12');
end $$;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000004","role":"authenticated"}',false);
do $$ declare org uuid; bank uuid; equity uuid; begin
  org := public.create_organization('PERF Beta','EGP');
  bank := public.create_account(org,'FOREIGN Cash','asset','cash');
  equity := public.create_account(org,'FOREIGN Equity','equity','owner_capital');
  perform public.create_adjustment(org,date '2026-09-01',jsonb_build_array(
    jsonb_build_object('account_id',bank,'side','debit','amount_minor',999999),
    jsonb_build_object('account_id',equity,'side','credit','amount_minor',999999)
  ),'FOREIGN secret journal','PERF isolation');
end $$;
