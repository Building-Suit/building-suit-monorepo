-- Exact JSON transport must preserve metadata types and invoker authority.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
select is(app.exact_minor_json('{"amount_minor":9007199254740993,"negative_minor":-9007199254740993,"zero_minor":0}'::jsonb),
  '{"amount_minor":"9007199254740993","negative_minor":"-9007199254740993","zero_minor":"0"}'::jsonb,
  'Positive, negative and zero monetary values retain exact decimal digits');
select is(app.exact_minor_json('{"rows":[{"amount_minor":9223372036854775807,"count":2}],"allocations":{"operating":9007199254740993,"financing":1},"balanced":true,"count":3}'::jsonb),
  '{"rows":[{"amount_minor":"9223372036854775807","count":2}],"allocations":{"operating":"9007199254740993","financing":"1"},"balanced":true,"count":3}'::jsonb,
  'Nested monetary rows and allocation maps preserve counts and booleans');
select is(app.exact_minor_json('{"rows":[],"allocations":{},"amount_minor":null,"count":0,"ready":false}'::jsonb),
  '{"rows":[],"allocations":{},"amount_minor":null,"count":0,"ready":false}'::jsonb,
  'Empty structures, nulls and metadata remain unchanged');
select is(app.exact_minor_json('{"amount_minor":"9007199254740993"}'::jsonb),
  '{"amount_minor":"9007199254740993"}'::jsonb, 'Existing exact strings are stable');
select ok(not (select prosecdef from pg_proc where oid='public.read_exact_financial_report(text,uuid,date,date,date,uuid)'::regprocedure),
  'Read adapter keeps caller authority');
select ok(not (select prosecdef from pg_proc where oid='public.classify_cash_flow_entry_exact(uuid,uuid,jsonb,text,uuid,uuid)'::regprocedure),
  'Write adapter keeps caller authority');
select ok(not has_function_privilege('anon','public.read_exact_financial_report(text,uuid,date,date,date,uuid)','EXECUTE'),
  'Anonymous report execution denied');
select ok(not has_function_privilege('anon','public.classify_cash_flow_entry_exact(uuid,uuid,jsonb,text,uuid,uuid)','EXECUTE'),
  'Anonymous allocation execution denied');
select ok(not has_function_privilege('anon','app.exact_minor_json(jsonb,boolean)','EXECUTE'),
  'Private serializer has no anonymous execution');
set local role authenticated;
select throws_ok($$select public.read_exact_financial_report('report_general_ledger','52000000-0000-4000-8000-000000000001')$$,
  '22023','FINANCIAL_REPORT_NOT_SUPPORTED','Adapter only permits its three explicit report providers');
select throws_ok($$select public.read_exact_financial_report('overview','52000000-0000-4000-8000-000000000001','2036-01-01','2036-12-31','2036-12-31')$$,
  '42501',null,'Exact overview does not bypass tenant authorization');
select throws_ok($$select public.read_exact_financial_report('cash_flow','52000000-0000-4000-8000-000000000001','2036-01-01','2036-12-31')$$,
  '42501',null,'Exact cash flow does not bypass tenant authorization');
select throws_ok($$select public.read_exact_financial_report('cash_allocation','52000000-0000-4000-8000-000000000001',p_entry_id=>'52000000-0000-4000-8000-000000000002')$$,
  '42501',null,'Allocation context retains its invoker tenant boundary');
select throws_ok($$select public.classify_cash_flow_entry_exact('52000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000002','{"operating":"9223372036854775808"}','Untrusted oversized value',gen_random_uuid())$$,
  '42501',null,'Write authorization runs before payload conversion');
reset role;
select * from finish();
rollback;
