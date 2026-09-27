-- LS-FX-001 native disposable-local fixture. All synthetic data is rolled back.
begin;
do $$ begin
 if to_regprocedure('public.post_fx_settlement(uuid,text,uuid,uuid,uuid,date,text,character,bigint,numeric,date,text,text,jsonb,text)') is null then
  raise exception 'LS-FX-001 prerequisite: apply 20260927160000_fx_cross_currency_ar_ap.sql';
 end if;
end $$;
create temp sequence fx_test_number;
create function pg_temp.fx_ok(ok boolean,label text) returns text language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; return 'ok '||nextval('fx_test_number')||' - '||label; end $$;
create function pg_temp.fx_reject(sql text,code text,label text) returns text language plpgsql as $$ declare actual text; begin begin execute sql; exception when others then actual:=sqlstate; end; return pg_temp.fx_ok(actual=code,label||' (SQLSTATE '||coalesce(actual,'none')||')'); end $$;
create temp table fx_ids(key text primary key,id uuid); grant all on fx_ids to authenticated; grant all on sequence fx_test_number to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('70000000-0000-4000-8000-000000000001','fx-owner@test.local','{}','{}'),
 ('70000000-0000-4000-8000-000000000002','fx-viewer@test.local','{}','{}'),
 ('70000000-0000-4000-8000-000000000003','fx-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000001","role":"authenticated"}',true); set local role authenticated;
insert into fx_ids values ('org',public.create_organization('FX fixture','EGP'));
insert into fx_ids values
 ('ar_control',public.create_account((select id from fx_ids where key='org'),'FX AR Control','asset','accounts_receivable',p_account_role=>'control',p_control_subledger_type=>'customer')),
 ('ap_control',public.create_account((select id from fx_ids where key='org'),'FX AP Control','liability','accounts_payable',p_account_role=>'control',p_control_subledger_type=>'supplier')),
 ('revenue',public.create_account((select id from fx_ids where key='org'),'FX sales','revenue','service_revenue')),
 ('expense',public.create_account((select id from fx_ids where key='org'),'FX purchases','expense','other_expense')),
 ('cash_eur',public.create_account((select id from fx_ids where key='org'),'EUR bank','asset','bank','EUR')),
 ('cash_usd',public.create_account((select id from fx_ids where key='org'),'USD bank','asset','bank','USD')),
 ('gain',public.create_account((select id from fx_ids where key='org'),'Realized FX gain','revenue','other_income')),
 ('loss',public.create_account((select id from fx_ids where key='org'),'Realized FX loss','expense','other_expense')),
 ('ugain',public.create_account((select id from fx_ids where key='org'),'Unrealized FX gain','revenue','other_income')),
 ('uloss',public.create_account((select id from fx_ids where key='org'),'Unrealized FX loss','expense','other_expense')),
 ('customer',public.create_counterparty((select id from fx_ids where key='org'),'FX customer','customer')),
 ('supplier',public.create_counterparty((select id from fx_ids where key='org'),'FX supplier','vendor'));
select public.configure_fx_accounts((select id from fx_ids where key='org'),(select id from fx_ids where key='gain'),(select id from fx_ids where key='loss'),(select id from fx_ids where key='ugain'),(select id from fx_ids where key='uloss'));

create function pg_temp.fx_item(side text,party text,control text,offset_key text,ref text,currency text,amount bigint,rate numeric,dt date default '2030-01-01') returns uuid language sql as $$
 select public.post_fx_open_item((select id from fx_ids where key='org'),side,(select id from fx_ids where key=party),(select id from fx_ids where key=control),(select id from fx_ids where key=offset_key),dt,dt+30,ref,currency::char(3),amount,rate,dt,'Approved manual fixture',ref||'-RATE',ref||'-KEY'); $$;
create function pg_temp.fx_settle(side text,party text,control text,item_key text,ref text,doc bigint,settle bigint,cross_rate numeric,settle_currency text,base_rate numeric,dt date default '2030-01-10') returns uuid language sql as $$
 select public.post_fx_settlement((select id from fx_ids where key='org'),side,(select id from fx_ids where key=party),(select id from fx_ids where key=control),(select id from fx_ids where key=case settle_currency when 'EUR' then 'cash_eur' else 'cash_usd' end),dt,ref,settle_currency::char(3),settle,base_rate,dt,'Approved manual fixture',ref||'-BASE',jsonb_build_array(jsonb_build_object('item_id',(select id from fx_ids where key=item_key),'document_amount_minor',doc::text,'settlement_amount_minor',settle::text,'allocation_rate',cross_rate::text,'conversion_evidence',ref||'-CROSS')),ref||'-KEY'); $$;

-- Regression: a caller cannot turn this repair into generic Control posting.
create function pg_temp.fx_generic_control_denied(label text) returns text language plpgsql as $$
begin
 return pg_temp.fx_reject(format($q$
  select public.create_adjustment(%L::uuid,'2030-01-01'::date,
   jsonb_build_array(
    jsonb_build_object('account_id',%L::uuid,'side','debit','amount_minor',100),
    jsonb_build_object('account_id',%L::uuid,'side','credit','amount_minor',100)
   ),'FX guard regression','Do not bypass linked subledger')
 $q$,(select id from fx_ids where key='org'),(select id from fx_ids where key='ar_control'),(select id from fx_ids where key='revenue')),
 '23514',label);
end; $$;
select pg_temp.fx_generic_control_denied('generic Control posting remains rejected before FX');
select pg_temp.fx_reject($q$select pg_temp.fx_item('customer','customer','ap_control','revenue','FX-WRONG-BINDING','USD',100,50)$q$,
 '23514','customer FX cannot use a supplier Control binding');
select pg_temp.fx_reject($q$select pg_temp.fx_item('customer','customer','ar_control','expense','FX-WRONG-OFFSET','USD',100,50)$q$,
 '23514','invalid FX offset is rejected after context setup');
select pg_temp.fx_generic_control_denied('failed FX call does not leave an authorized posting context');
select pg_temp.fx_ok(not exists(select 1 from public.fx_open_items where reference in ('FX-WRONG-BINDING','FX-WRONG-OFFSET')),
 'rejected FX calls leave no open items');

-- Approved AR and AP examples: USD 100 at 50, settled by EUR 90 at 60.
insert into fx_ids values ('ar1',pg_temp.fx_item('customer','customer','ar_control','revenue','AR-FX-1','USD',10000,50)),('ap1',pg_temp.fx_item('supplier','supplier','ap_control','expense','AP-FX-1','USD',10000,50));
insert into fx_ids values ('ars1',pg_temp.fx_settle('customer','customer','ar_control','ar1','AR-SET-1',10000,9000,.9,'EUR',60)),('aps1',pg_temp.fx_settle('supplier','supplier','ap_control','ap1','AP-SET-1',10000,9000,.9,'EUR',60));
select pg_temp.fx_generic_control_denied('successful FX calls close the trusted posting context');
select pg_temp.fx_ok((select original_base_minor=500000 from public.fx_open_items where id=(select id from fx_ids where key='ar1')),'AR recognition translates USD 100 to EGP 5,000');
select pg_temp.fx_ok((select settlement_base_minor=540000 and realized_fx_base_minor=40000 from public.fx_settlements where id=(select id from fx_ids where key='ars1')),'AR settlement records EGP 400 realized gain');
select pg_temp.fx_ok((select settlement_base_minor=540000 and realized_fx_base_minor=40000 from public.fx_settlements where id=(select id from fx_ids where key='aps1')),'AP settlement records EGP 400 obligation-side loss');
select pg_temp.fx_ok(jsonb_array_length(public.read_fx_workspace((select id from fx_ids where key='org'),'customer','2030-01-10')->'items')=0,'fully settled AR item closes in original currency');
select pg_temp.fx_ok((select x->>'subledger'='customer' and x->>'role'='control'
 from jsonb_array_elements(public.read_fx_workspace((select id from fx_ids where key='org'),'customer','2030-01-10')->'accounts') x
 where x->>'id'=(select id::text from fx_ids where key='ar_control')),'workspace exposes customer binding from canonical binding table');
select pg_temp.fx_ok((select x->>'subledger'='supplier' and x->>'role'='control'
 from jsonb_array_elements(public.read_fx_workspace((select id from fx_ids where key='org'),'supplier','2030-01-10')->'accounts') x
 where x->>'id'=(select id::text from fx_ids where key='ap_control')),'workspace exposes supplier binding from canonical binding table');
select pg_temp.fx_ok((select x->>'subledger' is null and x->>'role'='posting'
 from jsonb_array_elements(public.read_fx_workspace((select id from fx_ids where key='org'),'customer','2030-01-10')->'accounts') x
 where x->>'id'=(select id::text from fx_ids where key='revenue')),'ordinary posting accounts do not acquire a Control binding');

select pg_temp.fx_ok((select variance_minor=0 from public.reconcile_control_accounts((select id from fx_ids where key='org'),'2030-01-10') where control_account_id=(select id from fx_ids where key='ar_control')),'AR original items and base Control reconcile');
select pg_temp.fx_ok((select variance_minor=0 from public.reconcile_control_accounts((select id from fx_ids where key='org'),'2030-01-10') where control_account_id=(select id from fx_ids where key='ap_control')),'AP original items and base Control reconcile');
select pg_temp.fx_ok((select sum(case when side='credit' then base_amount_minor else -base_amount_minor end)=40000 from public.transaction_entries where account_id=(select id from fx_ids where key='gain') and transaction_id=(select transaction_id from public.fx_settlements where id=(select id from fx_ids where key='ars1'))),'AR gain posts only to mapped realized gain');
select pg_temp.fx_ok((select sum(case when side='debit' then base_amount_minor else -base_amount_minor end)=40000 from public.transaction_entries where account_id=(select id from fx_ids where key='loss') and transaction_id=(select transaction_id from public.fx_settlements where id=(select id from fx_ids where key='aps1'))),'AP loss posts only to mapped realized loss');

-- Carry-forward revaluation, partial settlement, delta-only repeat and reclassification.
insert into fx_ids values ('ar2',pg_temp.fx_item('customer','customer','ar_control','revenue','AR-FX-2','USD',10000,50,'2030-02-01'));
select pg_temp.fx_ok((select delta_base_minor='50000' from public.preview_fx_revaluation((select id from fx_ids where key='org'),'customer',(select id from fx_ids where key='ar_control'),'2030-02-28','{"USD":{"rate":"55","reference":"CLOSE-55"}}')),'preview values USD 100 from EGP 5,000 to EGP 5,500');
insert into fx_ids values ('rev1',public.confirm_fx_revaluation((select id from fx_ids where key='org'),'customer',(select id from fx_ids where key='ar_control'),'2030-02-28','FEB-CLOSE','Approved closing worksheet','{"USD":{"rate":"55","reference":"CLOSE-55"}}','REV-1'));
insert into fx_ids values ('rev2',public.confirm_fx_revaluation((select id from fx_ids where key='org'),'customer',(select id from fx_ids where key='ar_control'),'2030-03-01','SAME-CLOSE','Approved closing worksheet','{"USD":{"rate":"55","reference":"CLOSE-55"}}','REV-2'));
select pg_temp.fx_ok((select total_delta_base_minor=0 and transaction_id is null from public.fx_revaluation_batches where id=(select id from fx_ids where key='rev2')),'repeating the same closing rate adds no journal');
insert into fx_ids values ('ar2half',pg_temp.fx_settle('customer','customer','ar_control','ar2','AR-SET-HALF',5000,5000,1,'USD',60,'2030-03-05'));
select pg_temp.fx_ok((select carrying_base_minor=275000 and settlement_base_minor=300000 and realized_fx_base_minor=50000 and reclassified_unrealized_base_minor=25000 from public.fx_settlements where id=(select id from fx_ids where key='ar2half')),'partial settlement consumes carrying value and reclassifies prior unrealized FX');
select pg_temp.fx_ok((select exists(select 1 from jsonb_array_elements(public.read_fx_workspace((select id from fx_ids where key='org'),'customer','2030-03-05')->'items')x where x->>'id'=(select id::text from fx_ids where key='ar2') and x->>'outstanding_minor'='5000' and x->>'carrying_base_minor'='275000')),'partial item retains exact original and carrying balances');
insert into fx_ids values ('ar2reverse',public.reverse_fx_settlement((select id from fx_ids where key='org'),(select id from fx_ids where key='ar2half'),'2030-03-06','Reviewed settlement correction','AR-SET-HALF-REV'));
select pg_temp.fx_ok((select exists(select 1 from jsonb_array_elements(public.read_fx_workspace((select id from fx_ids where key='org'),'customer','2030-03-06')->'items')x where x->>'id'=(select id::text from fx_ids where key='ar2') and x->>'outstanding_minor'='10000' and x->>'carrying_base_minor'='550000')),'linked reversal restores the exact revalued item');
select pg_temp.fx_ok((select variance_minor=0 from public.reconcile_control_accounts((select id from fx_ids where key='org'),'2030-03-06') where control_account_id=(select id from fx_ids where key='ar_control')),'revaluation and settlement reversal remain reconciled');

-- Currency scales and exact values above JavaScript safe integer range.
insert into fx_ids values ('jpy',pg_temp.fx_item('customer','customer','ar_control','revenue','JPY-0','JPY',1,0.505,'2030-04-01')),
 ('kwd',pg_temp.fx_item('supplier','supplier','ap_control','expense','KWD-3','KWD',1001,100,'2030-04-01')),
 ('large',pg_temp.fx_item('customer','customer','ar_control','revenue','USD-LARGE','USD',9007199254740993,1,'2030-04-01'));
select pg_temp.fx_ok((select original_base_minor=51 from public.fx_open_items where id=(select id from fx_ids where key='jpy')),'zero-decimal JPY half-away rounding is exact');
select pg_temp.fx_ok((select original_base_minor=10010 from public.fx_open_items where id=(select id from fx_ids where key='kwd')),'three-decimal KWD conversion is exact');
select pg_temp.fx_ok((select original_minor::text='9007199254740993' from public.fx_open_items where id=(select id from fx_ids where key='large')),'money above JS safe integer remains exact');

-- Explicit validation and unchanged base-currency AR behavior.
select pg_temp.fx_reject(format($q$select public.post_fx_settlement(%L,'customer',%L,%L,%L,'2030-04-02','BAD','EUR',1,60,'2030-04-02','source','rate','[]','BAD')$q$,(select id from fx_ids where key='org'),(select id from fx_ids where key='customer'),(select id from fx_ids where key='ar_control'),(select id from fx_ids where key='cash_eur')),'22023','unallocated settlement rejected');
select pg_temp.fx_reject(format($q$select public.post_fx_open_item(%L,'customer',%L,%L,%L,'2030-04-01','2030-04-30','NO-RATE','USD',100,null,'2030-04-01','source','evidence','NO-RATE')$q$,(select id from fx_ids where key='org'),(select id from fx_ids where key='customer'),(select id from fx_ids where key='ar_control'),(select id from fx_ids where key='revenue')),'22023','missing rate rejected');
insert into fx_ids values ('base_ar',public.post_ar_document((select id from fx_ids where key='org'),'invoice',(select id from fx_ids where key='customer'),(select id from fx_ids where key='ar_control'),'2030-05-01',12345,(select id from fx_ids where key='revenue'),'BASE-AR','BASE-AR','2030-05-31'));
select pg_temp.fx_ok((select original_minor='12345' from public.read_ar_open_items((select id from fx_ids where key='org'),'2030-05-01') where invoice_id=(select id from fx_ids where key='base_ar')),'existing base-currency AR path is unchanged');
insert into fx_ids values ('period',public.create_accounting_period((select id from fx_ids where key='org'),'2030-06-01','2030-06-30')); select public.transition_accounting_period((select id from fx_ids where key='period'),'soft_closed'); select public.transition_accounting_period((select id from fx_ids where key='period'),'hard_closed','Reviewed close');
select pg_temp.fx_reject(format($q$select public.post_fx_open_item(%L,'customer',%L,%L,%L,'2030-06-01','2030-06-30','LOCKED','USD',100,50,'2030-06-01','source','evidence','LOCKED')$q$,(select id from fx_ids where key='org'),(select id from fx_ids where key='customer'),(select id from fx_ids where key='ar_control'),(select id from fx_ids where key='revenue')),'42501','period lock rejects FX posting');

-- RLS/capability isolation and immutable evidence.
reset role; insert into public.organization_members(organization_id,user_id,role,status) values((select id from fx_ids where key='org'),'70000000-0000-4000-8000-000000000002','viewer','active'); set local role authenticated;
select set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.fx_reject(format($q$select public.confirm_fx_revaluation(%L,'customer',%L,'2030-05-31','NO','NO','{}','NO')$q$,(select id from fx_ids where key='org'),(select id from fx_ids where key='ar_control')),'42501','viewer cannot confirm revaluation');
select set_config('request.jwt.claims','{"sub":"70000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.fx_ok((select count(*)=0 from public.fx_open_items),'RLS hides foreign-tenant FX items');
select pg_temp.fx_reject(format($q$select public.read_fx_workspace(%L,'customer','2030-05-31')$q$,(select id from fx_ids where key='org')),'42501','foreign tenant cannot read FX workspace');
reset role;
select pg_temp.fx_reject(format($q$update public.fx_allocations set document_amount_minor=1 where settlement_id=%L$q$,(select id from fx_ids where key='ars1')),'55000','posted allocation evidence is immutable');
select pg_temp.fx_ok((select bool_and(balance=0) from (select transaction_id,sum(case when side='debit' then base_amount_minor else -base_amount_minor end) balance from public.transaction_entries where organization_id=(select id from fx_ids where key='org') and posted_at is not null group by transaction_id)x),'every FX journal balances in base minor units');
select '1..'||currval('fx_test_number');
rollback;
