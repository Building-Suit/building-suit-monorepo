-- LS-EG-002: complete fiscal source, isolated state, permissions and exact reconciliation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table eta_ids(key text primary key,id uuid not null);
grant all on eta_ids to authenticated,service_role;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('71000000-0000-4000-8000-000000000001','eta-owner@test.local','{}','{}'),
 ('71000000-0000-4000-8000-000000000002','eta-viewer@test.local','{}','{}'),
 ('71000000-0000-4000-8000-000000000003','eta-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into eta_ids values('org',public.create_organization('ETA fixture','EGP'));
insert into eta_ids values
 ('output_vat',public.create_account((select id from eta_ids where key='org'),'Output VAT control','liability','taxes_payable',p_code=>'ETA210')),
 ('input_vat',public.create_account((select id from eta_ids where key='org'),'Input VAT control','asset','other_asset',p_code=>'ETA120')),
 ('revenue',public.create_account((select id from eta_ids where key='org'),'ETA service revenue','revenue','service_revenue',p_code=>'ETA400')),
 ('receivable',public.create_account((select id from eta_ids where key='org'),'ETA receivable','asset','other_asset',p_code=>'ETA130')),
 ('expense',public.create_account((select id from eta_ids where key='org'),'ETA expense','expense','other_expense',p_code=>'ETA500')),
 ('payable',public.create_account((select id from eta_ids where key='org'),'ETA payable','liability','other_liability',p_code=>'ETA220'));
insert into eta_ids values('vat_profile',public.configure_egypt_vat(
 (select id from eta_ids where key='org'),'123456789','2026-01-01',
 (select id from eta_ids where key='output_vat'),(select id from eta_ids where key='input_vat')));
insert into eta_ids values('eta_profile',public.configure_eta_preproduction(
 (select id from eta_ids where key='org'),(select id from eta_ids where key='vat_profile'),
 'Fixture Issuer','0','6201',
 '{"country":"EG","governate":"Cairo","regionCity":"Cairo","street":"Fixture Street","buildingNumber":"1"}',
 'ETA preproduction onboarding fixture','2026-09-01','fixture-certificate-reference','2026-09-01'));
select is((select environment from public.organization_eta_profiles where id=(select id from eta_ids where key='eta_profile')),
 'preproduction','ETA profile cannot claim or select production');

insert into eta_ids values('sale',public.post_egypt_vat_document(
 (select id from eta_ids where key='org'),'output','invoice','2026-09-20','2026-09-20','ETA-SALE-1',10000,
 (select id from eta_ids where key='revenue'),(select id from eta_ids where key='receivable'),'eta-vat-sale-1'));
create temp table eta_before as select count(*)::bigint transaction_count
 from public.transactions t where t.organization_id=(select id from eta_ids where key='org');

select throws_ok(format($sql$select public.prepare_eta_b2b_document(%L,%L,'ETA-EMPTY','2026-09-20T10:00:00Z',%L::jsonb,'[]'::jsonb,'eta-empty')$sql$,
 (select id from eta_ids where key='org'),(select id from eta_ids where key='sale'),
 '{"type":"B","id":"987654321","name":"Receiver","address":{"country":"EG","governate":"Giza","regionCity":"Dokki","street":"Receiver Street","buildingNumber":"2"}}'),
 '22023','ETA_DOCUMENT_INVALID: complete B2B receiver, UTC issuance and fiscal lines are required',
 'an aggregate posted amount cannot be mislabeled as a complete fiscal invoice');

insert into eta_ids values('eta_sale',public.prepare_eta_b2b_document(
 (select id from eta_ids where key='org'),(select id from eta_ids where key='sale'),'ETA-INV-1','2026-09-20T10:00:00Z',
 '{"type":"B","id":"987654321","name":"Receiver","address":{"country":"EG","governate":"Giza","regionCity":"Dokki","street":"Receiver Street","buildingNumber":"2"}}',
 '[{"description":"Configured service","item_type":"EGS","item_code":"EG-123456789-1","unit_type":"C62","quantity":"2.00000","unit_value_minor":"5000","sales_total_minor":"10000","discount_minor":"0","net_total_minor":"10000","tax_minor":"1400","internal_code":"SERVICE-1"}]',
 'eta-document-1'));
select is((select fiscal_snapshot->>'taxableBaseMinor' from public.eta_b2b_documents where id=(select id from eta_ids where key='eta_sale')),
 '10000','fiscal snapshot copies the immutable recognized taxable amount');
select is((select fiscal_snapshot->>'taxMinor' from public.eta_b2b_documents where id=(select id from eta_ids where key='eta_sale')),
 '1400','fiscal lines reconcile to the immutable recognized VAT amount');
select is(public.prepare_eta_b2b_document(
 (select id from eta_ids where key='org'),(select id from eta_ids where key='sale'),'ETA-INV-1','2026-09-20T10:00:00Z',
 '{"type":"B","id":"987654321","name":"Receiver","address":{"country":"EG","governate":"Giza","regionCity":"Dokki","street":"Receiver Street","buildingNumber":"2"}}',
 '[{"description":"Configured service","item_type":"EGS","item_code":"EG-123456789-1","unit_type":"C62","quantity":"2.00000","unit_value_minor":"5000","sales_total_minor":"10000","discount_minor":"0","net_total_minor":"10000","tax_minor":"1400","internal_code":"SERVICE-1"}]',
 'eta-document-1'),(select id from eta_ids where key='eta_sale'),'identical preparation retry is idempotent');

select is(public.request_eta_preproduction_submission((select id from eta_ids where key='org'),(select id from eta_ids where key='eta_sale'))->>'documentType',
 'i','authorized submission claim returns only the immutable server snapshot');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(format($sql$select public.record_eta_preproduction_result(%L,%L,'submitted','SUBMISSION1','DOCUMENT1','LONG1',p_provider_payload=>'{}')$sql$,
 (select id from eta_ids where key='org'),(select id from eta_ids where key='eta_sale')),'server worker records asynchronous acceptance without accounting writes');
select lives_ok(format($sql$select public.record_eta_preproduction_result(%L,%L,'valid','SUBMISSION1','DOCUMENT1','LONG1',p_provider_payload=>'{"overallStatus":"valid"}')$sql$,
 (select id from eta_ids where key='org'),(select id from eta_ids where key='eta_sale')),'server worker records final preproduction validation');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);

insert into eta_ids values('credit',public.post_egypt_vat_document(
 (select id from eta_ids where key='org'),'output','credit','2026-09-21','2026-09-21','ETA-SALE-1-C',10000,
 (select id from eta_ids where key='revenue'),(select id from eta_ids where key='receivable'),'eta-vat-credit-1',
 p_reason=>'Full fiscal credit',p_adjusts_document_id=>(select id from eta_ids where key='sale')));
insert into eta_ids values('eta_credit',public.prepare_eta_b2b_document(
 (select id from eta_ids where key='org'),(select id from eta_ids where key='credit'),'ETA-CREDIT-1','2026-09-21T10:00:00Z',
 '{"type":"B","id":"987654321","name":"Receiver","address":{"country":"EG","governate":"Giza","regionCity":"Dokki","street":"Receiver Street","buildingNumber":"2"}}',
 '[{"description":"Configured service credit","item_type":"EGS","item_code":"EG-123456789-1","unit_type":"C62","quantity":"2.00000","unit_value_minor":"5000","sales_total_minor":"10000","discount_minor":"0","net_total_minor":"10000","tax_minor":"1400","internal_code":"SERVICE-1"}]',
 'eta-document-credit-1'));
select is((select fiscal_snapshot->'references'->>0 from public.eta_b2b_documents where id=(select id from eta_ids where key='eta_credit')),
 'DOCUMENT1','credit note references the already-valid ETA invoice UUID');

select is((select count(*) from public.transactions t where t.organization_id=(select id from eta_ids where key='org')),
 (select transaction_count+1 from eta_before),'only the separately posted VAT credit changed accounting; ETA preparation and delivery added no journal');
select ok((select sum(base_amount_minor) filter(where side='debit')=sum(base_amount_minor) filter(where side='credit')
  from public.transaction_entries where organization_id=(select id from eta_ids where key='org')),
 'ledger remains balanced after ETA failures or status transitions');

reset role;
insert into public.organization_members(organization_id,user_id,role,status)
 values((select id from eta_ids where key='org'),'71000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_eta_preproduction_submission(%L,%L)',(select id from eta_ids where key='org'),(select id from eta_ids where key='eta_sale')),
 'viewer can read bounded delivery evidence');
select throws_ok(format('select public.request_eta_preproduction_submission(%L,%L)',(select id from eta_ids where key='org'),(select id from eta_ids where key='eta_credit')),
 '42501','INSUFFICIENT_PERMISSION: eta.submit is required','viewer cannot submit fiscal documents');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.eta_b2b_documents),0::bigint,'RLS hides another organization fiscal documents');
select * from finish();
rollback;
