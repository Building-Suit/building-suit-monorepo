-- Rollback-only SQL contract; real Auth/socket checks use sas-live-disposable.mjs.
begin;
create temporary table live_fixture(owner_id uuid default gen_random_uuid(),other_id uuid default gen_random_uuid(),environment_id uuid default gen_random_uuid(),other_environment uuid default gen_random_uuid(),session_id uuid default gen_random_uuid());
insert into live_fixture default values;
grant select on live_fixture to authenticated,anon;
insert into auth.users(id) select owner_id from live_fixture union all select other_id from live_fixture;
insert into auth.sessions(id,user_id) select session_id,owner_id from live_fixture;
insert into public.admin_environments(id,stable_key,environment_kind,display_name,status)
 select environment_id,'sql-live-'||left(environment_id::text,8),'local','{}'::jsonb,'active' from live_fixture
 union all select other_environment,'sql-live-'||left(other_environment::text,8),'local','{}'::jsonb,'active' from live_fixture;
insert into public.platform_admins(user_id,authority_environment_id,provisioned_by) select owner_id,environment_id,owner_id from live_fixture;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id)::text,true) from live_fixture;
set local role authenticated;
do $$declare topic text;begin
 topic:=public.super_admin_live_topic();
 if topic not like 'sas:%' then raise exception 'topic not server constructed';end if;
 begin perform public.super_admin_live_flush(1);raise exception 'owner flushed server queue';exception when insufficient_privilege then null;end;
 begin perform super_admin_private.live_enqueue('forged',gen_random_uuid(),null,array['activity']);raise exception 'owner emitted event';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- Capture a real emit; only safe invalidation fields may be present.
do $$declare f live_fixture;begin select * into f from live_fixture;
 perform super_admin_private.live_enqueue('sql-live-once',f.environment_id,null,array['activity']);
 perform super_admin_private.live_enqueue('sql-live-once',f.environment_id,null,array['activity']);
 if (select count(*) from public.admin_live_invalidations where source_key='sql-live-once')<>1 then raise exception 'duplicate queued event';end if;
end $$;
-- A publication failure preserves pending work and rolls back partial sends.
create function pg_temp.live_fail_ack() returns trigger language plpgsql as $$begin raise exception 'Synthetic publication interrupted' using errcode='55000';end $$;
create trigger live_fixture_fail_ack before update on public.admin_live_invalidations for each row when(new.delivered_at is not null) execute function pg_temp.live_fail_ack();
select super_admin_private.live_enqueue('sql-live-retry',environment_id,null,array['activity']) from live_fixture;
drop trigger live_fixture_fail_ack on public.admin_live_invalidations;
do $$begin if not exists(select 1 from public.admin_live_invalidations where source_key='sql-live-retry' and delivered_at is null) then raise exception 'failed publication lost pending work';end if;end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
do $$begin if public.super_admin_live_flush(100)<>1 or public.super_admin_live_flush(100)<>0 then raise exception 'server replay not idempotent';end if;end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id)::text,true) from live_fixture;
-- Protect our namespace even if an unrelated permissive policy is installed.
create policy live_fixture_broad_read on realtime.messages for select to authenticated using(true);
create policy live_fixture_broad_write on realtime.messages for insert to authenticated with check(true);
insert into realtime.messages(id,extension,topic,payload,event,private) select gen_random_uuid(),'broadcast','sas:'||other_environment::text||':'||other_id::text||':'||session_id::text,'{"foreign":true}','invalidate',true from live_fixture;
select set_config('realtime.topic',public.super_admin_live_topic(),true);
set local role authenticated;
do $$begin
 if not exists(select 1 from realtime.messages where extension='broadcast') then raise exception 'authorized receive denied';end if;
 if exists(select 1 from realtime.messages where payload ? 'foreign') then raise exception 'foreign message readable through own topic';end if;
 begin insert into realtime.messages(id,extension,topic,payload,event,private) values(gen_random_uuid(),'broadcast',realtime.topic(),'{}','invalidate',true);
 raise exception 'client send permitted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('realtime.topic','sas:foreign-operator',true);
set local role authenticated;
do $$begin if exists(select 1 from realtime.messages) then raise exception 'foreign subscription permitted';end if;end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',other_id,'role','authenticated','session_id',session_id)::text,true) from live_fixture;
set local role authenticated;
do $$begin begin perform public.super_admin_live_topic();raise exception 'nonoperator got topic';exception when insufficient_privilege then null;end;end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated','session_id',session_id)::text,true) from live_fixture;
update public.platform_admins set enabled=false,disabled_at=clock_timestamp() where user_id=(select owner_id from live_fixture);
set local role authenticated;
do $$begin begin perform public.super_admin_live_topic();raise exception 'revoked owner got topic';exception when insufficient_privilege then null;end;end $$;
reset role;
rollback;
