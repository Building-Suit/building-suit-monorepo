-- LS-EG-003: authoritative source boundary, POS chain, correction links and no duplicate posting.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table er_ids(key text primary key,id uuid not null);
grant all on er_ids to authenticated,service_role;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('72000000-0000-4000-8000-000000000001','ereceipt-owner@test.local','{}','{}'),
 ('72000000-0000-4000-8000-000000000002','ereceipt-viewer@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into er_ids values('org',public.create_organization('eReceipt fixture','EGP'));
insert into er_ids values
 ('output_vat',public.create_account((select id from er_ids where key='org'),'Output VAT','liability','taxes_payable',p_code=>'ER210')),
 ('input_vat',public.create_account((select id from er_ids where key='org'),'Input VAT','asset','other_asset',p_code=>'ER120')),
 ('revenue',public.create_account((select id from er_ids where key='org'),'Retail revenue','revenue','service_revenue',p_code=>'ER400')),
 ('receivable',public.create_account((select id from er_ids where key='org'),'Receipt clearing','asset','other_asset',p_code=>'ER130'));
insert into er_ids values('vat_profile',public.configure_egypt_vat(
 (select id from er_ids where key='org'),'123456789','2026-01-01',
 (select id from er_ids where key='output_vat'),(select id from er_ids where key='input_vat')));

select throws_ok(format($sql$select public.configure_eta_ereceipt_preproduction(
 %L,%L,'Fixture Issuer','0',%L::jsonb,'6201','POS-1','','LS-D-ERECEIPT-SCOPE',
 'B2C onboarding','POS activation','eSeal reference','2026-09-01','2026-09-01')$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='vat_profile'),
 '{"country":"EG","governate":"Cairo","regionCity":"Cairo","street":"Fixture Street","buildingNumber":"1"}'),
 '23514','ETA_ERECEIPT_PROFILE_INVALID: approved source, B2C onboarding, active POS and batch-signing evidence are required',
 'a generic VAT profile cannot silently become an eReceipt/POS identity');

insert into er_ids values('ereceipt_profile',public.configure_eta_ereceipt_preproduction(
 (select id from er_ids where key='org'),(select id from er_ids where key='vat_profile'),
 'Fixture Issuer','0','{"country":"EG","governate":"Cairo","regionCity":"Cairo","street":"Fixture Street","buildingNumber":"1"}',
 '6201','POS-1','approved-ledger-retail-source','LS-D-ERECEIPT-SCOPE','B2C onboarding fixture',
 'ETA POS activation fixture','fixture-batch-signing-certificate','2026-09-01','2026-09-01'));
select is((select environment from public.organization_eta_ereceipt_profiles where id=(select id from er_ids where key='ereceipt_profile')),
 'preproduction','profile cannot select production');

insert into er_ids values('sale',public.post_egypt_vat_document(
 (select id from er_ids where key='org'),'output','invoice','2026-09-20','2026-09-20','RETAIL-SALE-1',10000,
 (select id from er_ids where key='revenue'),(select id from er_ids where key='receivable'),'ereceipt-vat-sale-1'));
create temp table er_before as select count(*)::bigint transaction_count from public.transactions
 where organization_id=(select id from er_ids where key='org');

select throws_ok(format($sql$select public.prepare_eta_ereceipt_document(%L,%L,'R-EMPTY','2026-09-20T10:00:00Z','{}'::jsonb,'er-empty')$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='sale')),
 '22023','ETA_ERECEIPT_SOURCE_REQUIRED: approved source identity, immutable receipt reference, buyer, payment and lines are required',
 'Ledger exposes missing authoritative retail facts rather than manufacturing a receipt');

insert into er_ids values('receipt',public.prepare_eta_ereceipt_document(
 (select id from er_ids where key='org'),(select id from er_ids where key='sale'),'R-1','2026-09-20T10:00:00Z',
 '{"sourceSystemId":"approved-ledger-retail-source","sourceDocumentId":"SALE-1","capturedAt":"2026-09-20T10:00:00Z","paymentMethod":"C","buyer":{"type":"P","id":"29901011234567","name":"Fixture Buyer"},"lines":[{"internalCode":"SERVICE-1","description":"Configured service","itemType":"EGS","itemCode":"EG-123456789-1","unitType":"C62","quantity":"2.00000","unitPriceMinor":"5000","totalSaleMinor":"10000","discountMinor":"0","netSaleMinor":"10000","taxMinor":"1400"}]}',
 'ereceipt-document-1'));
select is((select fiscal_snapshot->>'receiptType' from public.eta_ereceipt_documents where id=(select id from er_ids where key='receipt')),
 's','posted invoice maps only to receipt sale type');
select is((select fiscal_snapshot->>'previousUUID' from public.eta_ereceipt_documents where id=(select id from er_ids where key='receipt')),
 '','first approved device receipt starts the chain explicitly');
select is(public.prepare_eta_ereceipt_document(
 (select id from er_ids where key='org'),(select id from er_ids where key='sale'),'R-1','2026-09-20T10:00:00Z',
 '{"sourceSystemId":"approved-ledger-retail-source","sourceDocumentId":"SALE-1","capturedAt":"2026-09-20T10:00:00Z","paymentMethod":"C","buyer":{"type":"P","id":"29901011234567","name":"Fixture Buyer"},"lines":[{"internalCode":"SERVICE-1","description":"Configured service","itemType":"EGS","itemCode":"EG-123456789-1","unitType":"C62","quantity":"2.00000","unitPriceMinor":"5000","totalSaleMinor":"10000","discountMinor":"0","netSaleMinor":"10000","taxMinor":"1400"}]}',
 'ereceipt-document-1'),(select id from er_ids where key='receipt'),'source preparation retry is idempotent');
select is(public.request_eta_ereceipt_preproduction_submission((select id from er_ids where key='org'),(select id from er_ids where key='receipt'))->>'typeVersion',
 '1.2','submission claim returns the immutable receipt snapshot');

reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(format($sql$select public.record_eta_ereceipt_preproduction_result(%L,%L,'signing',p_eta_receipt_uuid=>%L)$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='receipt'),repeat('a',64)),
 'worker records the locally generated content identity before submission');
select lives_ok(format($sql$select public.record_eta_ereceipt_preproduction_result(%L,%L,'valid','SUBMISSION1',%L,'LONG1',p_provider_payload=>'{}')$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='receipt'),repeat('a',64)),
 'provider validation is separate from accounting');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select throws_ok(format($sql$select public.prepare_eta_ereceipt_document(%L,%L,'R-1-DUPLICATE','2026-09-20T10:00:00Z',%L::jsonb,'ereceipt-document-duplicate')$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='sale'),
 '{"sourceSystemId":"approved-ledger-retail-source","sourceDocumentId":"SALE-1-DUPLICATE","capturedAt":"2026-09-20T11:00:00Z","paymentMethod":"C","buyer":{"type":"P","id":"29901011234567","name":"Fixture Buyer"},"lines":[{"internalCode":"SERVICE-1","description":"Configured service","itemType":"EGS","itemCode":"EG-123456789-1","unitType":"C62","quantity":"2.00000","unitPriceMinor":"5000","totalSaleMinor":"10000","discountMinor":"0","netSaleMinor":"10000","taxMinor":"1400"}]}'),
 '23505','ETA_ERECEIPT_SOURCE_ALREADY_PREPARED: only an invalid or rejected receipt can be corrected',
 'one posted financial source cannot be emitted as two valid receipts');

insert into er_ids values('return',public.post_egypt_vat_document(
 (select id from er_ids where key='org'),'output','credit','2026-09-21','2026-09-21','RETAIL-RETURN-1',10000,
 (select id from er_ids where key='revenue'),(select id from er_ids where key='receivable'),'ereceipt-vat-return-1',
 p_reason=>'Full linked retail return',p_adjusts_document_id=>(select id from er_ids where key='sale')));
insert into er_ids values('return_receipt',public.prepare_eta_ereceipt_document(
 (select id from er_ids where key='org'),(select id from er_ids where key='return'),'RR-1','2026-09-21T10:00:00Z',
 '{"sourceSystemId":"approved-ledger-retail-source","sourceDocumentId":"RETURN-1","capturedAt":"2026-09-21T10:00:00Z","paymentMethod":"C","buyer":{"type":"P","id":"29901011234567","name":"Fixture Buyer"},"lines":[{"internalCode":"SERVICE-1","description":"Configured service return","itemType":"EGS","itemCode":"EG-123456789-1","unitType":"C62","quantity":"2.00000","unitPriceMinor":"5000","totalSaleMinor":"10000","discountMinor":"0","netSaleMinor":"10000","taxMinor":"1400"}]}',
 'ereceipt-return-1'));
select is((select fiscal_snapshot->>'referenceUUID' from public.eta_ereceipt_documents where id=(select id from er_ids where key='return_receipt')),
 repeat('a',64),'return links to the valid sale receipt identity');
select is((select fiscal_snapshot->>'previousUUID' from public.eta_ereceipt_documents where id=(select id from er_ids where key='return_receipt')),
 repeat('a',64),'device chain links to the prior valid receipt');
select is(public.request_eta_ereceipt_preproduction_submission((select id from er_ids where key='org'),(select id from er_ids where key='return_receipt'))->>'receiptType',
 'r','return can be claimed only through the receipt-specific submission boundary');
reset role;
set local role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select lives_ok(format($sql$select public.record_eta_ereceipt_preproduction_result(%L,%L,'invalid','SUBMISSION2',%L,p_error_code=>'FIXTURE',p_error_message=>'Correct source data')$sql$,
 (select id from er_ids where key='org'),(select id from er_ids where key='return_receipt'),repeat('b',64)),
 'invalid provider result retains its content identity for correction');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into er_ids values('corrected_return',public.prepare_eta_ereceipt_document(
 (select id from er_ids where key='org'),(select id from er_ids where key='return'),'RR-1-CORRECTED','2026-09-21T10:00:00Z',
 '{"sourceSystemId":"approved-ledger-retail-source","sourceDocumentId":"RETURN-1-CORRECTED","capturedAt":"2026-09-21T11:00:00Z","paymentMethod":"C","buyer":{"type":"P","id":"29901011234567","name":"Fixture Buyer"},"lines":[{"internalCode":"SERVICE-1","description":"Configured service return","itemType":"EGS","itemCode":"EG-123456789-1","unitType":"C62","quantity":"2.00000","unitPriceMinor":"5000","totalSaleMinor":"10000","discountMinor":"0","netSaleMinor":"10000","taxMinor":"1400"}]}',
 'ereceipt-return-correction-1'));
select is((select fiscal_snapshot->>'referenceOldUUID' from public.eta_ereceipt_documents where id=(select id from er_ids where key='corrected_return')),
 repeat('b',64),'correction links to the invalid receipt identity');
select is((select supersedes_document_id from public.eta_ereceipt_documents where id=(select id from er_ids where key='corrected_return')),
 (select id from er_ids where key='return_receipt'),'correction retains the local supersession link');
select is((select previous_document_id from public.eta_ereceipt_documents where id=(select id from er_ids where key='corrected_return')),
 (select id from er_ids where key='receipt'),'correction preserves the original POS predecessor instead of chaining through the invalid receipt');
select is((select count(*) from public.transactions where organization_id=(select id from er_ids where key='org')),
 (select transaction_count+1 from er_before),'only the separately posted VAT return changed accounting');

reset role;
insert into public.organization_members(organization_id,user_id,role,status)
 values((select id from er_ids where key='org'),'72000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"72000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_eta_ereceipt_preproduction_submission(%L,%L)',
 (select id from er_ids where key='org'),(select id from er_ids where key='receipt')),'viewer can read traceable receipt status');
select throws_ok(format('select public.request_eta_ereceipt_preproduction_submission(%L,%L)',
 (select id from er_ids where key='org'),(select id from er_ids where key='return_receipt')),
 '42501','INSUFFICIENT_PERMISSION: eta_ereceipt.submit is required','viewer cannot submit receipts');
select * from finish();
rollback;
