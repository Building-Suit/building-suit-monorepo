-- Explicit group roles and preservation of existing posting semantics.
-- Only synthetic local/staging fixtures; all mutations roll back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
create temp table group_ids (key text primary key, id uuid);
grant all on group_ids to authenticated;
insert into group_ids select 'org', id from public.organizations where name='Alpha Trading';
insert into group_ids select 'other-org', id from public.organizations where name='Beta Supplies';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
insert into group_ids values
 ('legacy', public.create_account((select id from group_ids where key='org'), 'Legacy posting parent', 'asset', 'bank')),
 ('capital', public.create_account((select id from group_ids where key='org'), 'Group test capital', 'equity', 'owner_capital')),
 ('group', public.create_account((select id from group_ids where key='org'), 'Bank group', 'asset', 'bank', p_account_role=>'group')),
 ('revenue-group', public.create_account((select id from group_ids where key='org'), 'Income group', 'revenue', 'service_revenue', p_account_role=>'group')),
 ('equity-group', public.create_account((select id from group_ids where key='org'), 'Drawings group', 'equity', 'owner_drawings', p_account_role=>'group'));
insert into group_ids values
 ('child', public.create_account((select id from group_ids where key='org'), 'Bank child', 'asset', 'bank', p_parent_account_id=>(select id from group_ids where key='group'))),
 ('legacy-child', public.create_account((select id from group_ids where key='org'), 'Legacy compatible child', 'asset', 'bank', p_parent_account_id=>(select id from group_ids where key='legacy')));
select is((select account_role from public.accounts where id=(select id from group_ids where key='legacy')), 'posting', 'old create calls default to posting');
select is((select account_role from public.account_balances where account_id=(select id from group_ids where key='group')), 'group', 'balance view exposes explicit group role');
select is((select is_liquid from public.accounts where id=(select id from group_ids where key='group')), false, 'even a bank-subtype group is not liquid');
select is((select is_liquid from public.accounts where id=(select id from group_ids where key='child')), true, 'posting bank child is still liquid');
select is((select parent_account_id from public.accounts where id=(select id from group_ids where key='child')), (select id from group_ids where key='group'), 'group is a valid parent');
select is((select count(*) from public.categories where default_account_id=(select id from group_ids where key='revenue-group')), 0::bigint, 'revenue group never creates an operational category');
select is((select system_key from public.accounts where id=(select id from group_ids where key='equity-group')), null::text, 'group never takes a posting system key');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_account_role=>%L)',
 (select id from group_ids where key='org'), 'Invalid role', 'asset', 'bank', 'invalid'), '22023', 'INVALID_ACCOUNT_ROLE', 'unsupported roles fail at database boundary');
select throws_ok(format('update public.accounts set account_role=%L where id=%L', 'group', (select id from group_ids where key='legacy')),
 '23514', 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning', 'legacy posting role cannot be converted');
select throws_ok(format('update public.accounts set account_role=%L where id=%L', 'posting', (select id from group_ids where key='group')),
 '23514', 'ACCOUNT_ROLE_IMMUTABLE: create a new account instead of changing historical meaning', 'group role cannot become a posting role');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_parent_account_id=>%L)',
 (select id from group_ids where key='org'), 'Wrong type', 'liability', 'loan', (select id from group_ids where key='group')),
 '23514', null, 'parent must share the account type');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_normal_balance=>%L,p_contra_account_id=>%L)',
 (select id from group_ids where key='org'), 'Group contra target', 'asset', 'bank', 'credit', (select id from group_ids where key='group')),
 '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: a group cannot be a contra target', 'group is not a contra target');
select throws_ok(format('insert into public.categories(organization_id,name,kind,default_account_id) values(%L,%L,%L,%L)',
 (select id from group_ids where key='org'), 'Invalid category', 'income', (select id from group_ids where key='revenue-group')),
 '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account', 'direct category writes cannot reference groups');

insert into group_ids values ('draft', public.create_draft_transaction(
 (select id from group_ids where key='org'), 'adjustment', '2026-09-01', jsonb_build_array(
  jsonb_build_object('account_id',(select id from group_ids where key='legacy'),'side','debit','amount_minor',100),
  jsonb_build_object('account_id',(select id from group_ids where key='capital'),'side','credit','amount_minor',100)), p_adjustment_reason=>'Disposable test'));
select ok(not has_table_privilege('authenticated', 'public.transaction_entries', 'INSERT'), 'direct client writes remain forbidden');
reset role;
select throws_ok(format('insert into public.transaction_entries(organization_id,transaction_id,account_id,entry_index,side,amount_minor) values(%L,%L,%L,3,%L,1)',
 (select id from group_ids where key='org'), (select id from group_ids where key='draft'), (select id from group_ids where key='group'), 'debit'),
 '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account', 'direct entry insert rejects group');
select throws_ok(format('update public.transaction_entries set account_id=%L where transaction_id=%L and side=%L',
 (select id from group_ids where key='group'), (select id from group_ids where key='draft'), 'debit'),
 '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account', 'direct draft edit cannot switch into group');
set local role authenticated;
select throws_ok(format('select public.create_adjustment(%L,%L,%L::jsonb,%L,%L)',
 (select id from group_ids where key='org'), '2026-09-01', jsonb_build_array(
  jsonb_build_object('account_id',(select id from group_ids where key='group'),'side','debit','amount_minor',100),
  jsonb_build_object('account_id',(select id from group_ids where key='capital'),'side','credit','amount_minor',100))::text,
 'Invalid group journal', 'Test'), '23514', 'ACCOUNT_GROUP_NOT_POSTABLE: choose a posting account', 'posting RPC rejects group');
select lives_ok(format('select public.post_transaction(%L)', (select id from group_ids where key='draft')), 'legacy parent with a child still receives postings');
select is((select net_debit_minor from public.account_balances where account_id=(select id from group_ids where key='legacy')), '100', 'parent direct balance is preserved');
select is((select count(*) from public.transaction_entries where account_id=(select id from group_ids where key='group')), 0::bigint, 'failed group writes leave no partial entries');
select is((select entry_count from public.account_balances where account_id=(select id from group_ids where key='group')), 0::bigint, 'group has no direct ledger balance');
select lives_ok(format('select public.update_account(%L,%L)', (select id from group_ids where key='group'), 'Renamed group'), 'existing update RPC can rename a group');
select throws_ok(format('update public.accounts set type=%L, subtype=%L where id=%L', 'expense', 'other_expense', (select id from group_ids where key='group')),
 '23514', 'ACCOUNT_PARENT_CLASSIFICATION_LOCKED: child accounts depend on this type and currency', 'parent classification cannot invalidate its children');

-- Cross-tenant checks and viewer restrictions retain the established boundary.
reset role;
insert into group_ids values ('foreign-group', (select id from public.accounts where false));
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
set local role authenticated;
update group_ids set id=public.create_account((select id from group_ids where key='other-org'), 'Foreign group', 'asset', 'bank', p_account_role=>'group') where key='foreign-group';
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.accounts where id=(select id from group_ids where key='foreign-group')), 0::bigint, 'foreign group hidden by RLS');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_parent_account_id=>%L)',
 (select id from group_ids where key='org'), 'Cross tenant', 'asset', 'bank', (select id from group_ids where key='foreign-group')),
 '23514', 'INVALID_ACCOUNT_PARENT: choose an active parent in this organization', 'cross-tenant parent cannot be selected');
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_account_role=>%L)',
 (select id from group_ids where key='other-org'), 'Intrusion', 'asset', 'bank', 'group'), '42501', null, 'group creation requires tenant capability');
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
select throws_ok(format('select public.create_account(%L,%L,%L,%L,p_account_role=>%L)',
 (select id from group_ids where key='org'), 'Viewer group', 'asset', 'bank', 'group'), '42501', null, 'viewer cannot create groups');
reset role;
select ok(not has_function_privilege('anon', 'public.create_account(uuid,text,public.account_type,public.account_subtype,character,text,uuid,public.normal_balance,uuid,text,public.control_subledger_type)', 'EXECUTE'), 'anon has no create RPC grant');
select ok(not has_function_privilege('authenticated', 'app.require_posting_account_reference()', 'EXECUTE'), 'trigger helper is not client-callable');
select * from finish();
rollback;
