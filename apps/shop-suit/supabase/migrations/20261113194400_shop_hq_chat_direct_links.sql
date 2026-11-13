begin;

alter table shop_private.hq_assistant_chat_messages drop constraint hq_assistant_chat_messages_kind_check,
  add constraint hq_assistant_chat_messages_kind_check
    check (kind in ('message','receipt','clarification','status','action'));

create function shop_private.hq_assistant_page(p_destination text) returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(p_destination in ('sales','reports','products','inventory','expenses','appointments','customers'),false);
$$;

revoke all on function shop_private.hq_assistant_page(text) from public,anon,authenticated,service_role;

-- Existing workers can finish without links. New workers supply up to three
-- allowlisted destinations; the client maps them to internal routes.
create or replace function shop_private.hq_assistant_valid_intent(p_intent jsonb) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_keys constant text[] := array['kind','customerName','customerPhone','services','paymentMethod','paidAmount','paymentReceived','reply'];
  v_amount numeric;
begin
  if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text) > 8192 then
    return false;
  end if;
  if not (p_intent ?& v_keys) or (p_intent - v_keys - 'links') <> '{}'::jsonb
    or jsonb_typeof(p_intent->'reply') is distinct from 'string'
    or (p_intent->>'reply') !~ '[^[:space:]]' or length(p_intent->>'reply') > 1000
    or jsonb_typeof(p_intent->'services') is distinct from 'array'
    or jsonb_typeof(p_intent->'paymentReceived') is distinct from 'boolean' then
    return false;
  end if;
  if p_intent ? 'links' then
    if jsonb_typeof(p_intent->'links') <> 'array' then return false; end if;
    if jsonb_array_length(p_intent->'links') > 3 or exists (
      select 1 from jsonb_array_elements(p_intent->'links') link(value)
      where jsonb_typeof(link.value) <> 'string' or not shop_private.hq_assistant_page(link.value #>> '{}')
    ) or (select count(distinct link.value) from jsonb_array_elements(p_intent->'links') link(value))
      <> jsonb_array_length(p_intent->'links') then return false; end if;
  end if;
  if p_intent->>'kind' = 'reply' then
    return p_intent->'customerName' = 'null'::jsonb and p_intent->'customerPhone' = 'null'::jsonb
      and p_intent->'services' = '[]'::jsonb and p_intent->'paymentMethod' = 'null'::jsonb
      and p_intent->'paidAmount' = 'null'::jsonb and p_intent->'paymentReceived' = 'false'::jsonb;
  end if;
  if jsonb_typeof(p_intent->'paidAmount') = 'number' then
    v_amount := (p_intent->>'paidAmount')::numeric;
    if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) then return false; end if;
  elsif p_intent->'paidAmount' <> 'null'::jsonb then
    return false;
  end if;
  return coalesce(p_intent->>'kind' = 'service_sale', false)
    and jsonb_typeof(p_intent->'customerName') = 'string'
    and length(btrim(p_intent->>'customerName')) between 2 and 160 and length(p_intent->>'customerName') <= 160
    and (p_intent->'customerPhone' = 'null'::jsonb or
      (jsonb_typeof(p_intent->'customerPhone') = 'string' and length(btrim(p_intent->>'customerPhone')) between 7 and 32))
    and (p_intent->'paymentMethod' = 'null'::jsonb or coalesce(p_intent->>'paymentMethod', '') in ('cash','card','transfer'))
    and jsonb_array_length(p_intent->'services') between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(p_intent->'services') as item(value)
      where jsonb_typeof(item.value) <> 'string' or length(btrim(item.value #>> '{}')) not between 2 and 120
        or length(item.value #>> '{}') > 120
    );
end;
$$;

create or replace function public.shop_hq_assistant_finish(p_job_id uuid,p_lease_token uuid,p_intent jsonb,p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_digest bytea; v_sale_pending boolean; v_destination text;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  if p_succeeded is null or (p_succeeded and not shop_private.hq_assistant_valid_intent(p_intent))
    or (not p_succeeded and p_intent is not null and p_intent <> 'null'::jsonb) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_RESULT' using errcode = '22023';
  end if;
  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then return false; end if;
  v_digest := extensions.digest(convert_to(jsonb_build_array(p_lease_token,p_succeeded,p_intent)::text,'UTF8'),'sha256');
  if v_job.employee_finish_token = p_lease_token and v_job.employee_finish_worker = v_worker then
    return v_job.employee_finish_digest = v_digest;
  end if;
  if v_job.stage <> 'employee' or v_job.worker_id is distinct from v_worker
    or v_job.lease_token is distinct from p_lease_token or p_lease_token is null
    or v_job.lease_expires_at <= clock_timestamp() then return false; end if;
  v_sale_pending := p_succeeded and p_intent->>'kind' = 'service_sale'
    and not (v_job.updates @> '[{"kind":"receipt"}]'::jsonb);
  if p_succeeded then
    perform shop_private.hq_assistant_append_update(p_job_id,jsonb_build_object('kind','reply','text',p_intent->>'reply'));
    for v_destination in select jsonb_array_elements_text(coalesce(p_intent->'links','[]'::jsonb))
    loop
      perform shop_private.hq_assistant_append_update(p_job_id,
        jsonb_build_object('kind','action','destination',v_destination));
    end loop;
  end if;
  update shop_private.hq_assistant_jobs
  set state = case when p_succeeded or v_job.state = 'completed' then 'completed' else 'failed' end,
    stage = case when v_sale_pending then 'sale_pending' when p_succeeded then 'review_pending' else 'closed' end,
    intent = case when p_succeeded then p_intent else intent end,
    intent_expires_at = case when p_succeeded then transcript_expires_at else intent_expires_at end,
    context_messages = case when p_succeeded then context_messages end,
    feedback = null,
    worker_id = case when v_sale_pending then v_worker end,
    lease_token = case when v_sale_pending then p_lease_token end,
    lease_expires_at = case when v_sale_pending then least(expires_at, clock_timestamp() + interval '60 seconds') end,
    employee_finish_worker = v_worker, employee_finish_token = p_lease_token, employee_finish_digest = v_digest
  where id = p_job_id;
  perform shop_private.hq_assistant_signal_owner(p_job_id);
  perform shop_private.hq_assistant_signal_staff();
  return true;
end;
$$;

create or replace function shop_private.hq_assistant_mirror_chat() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_changed boolean := false;
  v_update jsonb;
  v_kind text;
  v_text text;
  v_detail jsonb;
begin
  -- Only requests newly admitted with persistent-history consent enter this
  -- table. Operationally retained v2 messages cannot silently be archived.
  if old.owner_message is null and new.owner_message is not null and exists (
    select 1 from shop_private.hq_assistant_assignments assignment
    where assignment.actor_id = new.actor_id and assignment.shop_id = new.shop_id and assignment.enabled
      and assignment.consent_version = 3 and assignment.generation = new.consent_generation
  ) then
    insert into shop_private.hq_assistant_chat_messages
      (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text,created_at)
    values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,0,
      'user','message',new.owner_message,new.created_at)
    on conflict (job_id,source_sequence) do nothing;
    v_changed := found;
  end if;
  if not exists (
    select 1 from shop_private.hq_assistant_chat_messages message where message.job_id = new.id and message.source_sequence = 0
  ) then return null; end if;

  if new.transcript_expires_at is not null and new.updates is distinct from old.updates then
    for v_update in select item.value from jsonb_array_elements(new.updates) with ordinality item(value,position)
      where item.position > jsonb_array_length(old.updates) order by item.position
    loop
      v_kind := v_update->>'kind';
      v_text := null;
      v_detail := null;
      case v_kind
        when 'reply' then
          v_kind := 'message';
          v_text := v_update->>'text';
        when 'receipt' then
          v_detail := jsonb_build_object('destination','receipt','saleId',(v_update->>'invoiceId')::uuid);
        when 'action' then
          if shop_private.hq_assistant_page(v_update->>'destination') then
            v_detail := jsonb_build_object('destination',v_update->>'destination');
          end if;
        when 'clarification' then
          v_detail := shop_private.hq_assistant_chat_clarification(v_update->'outcome');
        else continue;
      end case;
      if v_text is null and v_detail is null then continue; end if;
      insert into shop_private.hq_assistant_chat_messages
        (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,text,detail)
      values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,
        (v_update->>'sequence')::int,'assistant',v_kind,v_text,v_detail)
      on conflict (job_id,source_sequence) do nothing;
      v_changed := v_changed or found;
    end loop;
  end if;

  if new.state is distinct from old.state and (
    new.state in ('failed','expired') and new.transcript_expires_at is not null
    or new.state = 'revoked' and old.stage <> 'closed'
  ) then
    insert into shop_private.hq_assistant_chat_messages
      (actor_id,shop_id,location_id,job_id,request_id,consent_generation,source_sequence,role,kind,detail)
    values (new.actor_id,new.shop_id,new.location_id,new.id,new.request_id,new.consent_generation,
      -1,'assistant','status',jsonb_build_object('status',new.state))
    on conflict (job_id,source_sequence) do nothing;
    v_changed := v_changed or found;
  end if;

  if v_changed or ((new.state,new.stage) is distinct from (old.state,old.stage)
    and (new.transcript_expires_at is not null or old.stage <> 'closed')) then
    declare
      v_previous_topic text := current_setting('realtime.topic',true);
    begin
      perform realtime.send('{}'::jsonb,'chat',
        shop_private.hq_assistant_chat_topic(new.actor_id,new.shop_id,new.location_id),true);
      perform set_config('realtime.topic',coalesce(v_previous_topic,''),true);
    end;
  end if;
  return null;
end;
$$;

create or replace function public.shop_hq_assistant_history(
  p_shop_id uuid,p_location_id uuid,p_before_sequence bigint default null,p_limit integer default 30
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_limit integer := coalesce(p_limit,30);
  v_page jsonb;
  v_active jsonb;
  v_now timestamptz := clock_timestamp();
  v_more boolean;
begin
  if not coalesce(shop_private.hq_assistant_chat_owner(v_actor,p_shop_id,p_location_id),false) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if v_limit not between 1 and 30 or (p_before_sequence is not null and p_before_sequence not between 1 and 9007199254740991) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_HISTORY_PAGE' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('sequence',page.sequence,'jobId',page.job_id,'role',page.role,
    'kind',page.kind,'createdAt',page.created_at) || case page.kind
      when 'message' then jsonb_build_object('text',page.text)
      when 'receipt' then jsonb_build_object('link',page.detail)
      when 'action' then jsonb_build_object('link',page.detail)
      when 'clarification' then jsonb_build_object('outcome',page.detail)
      else page.detail end order by page.sequence desc),'[]'::jsonb)
  into v_page from (
    select message.sequence,message.job_id,message.role,message.kind,message.created_at,message.text,message.detail
    from shop_private.hq_assistant_chat_messages message
    where message.actor_id = v_actor and message.shop_id = p_shop_id and message.location_id = p_location_id
      and (p_before_sequence is null or message.sequence < p_before_sequence)
    order by message.sequence desc limit v_limit + 1
  ) page;
  v_more := jsonb_array_length(v_page) > v_limit;
  if v_more then v_page := v_page - v_limit; end if;
  select coalesce(jsonb_agg(item.value order by item.position desc),'[]'::jsonb) into v_page
  from jsonb_array_elements(v_page) with ordinality item(value,position);

  select coalesce(jsonb_agg(jsonb_build_object('jobId',job.id,
    'state',case when job.stage = 'sale_pending' then 'working' else job.state end,
    'reviewPending',job.state = 'completed' and job.stage <> 'sale_pending')
    order by job.created_at,job.id),'[]'::jsonb) into v_active
  from shop_private.hq_assistant_jobs job
  join shop_private.hq_assistant_assignments assignment on assignment.actor_id = job.actor_id
    and assignment.shop_id = job.shop_id and assignment.generation = job.consent_generation
  where job.actor_id = v_actor and job.shop_id = p_shop_id and job.location_id = p_location_id
    and job.stage <> 'closed' and job.state in ('queued','working','completed') and job.expires_at > v_now
    and (job.state <> 'working' or job.lease_expires_at > v_now)
    and assignment.enabled and assignment.consent_version = shop_private.hq_assistant_consent_version();

  return jsonb_build_object('messages',v_page,'hasMore',v_more,'activeJobs',v_active);
end;
$$;

create or replace function public.shop_hq_assistant_dispatch() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_job shop_private.hq_assistant_jobs%rowtype; v_employee uuid;
begin
  perform shop_private.hq_assistant_queue_lock();
  perform shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  for v_job in
    select job.* from shop_private.hq_assistant_jobs job
    join shop_private.hq_assistant_employees employee on employee.shop_id = job.shop_id
    where job.stage = 'waiting' and not exists (
      select 1 from shop_private.hq_assistant_jobs busy
      where busy.employee_id = employee.id and busy.stage in ('assigned','employee','sale_pending','fix_pending')
    )
    order by job.created_at, job.id
  loop
    if not shop_private.hq_assistant_current_consent(v_job) then
      update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed',
        messages = null, owner_message = null, transcript_expires_at = null where id = v_job.id;
      continue;
    end if;
    select id into v_employee from shop_private.hq_assistant_employees where shop_id = v_job.shop_id;
    update shop_private.hq_assistant_jobs set employee_id = v_employee, stage = 'assigned' where id = v_job.id;
    return jsonb_build_object('jobId', v_job.id, 'employeeId', v_employee,
      'employeeTemplate', 'shop-suit-agent-v1', 'headAgentId', 'AG-SHOP-001',
      'headId', (select head_id from shop_private.hq_assistant_department));
  end loop;
  return null;
end;
$$;

notify pgrst, 'reload schema';
commit;
