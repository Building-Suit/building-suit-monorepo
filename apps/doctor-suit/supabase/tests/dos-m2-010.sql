begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),10001);
select pg_temp.put('order',jsonb_build_object('id',pg_temp.id(500),'kind','lab','request','Synthetic authored request','due_at',null,'state','requested','reason',''));
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{orders}',jsonb_build_array(pg_temp.v('order')))),10002);
select is(pg_temp.detail()->'versions'->0->'snapshot'->'orders'->0->>'state','requested','M2-010 authored request does not imply external delivery or interpretation');
select pg_temp.claim(3);select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{orders}',jsonb_build_array(pg_temp.v('order')))),10003)$$,'42501',null,'M2-010 staff draft grant cannot author clinical orders');
select pg_temp.claim(1);select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{orders}',jsonb_build_array(jsonb_set(pg_temp.v('order'),'{state}','"cancelled"')))),10004)$$,'22023',null,'M2-010 cancellation requires an explicit retained reason');
select * from finish();rollback;
