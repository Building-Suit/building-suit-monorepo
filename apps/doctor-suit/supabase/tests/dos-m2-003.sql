begin;
\ir fixtures/clinical.sql
select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',pg_temp.snapshot()),3001);
select pg_temp.put('intake',jsonb_build_object('id',pg_temp.id(301),'kind','allergy','knowledge','unknown','text','','value','','unit','','source','patient'));
select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{intake}',jsonb_build_array(pg_temp.v('intake')))),3002);
select is(pg_temp.detail()->'versions'->0->'snapshot'->'intake'->0->>'knowledge','unknown','M2-003 unknown remains distinct from none reported');
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{intake}',jsonb_build_array(jsonb_set(pg_temp.v('intake'),'{text}','"Invented finding"')))),3003)$$,'22023',null,'M2-003 unknown cannot carry inferred finding');
select pg_temp.claim(3);
select throws_ok($$select pg_temp.command('save',jsonb_build_object('snapshot',jsonb_set(pg_temp.snapshot(),'{intake}',jsonb_build_array(jsonb_set(pg_temp.v('intake'),'{source}','"clinician"')))),3004)$$,'42501',null,'M2-003 staff cannot label own data clinician reviewed');
select pg_temp.claim(1);select is(pg_temp.detail()->'versions'->1->'snapshot'->'intake','[]'::jsonb,'M2-003 corrected intake retains original source version');
select * from finish();rollback;
