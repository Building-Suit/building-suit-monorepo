-- Focused disposable-local V2-IMP-009 fixture. Roll back all synthetic data.
begin;
do $$ begin
  if to_regprocedure('public.post_ap_document(uuid,text,uuid,uuid,date,bigint,uuid,text,text,date,jsonb,text,uuid)') is null then
    raise exception 'V2-IMP-009 prerequisite: apply 20260925143000_accrual_supplier_subledger.sql to the disposable local verification database before running this fixture';
  end if;
end $$;
create temp sequence ap_test_number;
create function pg_temp.check_ap(ok boolean,label text) returns text language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %',label; end if;
  return 'ok ' || nextval('ap_test_number') || ' - ' || label;
end;
$$;
create function pg_temp.reject_ap(sql text,expected_code text,label text) returns text language plpgsql as $$
declare actual text;
begin
  begin execute sql; exception when others then actual:=sqlstate; end;
  return pg_temp.check_ap(actual=expected_code,label || ' (SQLSTATE ' || coalesce(actual,'none') || ')');
end;
$$;
create temp table ap_ids(key text primary key,id uuid);
grant all on ap_ids to authenticated;
grant all on sequence ap_test_number to authenticated;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
 ('42000000-0000-4000-8000-000000000001','ap-owner@test.local','{}','{}'),
 ('42000000-0000-4000-8000-000000000002','ap-viewer@test.local','{}','{}'),
 ('42000000-0000-4000-8000-000000000003','ap-outsider@test.local','{}','{}');
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
insert into ap_ids values ('org',public.create_organization('AP fixture','EGP'));
insert into ap_ids values
 ('control',public.create_account((select id from ap_ids where key='org'),'AP Control','liability','accounts_payable',p_account_role=>'control',p_control_subledger_type=>'supplier')),
 ('cash',public.create_account((select id from ap_ids where key='org'),'AP cash','asset','cash')),
 ('expense',public.create_account((select id from ap_ids where key='org'),'Purchased services','expense','other_expense')),
 ('asset',public.create_account((select id from ap_ids where key='org'),'Purchased equipment','asset','other_asset')),
 ('supplier',public.create_counterparty((select id from ap_ids where key='org'),'Supplier one','vendor')),
 ('other',public.create_counterparty((select id from ap_ids where key='org'),'Supplier two','vendor'));
-- Helpers still call the public authorized paths as the current test role.
create function pg_temp.ap_post(kind text,amount bigint,dt date,key text,allocations jsonb default '[]',supplier_key text default 'supplier',offset_key text default null)
returns uuid language sql as $$
 select public.post_ap_document((select id from ap_ids where key='org'),kind,
  (select id from ap_ids where key=supplier_key),(select id from ap_ids where key='control'),dt,amount,
  (select id from ap_ids where key=coalesce(offset_key,case kind when 'payment' then 'cash' else 'expense' end)),
  key,key,case when kind='bill' then dt end,allocations,case when kind in ('credit','adjustment') then 'Reviewed correction' end);
$$;
create function pg_temp.ap_alloc(key text,amount bigint) returns jsonb language sql as $$
 select jsonb_build_array(jsonb_build_object('bill_id',(select id from ap_ids where ap_ids.key=$1),'amount_minor',amount::text));
$$;
create function pg_temp.ap_reverse(key text,dt date,retry_key text) returns uuid language sql as $$
 select public.reverse_ap_document((select id from ap_ids where ap_ids.key='org'),(select id from ap_ids where ap_ids.key=$1),dt,'Correct allocation',retry_key);
$$;
insert into ap_ids values ('i1',pg_temp.ap_post('bill',10000,'2030-01-01','BILL-1')),
 ('i2',pg_temp.ap_post('bill',5000,'2030-01-02','BILL-2','[]','supplier','asset'));
select pg_temp.check_ap(pg_temp.ap_post('bill',10000,'2030-01-01','BILL-1')=(select id from ap_ids where key='i1'),'same bill retry returns original');
select pg_temp.reject_ap($q$select pg_temp.ap_post('bill',10001,'2030-01-01','BILL-1')$q$,'23505','changed retry payload conflicts');
select pg_temp.check_ap((select count(*)=2 from public.ap_documents where organization_id=(select id from ap_ids where key='org')),'two bills recognized exactly once');
insert into ap_ids values ('r1',pg_temp.ap_post('payment',7000,'2030-01-10','PAY-1',pg_temp.ap_alloc('i1',4000)||pg_temp.ap_alloc('i2',3000)));
select pg_temp.check_ap(pg_temp.ap_post('payment',7000,'2030-01-10','PAY-1',pg_temp.ap_alloc('i2',3000)||pg_temp.ap_alloc('i1',4000))=(select id from ap_ids where key='r1'),'payment retry canonicalizes allocation order');
select pg_temp.check_ap((select outstanding_minor='6000' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-10') where bill_id=(select id from ap_ids where key='i1')),'partial settlement leaves exact outstanding');
select pg_temp.check_ap((select sum(case when side='debit' then amount_minor else -amount_minor end)=10000 from public.transaction_entries where account_id=(select id from ap_ids where key='expense') and posted_at is not null),'payment does not recognize expense again');
select pg_temp.check_ap((select sum(case when side='debit' then amount_minor else -amount_minor end)=5000 from public.transaction_entries where account_id=(select id from ap_ids where key='asset') and posted_at is not null),'payment does not recognize asset again');
select pg_temp.check_ap((select count(*)=2 from public.ap_allocations where document_id=(select id from ap_ids where key='r1')),'one payment allocates to multiple bills');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',1,'2030-01-10','EMPTY')$q$,'23514','unallocated payment rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',6001,'2030-01-11','OVER',pg_temp.ap_alloc('i1',6001))$q$,'23514','overpayment rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',6001,'2030-01-05','BACKDATE',pg_temp.ap_alloc('i1',6001))$q$,'23514','backdate cannot consume a later allocation');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',10,'2029-12-31','EARLY',pg_temp.ap_alloc('i1',10))$q$,'23514','allocation before bill rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',10,'2030-01-11','WRONG-SUPPLIER',pg_temp.ap_alloc('i1',10),'other')$q$,'23514','cross-supplier allocation rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('credit',10,'2030-01-11','WRONG-ACCOUNT',pg_temp.ap_alloc('i2',10))$q$,'23514','credit must reverse the bill original expense or asset account');
select pg_temp.reject_ap($q$select pg_temp.ap_reverse('i1','2030-01-11','REVERSE-SETTLED')$q$,'23514','bill reversal cannot strand allocations');
insert into ap_ids values ('credit',pg_temp.ap_post('credit',1000,'2030-01-12','CREDIT',pg_temp.ap_alloc('i1',1000))),
 ('correction',pg_temp.ap_post('adjustment',1000,'2030-01-13','CORRECTION',pg_temp.ap_alloc('i2',1000),'supplier','asset'));
insert into ap_ids values ('r2',pg_temp.ap_post('payment',5000,'2030-01-15','PAY-2',pg_temp.ap_alloc('i1',5000)));
select pg_temp.check_ap(not exists(select 1 from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-15') where bill_id=(select id from ap_ids where key='i1')),'multiple payments fully settle bill');
select pg_temp.check_ap((select sum(outstanding_minor::bigint)=15000 from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-02')),'historical balances exclude later payments and credits');
select pg_temp.check_ap((select variance_minor=0 and status='reconciled' from public.reconcile_control_accounts((select id from ap_ids where key='org'),'2030-01-15') where control_account_id=(select id from ap_ids where key='control')),'dated subledger reconciles to real AP Control');
select pg_temp.check_ap((select (s->>'opening_minor')::bigint+(s->>'bills_minor')::bigint+(s->>'adjustments_minor')::bigint-(s->>'payments_minor')::bigint=(s->>'closing_minor')::bigint and s->>'closing_minor'='1000' from (select public.read_ap_statement((select id from ap_ids where key='org'),(select id from ap_ids where key='supplier'),'2030-01-05','2030-01-15') s) x),'statement roll-forward including nonzero opening');
insert into ap_ids values ('rr2',pg_temp.ap_reverse('r2','2030-01-20','REV-R2'));
select pg_temp.check_ap(pg_temp.ap_reverse('r2','2030-01-20','REV-R2')=(select id from ap_ids where key='rr2'),'reversal retry returns original');
select pg_temp.check_ap((select outstanding_minor='5000' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-20') where bill_id=(select id from ap_ids where key='i1')),'reversal reopens original allocation');
select pg_temp.check_ap((select count(*)=1 from public.ap_allocations where document_id=(select id from ap_ids where key='rr2') and reverses_allocation_id is not null and ap_effect_minor=5000),'reversal allocation links immutable original');
select pg_temp.reject_ap($q$select pg_temp.ap_reverse('r2','2030-01-21','DUP-REV')$q$,'23514','second reversal rejected');
select pg_temp.reject_ap($q$select public.reverse_transaction((select transaction_id from public.ap_documents where id=(select id from ap_ids where key='r1')),'bypass','2030-01-20')$q$,'23514','generic journal reversal cannot bypass subledger');
select pg_temp.check_ap((select variance_minor=0 from public.reconcile_control_accounts((select id from ap_ids where key='org'),'2030-01-20') where control_account_id=(select id from ap_ids where key='control')),'reversed allocation and GL remain reconciled');
select pg_temp.check_ap((select count(*)=1 and min(aging_bucket)='1_30' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-02-01') where bill_id=(select id from ap_ids where key='i2')),'30 days overdue belongs exactly once to 1-30');
select pg_temp.check_ap((select aging_bucket='31_60' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-02-02') where bill_id=(select id from ap_ids where key='i2')),'31 days belongs to 31-60');
select pg_temp.check_ap((select aging_bucket='current' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-01') where bill_id=(select id from ap_ids where key='i1')),'due today is current');
select pg_temp.check_ap((select aging_bucket='61_90' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-03-04') where bill_id=(select id from ap_ids where key='i2')),'61 days belongs to 61-90');
select pg_temp.check_ap((select aging_bucket='91_plus' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-04-03') where bill_id=(select id from ap_ids where key='i2')),'91 days belongs to 91+');
reset role;
select pg_temp.reject_ap($q$update public.ap_documents set amount_minor=1 where id=(select id from ap_ids where key='i1')$q$,'55000','documents immutable even to table owner');
select pg_temp.reject_ap($q$delete from public.ap_allocations where document_id=(select id from ap_ids where key='r1')$q$,'55000','allocations cannot be deleted');
insert into public.organization_members(organization_id,user_id,role,status) values((select id from ap_ids where key='org'),'42000000-0000-4000-8000-000000000002','viewer','active');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.reject_ap($q$select pg_temp.ap_post('bill',1,'2030-01-01','VIEWER')$q$,'42501','viewer cannot issue');
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.check_ap((select count(*)=0 from public.ap_documents),'RLS hides all foreign documents');
select pg_temp.check_ap((select count(*)=0 from public.ap_allocations),'RLS hides all foreign allocations');
select pg_temp.reject_ap($q$select public.read_ap_workspace((select id from ap_ids where key='org'),'2030-01-20','2030-01-01')$q$,'42501','foreign tenant report rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('bill',1,'2030-01-01','FOREIGN')$q$,'42501','foreign tenant posting rejected');
select set_config('request.jwt.claims','{"sub":"42000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into ap_ids values ('period',public.create_accounting_period((select id from ap_ids where key='org'),'2030-02-01','2030-02-28'));
select public.transition_accounting_period((select id from ap_ids where key='period'),'soft_closed');
select pg_temp.reject_ap($q$select pg_temp.ap_post('bill',1,'2030-02-01','SOFT')$q$,'42501','soft close blocks ordinary AP');
select public.transition_accounting_period((select id from ap_ids where key='period'),'hard_closed','Reviewed');
select pg_temp.reject_ap($q$select pg_temp.ap_reverse('r1','2030-02-02','HARD')$q$,'42501','hard close blocks AP reversal');
-- Legacy evidence is read-only and never contributes to the accrual provider.
reset role;
insert into public.commitments(organization_id,type,title,amount_minor,currency_code,due_date,counterparty_id,created_by)
values((select id from ap_ids where key='org'),'payable','Legacy cash-basis',900,'EGP','2030-01-01',(select id from ap_ids where key='supplier'),auth.uid());
set local role authenticated;
select pg_temp.check_ap((select legacy_open_minor='900' and treatment='review_required_cash_basis_excluded' from public.preview_legacy_ap((select id from ap_ids where key='org'))),'legacy mapping preview preserves excluded amount');
select pg_temp.check_ap((select variance_minor=0 and subledger_balance_minor=6000 from public.reconcile_control_accounts((select id from ap_ids where key='org'),'2030-01-20') where control_account_id=(select id from ap_ids where key='control')),'legacy commitments never silently become AP');
select pg_temp.check_ap((select jsonb_typeof(public.read_ap_workspace((select id from ap_ids where key='org'),'2030-01-20','2030-01-01')->'reconciliation'->0->'gl_balance_minor')='string'),'workspace monetary values preserve exact JSON text');

select pg_temp.ap_reverse('credit','2030-01-21','REV-CREDIT');
select pg_temp.check_ap((select outstanding_minor='6000' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-21') where bill_id=(select id from ap_ids where key='i1')),'credit reversal restores outstanding');
select pg_temp.ap_reverse('correction','2030-01-22','REV-CORRECTION');
select pg_temp.check_ap((select outstanding_minor='2000' from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-22') where bill_id=(select id from ap_ids where key='i2')),'correction reversal restores outstanding');
select pg_temp.ap_reverse('r1','2030-01-23','REV-MULTI');
select pg_temp.check_ap((select sum(outstanding_minor::bigint)=15000 from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-23')),'multi-bill payment reversal restores both items');
select pg_temp.ap_reverse('i1','2030-01-24','REV-I1');
select pg_temp.ap_reverse('i2','2030-01-24','REV-I2');
select pg_temp.check_ap((select count(*)=0 from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-24')),'unsettled bills can be reversed without deleting originals');
select pg_temp.check_ap((select subledger_balance_minor=0 and gl_balance_minor=0 and variance_minor=0 from public.reconcile_control_accounts((select id from ap_ids where key='org'),'2030-01-24') where control_account_id=(select id from ap_ids where key='control')),'complete lifecycle returns Control and subledger to zero');
select pg_temp.check_ap((select sum(case when side='debit' then amount_minor else -amount_minor end)=0 from public.transaction_entries where account_id in ((select id from ap_ids where key='expense'),(select id from ap_ids where key='asset')) and posted_at is not null),'complete corrections return expense and asset to zero');
select pg_temp.check_ap((select sum(outstanding_minor::bigint)=6000 from public.read_ap_open_items((select id from ap_ids where key='org'),'2030-01-20')),'later reversals preserve historical balances');
insert into ap_ids values ('large',pg_temp.ap_post('bill',9007199254740993,'2031-01-01','LARGE'));
select pg_temp.check_ap((select outstanding_minor='9007199254740993' from public.read_ap_open_items((select id from ap_ids where key='org'),'2031-01-01') where bill_id=(select id from ap_ids where key='large')),'open items preserve integers above JavaScript safe range');
select pg_temp.reject_ap($q$select pg_temp.ap_post('payment',10,'2031-01-02','DUP-ALLOC',pg_temp.ap_alloc('large',5)||pg_temp.ap_alloc('large',5))$q$,'23514','duplicate allocation targets rejected');
select pg_temp.reject_ap($q$select pg_temp.ap_post('credit',1,'2031-01-02','REVERSED-ITEM',pg_temp.ap_alloc('i1',1))$q$,'23514','cannot allocate to a reversed bill');
select pg_temp.reject_ap($q$insert into public.ap_allocations(organization_id,document_id,bill_id,amount_minor,ap_effect_minor) values((select id from ap_ids where key='org'),(select id from ap_ids where key='r1'),(select id from ap_ids where key='large'),1,-1)$q$,'42501','authenticated clients cannot insert allocation history');
select pg_temp.reject_ap($q$select app.begin_control_posting((select id from ap_ids where key='org'),(select id from ap_ids where key='control'),'supplier','spoof','2031-01-02','subledger')$q$,'42501','trusted Control boundary is not client executable');
reset role;
update public.organization_settings set require_adjustment_approval=true where organization_id=(select id from ap_ids where key='org');
set local role authenticated;
select pg_temp.reject_ap($q$select pg_temp.ap_post('adjustment',1,'2031-01-02','APPROVAL',pg_temp.ap_alloc('large',1))$q$,'42501','correction does not bypass configured adjustment approval');
select pg_temp.check_ap((select bool_and(balance=0) from (select transaction_id,sum(case when side='debit' then base_amount_minor else -base_amount_minor end) balance from public.transaction_entries where organization_id=(select id from ap_ids where key='org') and posted_at is not null group by transaction_id) x),'all committed journals balance in base minor units');
set constraints all immediate;
reset role;
update public.subscriptions set status='cancelled' where organization_id=(select id from ap_ids where key='org');
set local role authenticated;
select pg_temp.reject_ap($q$select pg_temp.ap_post('bill',1,'2030-01-01','READONLY')$q$,'42501','subscription read-only blocks AP writes');
select pg_temp.check_ap((select count(*)>0 from public.ap_documents),'subscription read-only retains AP history');
select '1..' || currval('ap_test_number');
rollback;
