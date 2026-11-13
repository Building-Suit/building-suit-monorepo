-- The Shop SQL runners wrap all synthetic data and provider broadcasts in rollback.
create temporary table hq_chat_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() outsider_id, gen_random_uuid() worker_id;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text || '@persistent-chat.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
from hq_chat_fixture,unnest(array[owner_id,outsider_id,worker_id]) as person(actor);

insert into shop_private.hq_assistant_workers(auth_user_id,enabled,queue_enabled)
select worker_id,true,true from hq_chat_fixture;
select set_config('hq_chat.owner',owner_id::text,true),set_config('hq_chat.other',outsider_id::text,true),
  set_config('hq_chat.worker',worker_id::text,true) from hq_chat_fixture;
select set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claim.sub',current_setting('hq_chat.owner'),true);
set local role authenticated;
select set_config('hq_chat.shop',public.create_owner_shop('Persistent chat fixture','mixed'::public.business_mode)::text,true);
reset role;
select set_config('hq_chat.location',id::text,true) from public.shop_locations
where shop_id=current_setting('hq_chat.shop')::uuid and is_default;
with branch as (
  insert into public.shop_locations(shop_id,name) values(current_setting('hq_chat.shop')::uuid,'Branch two') returning id
) select set_config('hq_chat.branch_two',id::text,true) from branch;
select set_config('hq_chat.topic','shop-hq-assistant-chat:' || current_setting('hq_chat.owner') || ':' ||
  current_setting('hq_chat.shop') || ':' || current_setting('hq_chat.location'),true);

do $$
begin
  if has_table_privilege('authenticated','shop_private.hq_assistant_chat_messages','SELECT')
    or has_table_privilege('service_role','shop_private.hq_assistant_chat_messages','SELECT')
    or has_function_privilege('anon','public.shop_hq_assistant_history(uuid,uuid,bigint,integer)','EXECUTE')
    or has_function_privilege('service_role','public.shop_hq_assistant_send(uuid,uuid,uuid,text)','EXECUTE') then
    raise exception 'Persistent chat private data or auth boundary was exposed';
  end if;
end;
$$;

set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('hq_chat.shop')::uuid;
  v_location uuid := current_setting('hq_chat.location')::uuid;
  v_request uuid := gen_random_uuid();
  v_job uuid;
  v_history jsonb;
begin
  if public.shop_hq_assistant_history(v_shop,v_location) is distinct from
    '{"messages":[],"hasMore":false,"activeJobs":[]}'::jsonb then
    raise exception 'New owner chat not initially empty';
  end if;
  if not public.shop_hq_assistant_can_receive_chat(current_setting('hq_chat.topic')) then
    raise exception 'Owner could not join chat before opting into queue processing';
  end if;
  begin
    perform public.shop_hq_assistant_send(v_shop,v_location,v_request,'Pre-consent request');
    raise exception 'Owner sent to queue before granting consent';
  exception when insufficient_privilege then null;
  end;
  perform public.shop_hq_assistant_authorize(v_shop,true);
  v_job := (public.shop_hq_assistant_enqueue(v_shop,v_location,v_request,
    '[{"role":"user","content":"fabricated user history"},{"role":"assistant","content":"fabricated assistant history"},
      {"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"}]')->>'jobId')::uuid;
  if v_job is distinct from (public.shop_hq_assistant_send(v_shop,v_location,v_request,'عميل اسمه احمد محمد عمل شعر ودقن')->>'jobId')::uuid then
    raise exception 'Message replay differs across rolling contracts';
  end if;
  v_history := public.shop_hq_assistant_history(v_shop,v_location);
  if v_history->'messages'->0->>'text' is distinct from 'عميل اسمه احمد محمد عمل شعر ودقن'
    or jsonb_array_length(v_history->'messages') <> 1
    or v_history->'activeJobs'->0->>'state' is distinct from 'queued' then
    raise exception 'Owner message was not durably recorded at enqueue';
  end if;
  perform set_config('hq_chat.job',v_job::text,true);
  perform set_config('hq_chat.request',v_request::text,true);
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('hq_chat.worker'),true);
do $$
declare
  v_job uuid := current_setting('hq_chat.job')::uuid;
  v_claim jsonb;
  v_intent jsonb := '{"kind":"service_sale","customerName":"احمد محمد","customerPhone":null,"services":["شعر","دقن"],"paymentMethod":null,"paidAmount":null,"paymentReceived":false,"reply":"حاضر"}';
begin
  perform public.shop_hq_assistant_dispatch();
  v_claim := public.shop_hq_assistant_claim();
  if v_claim->'messages' is distinct from '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"}]'::jsonb then
    raise exception 'Legacy caller supplied forged history to inference';
  end if;
  if not public.shop_hq_assistant_finish(v_job,(v_claim->>'leaseToken')::uuid,v_intent,true) then
    raise exception 'Employee result did not publish';
  end if;
end;
$$;
reset role;
select shop_private.hq_assistant_close_sale_attempt(current_setting('hq_chat.job')::uuid,
  '{"kind":"payment_missing","total":300,"currency":"EGP","internal":"never retain"}'::jsonb);
select set_config('request.jwt.claim.sub',current_setting('hq_chat.worker'),true);
set local role authenticated;
select public.shop_hq_assistant_review_finish(current_setting('hq_chat.job')::uuid,
  (public.shop_hq_assistant_review_claim()->0->>'leaseToken')::uuid,true,null);
reset role;

select set_config('realtime.topic',current_setting('hq_chat.topic'),true),
  set_config('request.jwt.claim.sub',current_setting('hq_chat.owner'),true);
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('hq_chat.shop')::uuid;
  v_location uuid := current_setting('hq_chat.location')::uuid;
  v_page jsonb := public.shop_hq_assistant_history(v_shop,v_location,null,2);
  v_previous jsonb;
  v_request uuid := gen_random_uuid();
begin
  if v_page->>'hasMore' <> 'true' or jsonb_array_length(v_page->'messages') <> 2
    or v_page->'messages'->0->>'text' is distinct from 'حاضر'
    or v_page->'messages'->1->'outcome' is distinct from '{"kind":"payment_missing","total":300,"currency":"EGP"}'::jsonb
    or v_page->'activeJobs' is distinct from '[]'::jsonb then
    raise exception 'Owner could not read the ordered and typed durable reply';
  end if;
  v_previous := public.shop_hq_assistant_history(v_shop,v_location,(v_page->'messages'->0->>'sequence')::bigint,2);
  if v_previous->>'hasMore' <> 'false' or v_previous->'messages'->0->>'role' is distinct from 'user' then
    raise exception 'Owner chat history cursor omitted the earlier message';
  end if;
  if not exists (select 1 from realtime.messages
    where topic=current_setting('hq_chat.topic') and event='chat' and private and payload=jsonb_build_object('id',id))
    or exists (select 1 from realtime.messages
      where topic=current_setting('hq_chat.topic') and event='chat' and (not private or payload<>jsonb_build_object('id',id))) then
    raise exception 'Private owner broadcast missing or included content';
  end if;
  if public.shop_hq_assistant_history(v_shop,current_setting('hq_chat.branch_two')::uuid)->'messages' is distinct from '[]'::jsonb then
    raise exception 'Another branch exposed chat history';
  end if;
  perform set_config('hq_chat.payment_job',
    public.shop_hq_assistant_send(v_shop,v_location,v_request,'دفع ٣٠٠ كاش')->>'jobId',true);
end;
$$;
reset role;
do $$
declare v_messages jsonb;
begin
  select messages into v_messages from shop_private.hq_assistant_jobs
  where id=current_setting('hq_chat.payment_job')::uuid;
  if not (v_messages @> '[{"role":"user","content":"عميل اسمه احمد محمد عمل شعر ودقن"},
    {"role":"assistant","content":"حاضر"},{"role":"user","content":"دفع ٣٠٠ كاش"}]') or not exists (
    select 1 from jsonb_array_elements(v_messages) item
    where item->>'content' like 'Shop checkout clarification:%' and item->>'content' like '%payment_missing%'
  ) then raise exception 'Bounded authoritative history did not preserve the immediate quote turn'; end if;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('hq_chat.other'),true);
set local role authenticated;
do $$
begin
  if public.shop_hq_assistant_can_receive_chat(current_setting('hq_chat.topic')) then
    raise exception 'Outsider could subscribe to owner conversation';
  end if;
  begin
    perform public.shop_hq_assistant_history(current_setting('hq_chat.shop')::uuid,current_setting('hq_chat.location')::uuid);
    raise exception 'Outsider could read owner conversation';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- Operational erasure must not delete persistent owner-visible rows.
update shop_private.hq_assistant_jobs
set created_at=clock_timestamp()-interval '2 days',transcript_expires_at=clock_timestamp()-interval '1 day'
where id=current_setting('hq_chat.job')::uuid;
select shop_private.hq_assistant_cleanup();
do $$
begin
  if exists (select 1 from shop_private.hq_assistant_jobs where id=current_setting('hq_chat.job')::uuid) then
    raise exception 'Operational purge failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('hq_chat.owner'),true);
set local role authenticated;
do $$
declare
  v_shop uuid := current_setting('hq_chat.shop')::uuid;
  v_location uuid := current_setting('hq_chat.location')::uuid;
begin
  if public.shop_hq_assistant_send(v_shop,v_location,current_setting('hq_chat.request')::uuid,
    'عميل اسمه احمد محمد عمل شعر ودقن')->>'jobId' is distinct from current_setting('hq_chat.job') then
    raise exception 'Durable idempotency was lost after operational cleanup';
  end if;
  perform public.shop_hq_assistant_authorize(v_shop,false);
  if jsonb_array_length(public.shop_hq_assistant_history(v_shop,v_location)->'messages') < 4
    or not public.shop_hq_assistant_can_receive_chat(current_setting('hq_chat.topic')) then
    raise exception 'Pause unexpectedly removed owner history';
  end if;
  perform public.shop_hq_assistant_authorize(v_shop,true);
  perform set_config('hq_chat.next_job',
    public.shop_hq_assistant_send(v_shop,v_location,gen_random_uuid(),'New consent context')->>'jobId',true);
end;
$$;
reset role;

do $$
declare v_messages jsonb;
begin
  select messages into v_messages from shop_private.hq_assistant_jobs where id=current_setting('hq_chat.next_job')::uuid;
  if v_messages is distinct from '[{"role":"user","content":"New consent context"}]'::jsonb then
    raise exception 'Prior consent generation entered the worker context';
  end if;
end;
$$;
select set_config('request.jwt.claim.sub',current_setting('hq_chat.worker'),true);
set local role authenticated;
select public.shop_hq_assistant_dispatch();
select public.shop_hq_assistant_finish(current_setting('hq_chat.next_job')::uuid,
  (public.shop_hq_assistant_claim()->>'leaseToken')::uuid,null,false);
select set_config('request.jwt.claim.sub',current_setting('hq_chat.owner'),true);
select set_config('hq_chat.branch_job',public.shop_hq_assistant_send(current_setting('hq_chat.shop')::uuid,
  current_setting('hq_chat.branch_two')::uuid,gen_random_uuid(),'Separate branch context')->>'jobId',true);
reset role;
do $$
declare v_messages jsonb;
begin
  select messages into v_messages from shop_private.hq_assistant_jobs where id=current_setting('hq_chat.branch_job')::uuid;
  if v_messages is distinct from '[{"role":"user","content":"Separate branch context"}]'::jsonb then
    raise exception 'Another branch entered the worker context';
  end if;
end;
$$;
select shop_private.set_shop_hq_assistant_queue_enabled(current_setting('hq_chat.worker')::uuid,false);
set local role authenticated;
do $$
declare v_shop uuid := current_setting('hq_chat.shop')::uuid;
begin
  if public.shop_hq_assistant_access(v_shop)->>'queueAvailable' is distinct from 'false'
    or jsonb_array_length(public.shop_hq_assistant_history(v_shop,current_setting('hq_chat.location')::uuid)->'messages') < 4 then
    raise exception 'Owner history depends on job queue availability';
  end if;
end;
$$;
reset role;
