-- Task-owned adapters only. No provider schemas, Vault secrets, cron jobs or
-- external requests are changed, even in the disposable backend.
create temporary table reminder_schedule_calls(kind text,payload jsonb);
create temporary table reminder_schedule_secrets(value jsonb);
insert into reminder_schedule_secrets values(jsonb_build_array(
 jsonb_build_object('name','shop_reminder_project_url','value','https://jvvelvftpfnlogalgxgv.supabase.co'),
 jsonb_build_object('name','shop_reminder_server_key','value',repeat('s',32)),
 jsonb_build_object('name','shop_reminder_worker_token','value',repeat('w',32))));
create or replace function shop_private.reminder_schedule_credentials(p_project_ref text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 return shop_private.reminder_schedule_binding(p_project_ref,(select value from pg_temp.reminder_schedule_secrets));
end$$;
create or replace function shop_private.reminder_schedule_http(p_url text,p_headers jsonb) returns bigint language plpgsql security definer set search_path='' as $$begin
 insert into pg_temp.reminder_schedule_calls values('http',jsonb_build_object('url',p_url,'headers',p_headers));return 987;
end$$;
create or replace function shop_private.reminder_schedule_cron(p_enabled boolean) returns bigint language plpgsql security definer set search_path='' as $$begin
 insert into pg_temp.reminder_schedule_calls values('cron',jsonb_build_object('enabled',p_enabled));return case when p_enabled then 321 else null end;
end$$;
do $$declare result jsonb;secrets jsonb;bad jsonb;ref text;begin
 assert not (select enabled from public.appointment_email_schedule_settings),'migration defaults dormant';
 assert shop_private.appointment_email_scheduled_request() is null;
 assert not exists(select 1 from reminder_schedule_calls),'dormant callback has no cron/HTTP side effect';
 foreach ref in array array['','foreign-project','fgdzjnsbcxfbiuogbmom'] loop
  begin perform shop_private.reminder_schedule_credentials(ref);raise exception 'INVALID_SCHEDULE_BINDING_ALLOWED';
  exception when invalid_parameter_value or object_not_in_prerequisite_state then null;end;
 end loop;
 select value into secrets from reminder_schedule_secrets;
 foreach bad in array array['[]'::jsonb,secrets||jsonb_build_array(secrets->0),jsonb_build_array(secrets->0,secrets->0,secrets->2),jsonb_build_array(secrets->0,jsonb_build_object('name','shop_reminder_server_key','value','short'),secrets->2)] loop
  begin perform shop_private.reminder_schedule_binding('jvvelvftpfnlogalgxgv',bad);raise exception 'INCOMPLETE_SECRET_BINDING_ALLOWED';
  exception when object_not_in_prerequisite_state then null;end;
 end loop;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 begin perform public.shop_appointment_email_schedule(true,'jvvelvftpfnlogalgxgv');raise exception 'BROWSER_SCHEDULE_ALLOWED';exception when insufficient_privilege then null;end;
 assert not exists(select 1 from reminder_schedule_calls);
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 result:=public.shop_appointment_email_schedule(true,'jvvelvftpfnlogalgxgv');assert result->>'enabled'='true' and result->>'jobId'='321';
 perform public.shop_appointment_email_schedule(true,'jvvelvftpfnlogalgxgv');assert (select count(*) from public.appointment_email_schedule_settings)=1;
 assert not exists(select 1 from reminder_schedule_calls where kind='http'),'enabling config does not dispatch';
 assert shop_private.appointment_email_scheduled_request()=987;
 select payload into result from reminder_schedule_calls where kind='http';
 assert result->>'url'='https://jvvelvftpfnlogalgxgv.supabase.co/functions/v1/shop-appointment-reminder-sender';
 assert result#>>'{headers,Authorization}'='Bearer '||repeat('s',32);
 assert result#>>'{headers,X-Shop-Reminder-Worker-Token}'=repeat('w',32);
 update reminder_schedule_secrets set value='[]';
 begin perform shop_private.appointment_email_scheduled_request();raise exception 'MISSING_SCHEDULE_SECRETS_ALLOWED';exception when object_not_in_prerequisite_state then null;end;
 assert (select count(*) from reminder_schedule_calls where kind='http')=1,'bad binding never reaches HTTP adapter';
 result:=public.shop_appointment_email_schedule(false,'jvvelvftpfnlogalgxgv');assert result->>'enabled'='false','disable works with missing secrets';
 assert shop_private.appointment_email_scheduled_request() is null;
 assert (select count(*) from reminder_schedule_calls where kind='http')=1;
 assert (select count(*) from public.appointment_email_schedule_events)=3,'schedule changes privately audited';
 assert not has_table_privilege('service_role','public.appointment_email_schedule_settings','SELECT,INSERT,UPDATE,DELETE');
 foreach ref in array array['anon','authenticated'] loop
  assert not has_function_privilege(ref,'public.shop_appointment_email_schedule(boolean,text)','EXECUTE');
  assert not has_function_privilege(ref,'public.claim_appointment_email(text[],text)','EXECUTE');
  assert not has_function_privilege(ref,'public.prepare_appointment_email(uuid,uuid,jsonb,text[],text)','EXECUTE');
 end loop;
end$$;
-- Full Supabase CI parses the real extension signatures without executing any
-- job registration or HTTP call. Thin local Postgres intentionally lacks them.
do $$begin
 if to_regnamespace('cron') is not null and to_regnamespace('net') is not null then
  execute $q$prepare reminder_cron_signature as select cron.schedule('shop-appointment-email-reminders','* * * * *','select shop_private.appointment_email_scheduled_request();')$q$;
  execute 'deallocate reminder_cron_signature';
  execute $q$prepare reminder_cron_stop_signature as select cron.unschedule(1::bigint)$q$;
  execute 'deallocate reminder_cron_stop_signature';
  execute $q$prepare reminder_http_signature as select net.http_post(url:='https://jvvelvftpfnlogalgxgv.supabase.co/functions/v1/shop-appointment-reminder-sender',headers:='{}'::jsonb,body:='{}'::jsonb,timeout_milliseconds:=60000)$q$;
  execute 'deallocate reminder_http_signature';
 end if;
end$$;
