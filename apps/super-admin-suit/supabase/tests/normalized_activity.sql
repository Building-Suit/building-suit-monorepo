-- Local/disposable only. Projection authorization, redaction and pagination.
begin;
select plan(6);
create temporary table activity_fixture as select gen_random_uuid() actor, gen_random_uuid() outsider, gen_random_uuid() environment;
grant select on activity_fixture to authenticated;
insert into auth.users(id,email,aud,role) select actor,actor::text||'@activity.invalid','authenticated','authenticated' from activity_fixture
union all select outsider,outsider::text||'@activity.invalid','authenticated','authenticated' from activity_fixture;
insert into public.admin_environments(id,stable_key,environment_kind,display_name,status)
select environment,'activity-fixture','local','{"en":"Synthetic activity"}','active' from activity_fixture;
insert into public.platform_admins(user_id,authority_environment_id,provisioned_by)
select actor,environment,actor from activity_fixture;
insert into public.control_plane_events(request_id,correlation_id,actor_user_id,actor_role,authority_environment_id,action,target_type,target_id,reason,result,request_fingerprint,occurred_at)
select gen_random_uuid(),gen_random_uuid(),actor,'owner',environment,'synthetic.review','synthetic',gen_random_uuid(),'synthetic sensitive reason','{"token":"synthetic-secret"}','synthetic',stamp
from activity_fixture cross join (values('2026-01-01T00:00:00Z'::timestamptz),('2026-01-02T00:00:00Z'::timestamptz)) times(stamp);
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from activity_fixture;
set local role authenticated;
select throws_ok($$select public.super_admin_activity_read('{}')$$,'42501','PLATFORM_OWNER_REQUIRED','outsider denied');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true) from activity_fixture;
set local role authenticated;
select is((public.super_admin_activity_read('{"action":"synthetic.review","pageSize":1,"page":2,"order":"asc"}')->>'total')::integer,2,'server total includes both rows');
select is(jsonb_array_length(public.super_admin_activity_read('{"action":"synthetic.review","pageSize":1,"page":2,"order":"asc"}')->'items'),1,'server page is bounded');
select is((public.super_admin_activity_read('{"action":"synthetic.review","from":"2026-01-02T00:00:00Z"}')->>'total')::integer,1,'time filter applies before pagination');
select ok(public.super_admin_activity_read('{"action":"synthetic.review"}')::text not like '%synthetic-secret%' and public.super_admin_activity_read('{"action":"synthetic.review"}')::text not like '%synthetic sensitive reason%','raw result and reason do not reach support projection');
reset role;
select throws_ok($$delete from public.activity_remote_events$$,'55000','ACTIVITY_REMOTE_EVENTS_IMMUTABLE','remote observations immutable even to privileged SQL');
select * from finish();
rollback;
