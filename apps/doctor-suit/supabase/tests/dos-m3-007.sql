begin;
\ir fixtures/clinical.sql
select is(public.doctor_outbox(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),0)->>'external_delivery','false','no provider reports externally delivered');
select is(public.doctor_outbox(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),0)->>'total','0','no configured provider invents a message or acceptance');
select throws_ok($$select public.doctor_outbox_command(pg_temp.practice(),pg_temp.location(),pg_temp.patient(),pg_temp.id(7000),0,'configure_provider','{"approved":true}',pg_temp.id(7001))$$,'22023','DOCTOR_OUTBOX_INVALID','provider activation is not a supported command');
reset role;
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('doctor_provider_callback','doctor_activate_provider')),'no callback or activation RPC exists');
select ok(not has_function_privilege('anon','public.doctor_outbox_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid)','execute'),'unauthenticated external callbacks cannot mutate neutral outbox');
select * from finish();rollback;
