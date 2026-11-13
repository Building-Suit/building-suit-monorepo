-- The Shop SQL runner rolls back the synthetic conversations and leases.
create temporary table hq_recall_fixture as
select gen_random_uuid() owner_id, gen_random_uuid() outsider_id,
  gen_random_uuid() worker_id, gen_random_uuid() other_worker_id;

insert into auth.users (id,email,encrypted_password,aud,role,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select actor,actor::text || '@conversation-recall.invalid','x','authenticated','authenticated',now(),'{}','{}',now(),now()
from hq_recall_fixture,unnest(array[owner_id,outsider_id,worker_id,other_worker_id]) as person(actor);

insert into shop_private.hq_assistant_workers(auth_user_id,enabled,queue_enabled)
select worker,true,true from hq_recall_fixture,unnest(array[worker_id,other_worker_id]) as person(worker);
select set_config('hq_recall.owner',owner_id::text,true),set_config('hq_recall.outsider',outsider_id::text,true),
  set_config('hq_recall.worker',worker_id::text,true),set_config('hq_recall.other_worker',other_worker_id::text,true)
from hq_recall_fixture;

select set_config('request.jwt.claim.role','authenticated',true),
  set_config('request.jwt.claim.sub',current_setting('hq_recall.owner'),true);
set local role authenticated;
select set_config('hq_recall.shop',public.create_owner_shop('Conversation recall fixture','mixed'::public.business_mode)::text,true);
select public.shop_hq_assistant_authorize(current_setting('hq_recall.shop')::uuid,true);
reset role;

with shop as (
  insert into public.shops(portal_id,name)
  select portal_id,'Other recall shop' from public.shops where id=current_setting('hq_recall.shop')::uuid
  returning id
) select set_config('hq_recall.other_shop',id::text,true) from shop;
insert into shop_private.hq_assistant_assignments (actor_id,shop_id,enabled,consent_version)
values (current_setting('hq_recall.owner')::uuid,current_setting('hq_recall.other_shop')::uuid,
  true,shop_private.hq_assistant_consent_version()),
  (current_setting('hq_recall.outsider')::uuid,current_setting('hq_recall.shop')::uuid,
  true,shop_private.hq_assistant_consent_version());

select set_config('hq_recall.location',id::text,true) from public.shop_locations
where shop_id=current_setting('hq_recall.shop')::uuid and is_default;
select set_config('hq_recall.other_shop_location',id::text,true) from public.shop_locations
where shop_id=current_setting('hq_recall.other_shop')::uuid and is_default;
with branch as (
  insert into public.shop_locations(shop_id,name) values(current_setting('hq_recall.shop')::uuid,'Other recall branch') returning id
) select set_config('hq_recall.other_branch',id::text,true) from branch;

do $$
declare
  v_owner uuid := current_setting('hq_recall.owner')::uuid;
  v_shop uuid := current_setting('hq_recall.shop')::uuid;
  v_location uuid := current_setting('hq_recall.location')::uuid;
  v_generation bigint;
begin
  if has_function_privilege('anon','public.shop_hq_assistant_recall(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.shop_hq_assistant_recall(uuid,uuid)','EXECUTE') then
    raise exception 'Recall exposed to a role outside the queue';
  end if;

  select generation into strict v_generation from shop_private.hq_assistant_assignments
  where actor_id=v_owner and shop_id=v_shop;
  insert into shop_private.hq_assistant_chat_messages
    (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text)
  values
    (v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','I prefer weekly inventory reports.'),
    (v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','The inventory for shampoo is organized by supplier.'),
    (v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','بفضل الردود بالعربي.'),
    (v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,1,'assistant','message','I prefer inventory fabricated by assistant.'),
    (v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','I prefer a different inventory method, paid 99 cash'),
    (v_owner,v_shop,current_setting('hq_recall.other_branch')::uuid,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','I prefer inventory from the other branch.'),
    (v_owner,current_setting('hq_recall.other_shop')::uuid,current_setting('hq_recall.other_shop_location')::uuid,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','I prefer inventory from the other shop.'),
    (current_setting('hq_recall.outsider')::uuid,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','I prefer inventory from another owner.');

  insert into shop_private.hq_assistant_chat_messages
    (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text)
  select v_owner,v_shop,v_location,gen_random_uuid(),gen_random_uuid(),v_generation,0,'user','message','Recent message ' || turn
  from generate_series(1,11) as recent(turn);
end;
$$;

set local role authenticated;
select set_config('hq_recall.job',public.shop_hq_assistant_send(current_setting('hq_recall.shop')::uuid,
  current_setting('hq_recall.location')::uuid,gen_random_uuid(),'Show shampoo inventory')->>'jobId',true);
select set_config('request.jwt.claim.sub',current_setting('hq_recall.worker'),true);
select public.shop_hq_assistant_dispatch();
do $$
declare
  v_claim jsonb := public.shop_hq_assistant_claim();
  v_job uuid := current_setting('hq_recall.job')::uuid;
  v_lease uuid := (v_claim->>'leaseToken')::uuid;
  v_recall jsonb;
  v_intent jsonb := '{"kind":"reply","customerName":null,"customerPhone":null,"services":[],"paymentMethod":null,"paidAmount":null,"paymentReceived":false,"reply":"Inventory overview."}';
begin
  if v_claim->>'jobId' is distinct from v_job::text or (v_claim->'messages')::text like '%supplier%' then
    raise exception 'Fixture did not put the recalled statements outside the recent window';
  end if;
  v_recall := public.shop_hq_assistant_recall(v_job,v_lease);
  if v_recall is distinct from '{"preferences":["بفضل الردود بالعربي.","I prefer weekly inventory reports."],"relevant":["The inventory for shampoo is organized by supplier."]}'::jsonb then
    raise exception 'Recall failed to preserve the scoped, owner-authored context';
  end if;

  begin
    perform public.shop_hq_assistant_recall(v_job,gen_random_uuid());
    raise exception 'Invalid lease could read recall';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',current_setting('hq_recall.other_worker'),true);
  begin
    perform public.shop_hq_assistant_recall(v_job,v_lease);
    raise exception 'Another enabled worker could read recall';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',current_setting('hq_recall.owner'),true);
  begin
    perform public.shop_hq_assistant_recall(v_job,v_lease);
    raise exception 'Non-worker could invoke recall';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub',current_setting('hq_recall.worker'),true);
  if not public.shop_hq_assistant_finish(v_job,v_lease,v_intent,true) then
    raise exception 'Worker could not complete the fixture';
  end if;
  v_lease := (public.shop_hq_assistant_review_claim()->0->>'leaseToken')::uuid;
  if public.shop_hq_assistant_recall(v_job,v_lease) is distinct from v_recall then
    raise exception 'Reviewer could not recall the same context';
  end if;
  perform set_config('hq_recall.lease',v_lease::text,true);
end;
$$;

select set_config('request.jwt.claim.sub',current_setting('hq_recall.owner'),true);
select public.shop_hq_assistant_authorize(current_setting('hq_recall.shop')::uuid,false);
select public.shop_hq_assistant_authorize(current_setting('hq_recall.shop')::uuid,true);
select set_config('hq_recall.next_job',public.shop_hq_assistant_send(current_setting('hq_recall.shop')::uuid,
  current_setting('hq_recall.location')::uuid,gen_random_uuid(),'Show shampoo inventory again')->>'jobId',true);
select set_config('request.jwt.claim.sub',current_setting('hq_recall.worker'),true);
do $$
declare v_lease uuid;
begin
  begin
    perform public.shop_hq_assistant_recall(current_setting('hq_recall.job')::uuid,current_setting('hq_recall.lease')::uuid);
    raise exception 'A revoked review lease could read recall';
  exception when insufficient_privilege then null;
  end;

  perform public.shop_hq_assistant_dispatch();
  v_lease := (public.shop_hq_assistant_claim()->>'leaseToken')::uuid;
  if public.shop_hq_assistant_recall(current_setting('hq_recall.next_job')::uuid,v_lease)
    is distinct from '{"preferences":[],"relevant":[]}'::jsonb then
    raise exception 'Recall crossed consent generations';
  end if;
end;
$$;
reset role;
