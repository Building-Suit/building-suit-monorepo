-- Synthetic accounts and jobs only. The Shop SQL runners roll back this file.
create temporary table hq_assistant_accounts as
select gen_random_uuid() as owner_id, gen_random_uuid() as outsider_id,
  gen_random_uuid() as worker_id, gen_random_uuid() as other_worker_id, gen_random_uuid() as reader_id;

insert into auth.users (
  id, email, encrypted_password, aud, role, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select actor, actor::text || '@hq-assistant.invalid', 'x', 'authenticated', 'authenticated',
  now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from hq_assistant_accounts, unnest(array[owner_id, outsider_id, worker_id, other_worker_id, reader_id]) as account(actor);

-- The SQL fixture invokes no provider scheduler. Hosted/local operators
-- bootstrap technical accounts through the private registration routine.
insert into shop_private.hq_assistant_workers (auth_user_id, enabled)
select actor, true from hq_assistant_accounts, unnest(array[worker_id, other_worker_id]) as account(actor);

select set_config('hq_test.owner', owner_id::text, true),
  set_config('hq_test.outsider', outsider_id::text, true),
  set_config('hq_test.worker', worker_id::text, true),
  set_config('hq_test.other_worker', other_worker_id::text, true),
  set_config('hq_test.reader', reader_id::text, true)
from hq_assistant_accounts;

select set_config('request.jwt.claim.sub', current_setting('hq_test.owner'), true),
  set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select set_config('hq_test.shop', public.create_owner_shop('HQ assistant fixture', 'mixed'::public.business_mode)::text, true);
reset role;
select shop_private.register_shop_hq_assistant_staff_reader(current_setting('hq_test.reader')::uuid,true);
select set_config('hq_test.location', id::text, true)
  from public.shop_locations where shop_id = current_setting('hq_test.shop')::uuid and is_default;
with branch as (
  insert into public.shop_locations(shop_id, name) values (current_setting('hq_test.shop')::uuid, 'Second branch')
  returning id
)
select set_config('hq_test.second_location', id::text, true) from branch;

do $$
declare
  v_rpc regprocedure;
begin
  foreach v_rpc in array array[
    'public.shop_hq_assistant_access(uuid)'::regprocedure,
    'public.shop_hq_assistant_authorize(uuid,boolean)'::regprocedure,
    'public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb)'::regprocedure,
    'public.shop_hq_assistant_job(uuid,uuid,uuid)'::regprocedure,
    'public.shop_hq_assistant_claim()'::regprocedure,
    'public.shop_hq_assistant_dispatch()'::regprocedure,
    'public.shop_hq_assistant_recent(uuid,uuid)'::regprocedure,
    'public.shop_hq_assistant_staff(uuid,integer)'::regprocedure,
    'public.shop_hq_assistant_review_claim()'::regprocedure,
    'public.shop_hq_assistant_review_finish(uuid,uuid,boolean,text)'::regprocedure,
    'public.shop_hq_assistant_sale_claim()'::regprocedure,
    'public.shop_hq_assistant_finish(uuid,uuid,jsonb,boolean)'::regprocedure
  ] loop
    if not has_function_privilege('authenticated', v_rpc, 'EXECUTE')
      or has_function_privilege('anon', v_rpc, 'EXECUTE')
      or has_function_privilege('service_role', v_rpc, 'EXECUTE')
      or not exists (select 1 from pg_catalog.pg_proc where oid = v_rpc
        and prosecdef and proconfig = array['search_path=""']) then
      raise exception 'Invalid HQ assistant RPC privileges';
    end if;
  end loop;
  if has_function_privilege('authenticated', 'shop_private.register_shop_hq_assistant_worker(uuid,boolean)', 'EXECUTE')
    or has_table_privilege('authenticated', 'shop_private.hq_assistant_jobs', 'SELECT')
    or has_table_privilege('service_role', 'shop_private.hq_assistant_jobs', 'SELECT') then
    raise exception 'Private HQ assistant queue or registration exposed';
  end if;
  begin
    perform shop_private.register_shop_hq_assistant_worker(current_setting('hq_test.owner')::uuid, true);
    raise exception 'Owner could be registered as a worker';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

select set_config('realtime.topic', 'shop-hq-assistant-jobs', true);
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('hq_test.shop')::uuid;
  v_location uuid := current_setting('hq_test.location')::uuid;
  v_request uuid := gen_random_uuid();
  v_messages jsonb := '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"}]';
  v_access jsonb;
  v_job jsonb;
begin
  v_access := public.shop_hq_assistant_access(v_shop);
  if v_access is distinct from '{"enabled":false,"agentName":"Shop Suit Agent"}'::jsonb then
    raise exception 'HQ assistant not initially disabled';
  end if;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, v_messages);
    raise exception 'Unapproved owner queued a request';
  exception when insufficient_privilege then null;
  end;
  if public.shop_hq_assistant_authorize(v_shop, true) is distinct from
    '{"enabled":true,"agentName":"Shop Suit Agent"}'::jsonb then
    raise exception 'Owner could not enable assistant';
  end if;

  begin
    perform public.shop_hq_assistant_enqueue(v_shop, gen_random_uuid(), v_request, v_messages);
    raise exception 'Invalid location could queue a request';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, '{"role":"user","content":"object"}');
    raise exception 'Object accepted as messages';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, '[null,{"role":"user","content":"text"}]');
    raise exception 'Invalid message element accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, '[{"role":"system","content":"text"}]');
    raise exception 'System message accepted';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request,
      jsonb_build_array(jsonb_build_object('role', 'user', 'content', repeat('ش', 1001))));
    raise exception 'UTF-8 message byte cap was bypassed';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request,
      jsonb_build_array(jsonb_build_object('role', 'user', 'content', E'\t\n')));
    raise exception 'Whitespace-only messages were accepted';
  exception when invalid_parameter_value then null;
  end;

  v_job := public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, v_messages);
  if v_job is distinct from public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, v_messages)
    or public.shop_hq_assistant_job(v_shop, v_location, (v_job->>'jobId')::uuid)
      is distinct from '{"state":"queued","updates":[],"reviewPending":false}'::jsonb then
    raise exception 'Enqueue replay or queued receipt incorrect';
  end if;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, v_request, '[{"role":"user","content":"different"}]');
    raise exception 'Changed input reused a request ID';
  exception when unique_violation then null;
  end;
  begin
    perform public.shop_hq_assistant_job(v_shop, current_setting('hq_test.second_location')::uuid, (v_job->>'jobId')::uuid);
    raise exception 'Owner could read the job through another branch';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, current_setting('hq_test.second_location')::uuid, v_request, v_messages);
    raise exception 'A second branch reused the request ID';
  exception when unique_violation then null;
  end;
  begin
    perform public.shop_hq_assistant_enqueue(v_shop, v_location, gen_random_uuid(), v_messages);
    raise exception 'Actor exceeded the active request cap';
  exception when program_limit_exceeded then null;
  end;
  begin
    perform public.shop_hq_assistant_claim();
    raise exception 'Shop owner claimed worker job';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from realtime.messages where topic = 'shop-hq-assistant-jobs') then
    raise exception 'Shop owner can receive worker signals';
  end if;
  perform set_config('hq_test.job', v_job->>'jobId', true);
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('hq_test.outsider'), true);
do $$
begin
  begin
    perform public.shop_hq_assistant_authorize(current_setting('hq_test.shop')::uuid, true);
    raise exception 'Outsider could authorize a shop';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.shop_hq_assistant_job(current_setting('hq_test.shop')::uuid,
      current_setting('hq_test.location')::uuid, current_setting('hq_test.job')::uuid);
    raise exception 'Outsider read an owner job';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('hq_test.worker'), true);
do $$
declare
  v_claim jsonb;
  v_dispatch jsonb;
  v_job uuid := current_setting('hq_test.job')::uuid;
begin
  if not public.shop_hq_assistant_can_receive() or not exists (
    select 1 from realtime.messages
    where topic = 'shop-hq-assistant-jobs' and event = 'jobs' and private
      and payload = jsonb_build_object('id', id) and id <> v_job
  ) then
    raise exception 'Worker could not see generic private wakeup';
  end if;
  begin
    perform public.shop_hq_assistant_authorize(current_setting('hq_test.shop')::uuid, true);
    raise exception 'Technical worker enabled owner consent';
  exception when insufficient_privilege then null;
  end;
  if public.shop_hq_assistant_claim() is not null then
    raise exception 'Employee claimed before Head dispatch';
  end if;
  v_dispatch := public.shop_hq_assistant_dispatch();
  if v_dispatch->>'headAgentId' is distinct from 'AG-SHOP-001' or (v_dispatch->>'jobId')::uuid is distinct from v_job then
    raise exception 'Head did not dispatch to the per-Shop employee';
  end if;
  perform set_config('hq_test.employee', v_dispatch->>'employeeId', true);
  v_claim := public.shop_hq_assistant_claim();
  if (v_claim->>'jobId')::uuid is distinct from v_job or v_claim->>'employeeId' is distinct from v_dispatch->>'employeeId'
    or v_claim->'messages' is distinct from '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"}]'::jsonb
    or public.shop_hq_assistant_claim() is not null then
    raise exception 'Worker claim or claim exclusivity incorrect';
  end if;
  perform set_config('hq_test.lease', v_claim->>'leaseToken', true);
end;
$$;
reset role;
do $$
begin
  if exists (select 1 from shop_private.hq_assistant_jobs
    where id = current_setting('hq_test.job')::uuid and (messages is not null or context_messages is null or state <> 'working')) then
    raise exception 'Queue copy not discarded or bounded review context unavailable';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('hq_test.other_worker'), true);
do $$
begin
  if public.shop_hq_assistant_finish(current_setting('hq_test.job')::uuid,
    current_setting('hq_test.lease')::uuid, null, false) then
    raise exception 'Other worker could finish the claim';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('hq_test.worker'), true);
do $$
declare
  v_job uuid := current_setting('hq_test.job')::uuid;
  v_lease uuid := current_setting('hq_test.lease')::uuid;
  v_intent jsonb := '{"kind":"reply","customerName":null,"customerPhone":null,"services":[],"paymentMethod":null,"paidAmount":null,"paymentReceived":false,"reply":"حاضر"}';
begin
  begin
    perform public.shop_hq_assistant_finish(v_job, v_lease, '{"services":[]}', true);
    raise exception 'Malformed worker result was accepted';
  exception when invalid_parameter_value then null;
  end;
  if public.shop_hq_assistant_finish(v_job, gen_random_uuid(), v_intent, true)
    or not public.shop_hq_assistant_finish(v_job, v_lease, v_intent, true)
    or not public.shop_hq_assistant_finish(v_job, v_lease, v_intent, true)
    or public.shop_hq_assistant_finish(v_job, v_lease, v_intent || '{"reply":"different"}', true) then
    raise exception 'Worker completion replay or fencing incorrect';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('hq_test.reader'), true);
do $$
declare v_staff jsonb;
begin
  v_staff := public.shop_hq_assistant_staff();
  if not exists (
    select 1 from jsonb_array_elements(v_staff) item
    where item->>'employeeId' = current_setting('hq_test.employee') and item->>'state' = 'busy'
  ) then raise exception 'Head staffing status did not show a busy per-Shop employee'; end if;
  begin
    perform public.shop_hq_assistant_dispatch();
    raise exception 'Staff reader could dispatch a job';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('hq_test.owner'), true);
select set_config('realtime.topic', 'shop-hq-assistant-owner:' || current_setting('hq_test.job'), true);
do $$
declare
  v_shop uuid := current_setting('hq_test.shop')::uuid;
  v_location uuid := current_setting('hq_test.location')::uuid;
  v_job uuid := current_setting('hq_test.job')::uuid;
  v_reply jsonb;
begin
  v_reply := public.shop_hq_assistant_job(v_shop, v_location, v_job);
  if v_reply is distinct from '{"state":"completed","updates":[{"sequence":1,"kind":"reply","text":"حاضر"}],"reviewPending":true}'::jsonb
    or public.shop_hq_assistant_recent(v_shop,v_location)->0->>'ownerMessage' is distinct from 'عميل اسمه احمد محمد عمل شعر ودقن'
    or not public.shop_hq_assistant_can_receive_owner(current_setting('realtime.topic'))
    or not exists (
      select 1 from realtime.messages where topic = current_setting('realtime.topic') and event = 'reply'
        and private and payload = jsonb_build_object('id',id) and id <> v_job
    ) then
    raise exception 'Employee reply was not published privately before Head review';
  end if;
  perform set_config('hq_test.waiting_job',
    public.shop_hq_assistant_enqueue(v_shop,v_location,gen_random_uuid(),
      '[{"role":"user","content":"Wait while my employee is busy"}]')->>'jobId', true);
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('hq_test.outsider'), true);
do $$
begin
  if public.shop_hq_assistant_can_receive_owner(current_setting('realtime.topic'))
    or exists (select 1 from realtime.messages where topic = current_setting('realtime.topic')) then
    raise exception 'Outsider could join the owner reply topic';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('hq_test.worker'), true);
do $$
declare
  v_job uuid := current_setting('hq_test.job')::uuid;
  v_review jsonb;
  v_fix jsonb;
  v_intent jsonb := '{"kind":"reply","customerName":null,"customerPhone":null,"services":[],"paymentMethod":null,"paidAmount":null,"paymentReceived":false,"reply":"تم التوضيح"}';
begin
  if public.shop_hq_assistant_dispatch() is not null or public.shop_hq_assistant_claim() is not null then
    raise exception 'Busy employee was assigned a second job';
  end if;
  v_review := public.shop_hq_assistant_review_claim();
  if jsonb_array_length(v_review) <> 1 or v_review->0->>'headAgentId' is distinct from 'AG-SHOP-001'
    or not public.shop_hq_assistant_review_finish(v_job,(v_review->0->>'leaseToken')::uuid,false,'Clarify the next step')
    or not public.shop_hq_assistant_review_finish(v_job,(v_review->0->>'leaseToken')::uuid,false,'Clarify the next step') then
    raise exception 'Head could not route idempotent correction';
  end if;
  v_fix := public.shop_hq_assistant_claim();
  if v_fix->>'employeeId' is distinct from current_setting('hq_test.employee')
    or v_fix->>'feedback' is distinct from 'Clarify the next step'
    or not public.shop_hq_assistant_finish(v_job,(v_fix->>'leaseToken')::uuid,v_intent,true) then
    raise exception 'Corrective job was not routed to its original employee';
  end if;
  v_review := public.shop_hq_assistant_review_claim();
  if not public.shop_hq_assistant_review_finish(v_job,(v_review->0->>'leaseToken')::uuid,true,null) then
    raise exception 'Head could not accept corrected reply';
  end if;
  if public.shop_hq_assistant_dispatch()->>'jobId' is distinct from current_setting('hq_test.waiting_job') then
    raise exception 'Head could not dispatch to the newly available employee';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub', current_setting('hq_test.owner'), true);
do $$
declare
  v_shop uuid := current_setting('hq_test.shop')::uuid;
  v_location uuid := current_setting('hq_test.location')::uuid;
  v_job uuid := current_setting('hq_test.job')::uuid;
  v_queued uuid;
begin
  if public.shop_hq_assistant_job(v_shop, v_location, v_job) is distinct from
    '{"state":"completed","updates":[{"sequence":1,"kind":"reply","text":"حاضر"},{"sequence":2,"kind":"reply","text":"تم التوضيح"}],"reviewPending":false}'::jsonb then
    raise exception 'Owner did not receive both ordered replies';
  end if;
  v_queued := current_setting('hq_test.waiting_job')::uuid;
  perform public.shop_hq_assistant_authorize(v_shop, false);
  perform public.shop_hq_assistant_authorize(v_shop, true);
  if public.shop_hq_assistant_job(v_shop, v_location, v_job) is distinct from '{"state":"revoked","updates":[],"reviewPending":false}'::jsonb
    or public.shop_hq_assistant_job(v_shop, v_location, v_queued) is distinct from '{"state":"revoked","updates":[],"reviewPending":false}'::jsonb then
    raise exception 'Reauthorizing restored revoked data';
  end if;
  perform set_config('hq_test.expired', public.shop_hq_assistant_enqueue(v_shop, v_location, gen_random_uuid(),
    '[{"role":"user","content":"expire"}]')->>'jobId', true);
end;
$$;
reset role;
update shop_private.hq_assistant_jobs set expires_at = clock_timestamp() - interval '1 second'
where id = current_setting('hq_test.expired')::uuid;
select shop_private.hq_assistant_cleanup();
do $$
begin
  if not exists (select 1 from shop_private.hq_assistant_jobs
    where id = current_setting('hq_test.expired')::uuid and state = 'expired' and messages is null)
    or exists (select 1 from shop_private.hq_assistant_jobs
      where actor_id = current_setting('hq_test.owner')::uuid and (messages is not null or intent is not null)) then
    raise exception 'Expired or revoked payload remained in the queue';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('hq_test.worker'), true);
do $$
begin
  if public.shop_hq_assistant_claim() is not null
    or public.shop_hq_assistant_finish(current_setting('hq_test.job')::uuid,
      current_setting('hq_test.lease')::uuid, null, false) then
    raise exception 'Worker could claim or finish expired or revoked jobs';
  end if;
end;
$$;
reset role;

-- Let a claimed lease lapse. It cannot be completed or reclaimed.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('hq_test.owner'), true);
select set_config('hq_test.lapsed_job', public.shop_hq_assistant_enqueue(current_setting('hq_test.shop')::uuid,
  current_setting('hq_test.location')::uuid, gen_random_uuid(), '[{"role":"user","content":"lease lapse"}]')->>'jobId', true);
select set_config('request.jwt.claim.sub', current_setting('hq_test.worker'), true);
select public.shop_hq_assistant_dispatch();
select set_config('hq_test.lapsed_lease', public.shop_hq_assistant_claim()->>'leaseToken', true);
reset role;
update shop_private.hq_assistant_jobs set lease_expires_at = clock_timestamp() - interval '1 second'
where id = current_setting('hq_test.lapsed_job')::uuid;
set local role authenticated;
do $$
begin
  if public.shop_hq_assistant_finish(current_setting('hq_test.lapsed_job')::uuid,
    current_setting('hq_test.lapsed_lease')::uuid, null, false)
    or public.shop_hq_assistant_claim() is not null then
    raise exception 'Lapsed lease could complete or be reclaimed';
  end if;
end;
$$;
reset role;

-- Test the DB admission switch and one-day deletion without waiting on Cron.
select shop_private.register_shop_hq_assistant_worker(current_setting('hq_test.worker')::uuid, false);
select shop_private.register_shop_hq_assistant_worker(current_setting('hq_test.other_worker')::uuid, false);
set local role authenticated;
do $$
begin
  if public.shop_hq_assistant_can_receive() then
    raise exception 'Disabled worker kept Realtime authority';
  end if;
  perform set_config('request.jwt.claim.sub', current_setting('hq_test.owner'), true);
  begin
    perform public.shop_hq_assistant_enqueue(current_setting('hq_test.shop')::uuid,
      current_setting('hq_test.location')::uuid, gen_random_uuid(), '[{"role":"user","content":"disabled"}]');
    raise exception 'Owner enqueued without an active worker';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;
reset role;
update shop_private.hq_assistant_jobs set created_at = clock_timestamp() - interval '2 days'
where actor_id = current_setting('hq_test.owner')::uuid;
select shop_private.hq_assistant_cleanup();
do $$
begin
  if exists (select 1 from shop_private.hq_assistant_jobs where actor_id = current_setting('hq_test.owner')::uuid) then
    raise exception 'Queue receipt survived retention';
  end if;
end;
$$;
