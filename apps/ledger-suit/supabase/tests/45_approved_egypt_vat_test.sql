-- V2-IMP-013: exact VAT, protected controls, effective history, corrections, reconciliation and isolation.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table vat_ids(key text primary key,id uuid not null);
grant all on vat_ids to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('47000000-0000-4000-8000-000000000001','vat-owner@test.local','{}','{}'),
 ('47000000-0000-4000-8000-000000000002','vat-viewer@test.local','{}','{}'),
 ('47000000-0000-4000-8000-000000000003','vat-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"47000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into vat_ids values('org',public.create_organization('VAT fixture','EGP'));
insert into vat_ids values
 ('output_vat',public.create_account((select id from vat_ids where key='org'),'Output VAT control','liability','taxes_payable',p_code=>'VAT210')),
 ('input_vat',public.create_account((select id from vat_ids where key='org'),'Eligible input VAT','asset','other_asset',p_code=>'VAT120')),
 ('revenue',public.create_account((select id from vat_ids where key='org'),'Standard domestic revenue','revenue','service_revenue',p_code=>'VAT400')),
 ('receivable',public.create_account((select id from vat_ids where key='org'),'VAT source receivable','asset','other_asset',p_code=>'VAT130')),
 ('expense',public.create_account((select id from vat_ids where key='org'),'Eligible domestic expense','expense','other_expense',p_code=>'VAT500')),
 ('payable',public.create_account((select id from vat_ids where key='org'),'VAT source payable','liability','other_liability',p_code=>'VAT220'));
insert into vat_ids values('profile',public.configure_egypt_vat((select id from vat_ids where key='org'),'EG-VAT-12345','2034-01-01',(select id from vat_ids where key='output_vat'),(select id from vat_ids where key='input_vat')));
select is((select rate_basis_points from public.vat_regulatory_rules where code='EG_STANDARD_DOMESTIC'),1400,'effective configuration records the approved 14% rate as data');
select is(app.round_vat_minor(1005,1400),141::bigint,'document-boundary rounding uses exact EGP minor units');

insert into vat_ids values('sale',public.post_egypt_vat_document(
 (select id from vat_ids where key='org'),'output','invoice','2034-02-01','2034-02-02','SALE-1',100000,
 (select id from vat_ids where key='revenue'),(select id from vat_ids where key='receivable'),'vat-sale-1'));
select is((select tax_minor from public.vat_documents where id=(select id from vat_ids where key='sale')),14000::bigint,'output invoice calculates exact approved VAT');
select is((select count(*) from public.transaction_entries e join public.vat_documents d on d.transaction_id=e.transaction_id where d.id=(select id from vat_ids where key='sale')),3::bigint,'source document posts one balanced three-line journal');
select is(public.post_egypt_vat_document((select id from vat_ids where key='org'),'output','invoice','2034-02-01','2034-02-02','SALE-1',100000,
 (select id from vat_ids where key='revenue'),(select id from vat_ids where key='receivable'),'vat-sale-1'),(select id from vat_ids where key='sale'),'identical retry returns one VAT source document');

insert into vat_ids values('purchase',public.post_egypt_vat_document(
 (select id from vat_ids where key='org'),'input','invoice','2034-02-03','2034-02-03','BUY-1',1005,
 (select id from vat_ids where key='expense'),(select id from vat_ids where key='payable'),'vat-buy-1',p_input_eligible=>true));
select is((select tax_minor from public.vat_documents where id=(select id from vat_ids where key='purchase')),141::bigint,'eligible input VAT uses the same deterministic rounding boundary');
select ok((public.read_egypt_vat_report((select id from vat_ids where key='org'),'2034-02-01','2034-02-28')->>'reconciled')::boolean,'tax report reconciles source VAT to both designated control accounts');
select is(public.read_egypt_vat_report((select id from vat_ids where key='org'),'2034-02-01','2034-02-28')->>'net_vat_minor','13859','net VAT is output less eligible input without claiming a return or filing amount');

select throws_ok(format($sql$select public.create_draft_transaction(%L,'adjustment','2034-02-04',%L::jsonb,p_adjustment_reason=>'Bypass tax source')$sql$,
 (select id from vat_ids where key='org'),jsonb_build_array(
  jsonb_build_object('account_id',(select id from vat_ids where key='output_vat'),'side','debit','amount_minor',1),
  jsonb_build_object('account_id',(select id from vat_ids where key='receivable'),'side','credit','amount_minor',1))::text),
 '42501','VAT_CONTROL_ACCOUNT_RESTRICTED: use the VAT document command','manual journals cannot bypass the VAT source-to-control contract');
select throws_ok(format($sql$select public.post_egypt_vat_document(%L,'input','invoice','2034-02-04','2034-02-04','INELIGIBLE',1000,%L,%L,'vat-ineligible')$sql$,
 (select id from vat_ids where key='org'),(select id from vat_ids where key='expense'),(select id from vat_ids where key='payable')),
 '22023','VAT_DOCUMENT_INVALID','input VAT requires an explicit eligible-input assertion');
select throws_ok(format($sql$select public.post_egypt_vat_document(%L,'output','invoice','2017-06-30','2017-06-30','OLD',1000,%L,%L,'vat-old')$sql$,
 (select id from vat_ids where key='org'),(select id from vat_ids where key='revenue'),(select id from vat_ids where key='receivable')),
 '23514','VAT_REGISTRATION_REQUIRED: no explicit effective registration profile','tax points before the explicit registration profile are rejected');

insert into vat_ids values('sale_credit',public.post_egypt_vat_document(
 (select id from vat_ids where key='org'),'output','credit','2034-02-05','2034-02-05','SALE-1-CREDIT',100000,
 (select id from vat_ids where key='revenue'),(select id from vat_ids where key='receivable'),'vat-sale-credit',
 p_reason=>'Full reviewed credit',p_adjusts_document_id=>(select id from vat_ids where key='sale')));
select is((select tax_minor from public.vat_documents where id=(select id from vat_ids where key='sale_credit')),14000::bigint,'linked credit copies the original exact tax instead of recalculating history');
select throws_ok(format($sql$select public.post_egypt_vat_document(%L,'output','credit','2034-02-06','2034-02-06','DUP-CREDIT',100000,%L,%L,'vat-sale-credit-2',p_reason=>'Duplicate',p_adjusts_document_id=>%L)$sql$,
 (select id from vat_ids where key='org'),(select id from vat_ids where key='revenue'),(select id from vat_ids where key='receivable'),(select id from vat_ids where key='sale')),
 '23514','VAT_ADJUSTMENT_INVALID: only one exact linked credit or reversal is supported','an original cannot be credited or reversed twice');
insert into vat_ids values('purchase_reversal',public.reverse_egypt_vat_document((select id from vat_ids where key='org'),(select id from vat_ids where key='purchase'),'2034-02-06','2034-02-06','Supplier invoice void','vat-buy-reverse'));
select is((select adjusts_document_id from public.vat_documents where id=(select id from vat_ids where key='purchase_reversal')),(select id from vat_ids where key='purchase'),'reversal remains append-only and links the original');
select ok((public.read_egypt_vat_report((select id from vat_ids where key='org'),'2034-02-01','2034-02-28')->>'reconciled')::boolean,'credits and reversals preserve exact source-to-GL reconciliation');
select is(public.read_egypt_vat_report((select id from vat_ids where key='org'),'2034-02-01','2034-02-28')->>'net_vat_minor','0','full linked adjustments neutralize the period without deleting history');

reset role;
select throws_ok(format('update public.vat_documents set reference=%L where id=%L','changed',(select id from vat_ids where key='sale')),
 '55000','IMMUTABLE_VAT_EVIDENCE: VAT configuration and documents are append-only','posted VAT evidence cannot be rewritten');
insert into public.organization_members(organization_id,user_id,role,status) values((select id from vat_ids where key='org'),'47000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"47000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select lives_ok(format('select public.read_egypt_vat_workspace(%L,%L,%L)',(select id from vat_ids where key='org'),'2034-01-01','2034-12-31'),'viewer can read scoped VAT history and reconciliation');
select throws_ok(format($sql$select public.configure_egypt_vat(%L,'NO','2035-01-01',%L,%L)$sql$,(select id from vat_ids where key='org'),(select id from vat_ids where key='output_vat'),(select id from vat_ids where key='input_vat')),
 '42501','INSUFFICIENT_PERMISSION: tax.configure is required','viewer cannot configure VAT');
select set_config('request.jwt.claims','{"sub":"47000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select is((select count(*) from public.vat_documents),0::bigint,'RLS hides another organization VAT documents');
select throws_ok(format('select public.read_egypt_vat_workspace(%L,%L,%L)',(select id from vat_ids where key='org'),'2034-01-01','2034-12-31'),
 '42501','TENANT_ACCESS_DENIED: not a member of this organization','foreign tenant cannot read VAT workspace');
select * from finish();
rollback;
