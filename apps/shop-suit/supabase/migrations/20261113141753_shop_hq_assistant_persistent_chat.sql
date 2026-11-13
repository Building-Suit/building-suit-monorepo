begin;

-- Conversation history is owner-visible only. The queue keeps its existing
-- operational expiry, leases, payment evidence and one-day replay records.
create table shop_private.hq_assistant_chat_messages (
  sequence bigint generated always as identity primary key check (sequence between 1 and 9007199254740991),
  actor_id uuid not null,
  shop_id uuid not null,
  location_id uuid not null,
  job_id uuid not null,
  request_id uuid not null,
  consent_generation bigint not null,
  source_sequence integer not null,
  role text not null check (role in ('user','assistant')),
  kind text not null check (kind in ('message','receipt','clarification','status')),
  text text,
  detail jsonb,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (actor_id,shop_id) references shop_private.hq_assistant_assignments(actor_id,shop_id) on delete cascade,
  foreign key (location_id,shop_id) references public.shop_locations(id,shop_id) on delete cascade,
  unique (job_id,source_sequence),
  check ((kind = 'message' and text is not null and detail is null)
    or (kind <> 'message' and role = 'assistant' and text is null and jsonb_typeof(detail) = 'object'))
);
create index hq_assistant_chat_scope_idx on shop_private.hq_assistant_chat_messages(actor_id,shop_id,location_id,sequence desc);
create index hq_assistant_chat_location_idx on shop_private.hq_assistant_chat_messages(location_id,shop_id);
create index hq_assistant_chat_context_idx on shop_private.hq_assistant_chat_messages
  (actor_id,shop_id,location_id,consent_generation,sequence desc) where kind in ('message','clarification');
create unique index hq_assistant_chat_request_idx on shop_private.hq_assistant_chat_messages(actor_id,shop_id,request_id)
  where role = 'user';
alter table shop_private.hq_assistant_chat_messages enable row level security;
revoke all on table shop_private.hq_assistant_chat_messages from public,anon,authenticated,service_role;
revoke all on sequence shop_private.hq_assistant_chat_messages_sequence_seq from public,anon,authenticated,service_role;

create or replace function shop_private.hq_assistant_consent_version() returns integer
language sql immutable set search_path = ''
as $$ select 3; $$;

create function shop_private.hq_assistant_chat_topic(p_actor uuid,p_shop uuid,p_location uuid) returns text
language sql immutable strict set search_path = ''
as $$ select 'shop-hq-assistant-chat:' || p_actor::text || ':' || p_shop::text || ':' || p_location::text; $$;

create function shop_private.hq_assistant_chat_owner(p_actor uuid,p_shop uuid,p_location uuid) returns boolean
language sql volatile set search_path = ''
as $$
  select p_location is not null and auth.uid() = p_actor
    and coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and shop_private.hq_assistant_is_owner(p_actor,p_shop,p_location);
$$;

create function public.shop_hq_assistant_can_receive_chat(p_topic text) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(p_topic,'') !~ '^shop-hq-assistant-chat:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}(:[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}){2}$' then
    return false;
  end if;
  return coalesce(shop_private.hq_assistant_chat_owner(split_part(p_topic,':',2)::uuid,
    split_part(p_topic,':',3)::uuid,split_part(p_topic,':',4)::uuid),false);
end;
$$;

create policy shop_hq_assistant_chat_receive on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = (select realtime.topic())
  and public.shop_hq_assistant_can_receive_chat(topic));
create policy shop_hq_assistant_chat_guard on realtime.messages as restrictive for select to authenticated
using (case when topic like 'shop-hq-assistant-chat:%' or (select realtime.topic()) like 'shop-hq-assistant-chat:%'
  then extension = 'broadcast' and topic = (select realtime.topic())
    and public.shop_hq_assistant_can_receive_chat(topic) else true end);
create policy shop_hq_assistant_chat_no_anon on realtime.messages as restrictive for select to anon
using (topic not like 'shop-hq-assistant-chat:%' and coalesce((select realtime.topic()),'') not like 'shop-hq-assistant-chat:%');
create policy shop_hq_assistant_chat_no_send on realtime.messages as restrictive for insert to public
with check (topic not like 'shop-hq-assistant-chat:%' and coalesce((select realtime.topic()),'') not like 'shop-hq-assistant-chat:%');

-- Copy only the fields displayed in the owner chat. No queue intent, payment
-- evidence, model context, review feedback, worker details or lease is retained.
create function shop_private.hq_assistant_chat_clarification(p_outcome jsonb) returns jsonb
language plpgsql immutable set search_path = ''
as $$
declare v_kind text := p_outcome->>'kind';
begin
  if v_kind in ('customer_missing','customer_ambiguous','service_missing','service_ambiguous')
    and jsonb_typeof(p_outcome->'query') = 'string' then
    return jsonb_build_object('kind',v_kind,'query',left(p_outcome->>'query',160));
  end if;
  if v_kind in ('cash_shift_required','sale_unavailable','sale_details_required','payment_missing','amount_mismatch') then
    if v_kind in ('payment_missing','amount_mismatch') and jsonb_typeof(p_outcome->'total') = 'number'
      and (p_outcome->>'total')::numeric >= 0 and p_outcome->>'currency' ~ '^[A-Z]{3}$' then
      return jsonb_build_object('kind',v_kind,'total',p_outcome->'total','currency',p_outcome->>'currency');
    end if;
    if v_kind <> 'amount_mismatch' then return jsonb_build_object('kind',v_kind); end if;
  end if;
  return null;
end;
$$;

create function shop_private.hq_assistant_mirror_chat() returns trigger
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

create trigger shop_hq_assistant_mirror_chat
after update of owner_message,updates,state,stage on shop_private.hq_assistant_jobs
for each row execute function shop_private.hq_assistant_mirror_chat();

create function shop_private.hq_assistant_queue_available() returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1 from shop_private.hq_assistant_workers worker
    where worker.queue_enabled and shop_private.hq_assistant_is_worker(worker.auth_user_id)
  );
$$;

-- Keep existing owner authorization semantics while projecting queue health
-- independently of whether this owner consented to new work.
create or replace function public.shop_hq_assistant_access(p_shop_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := auth.uid();
begin
  if coalesce(auth.jwt()->>'is_anonymous','false') = 'true'
    or not shop_private.hq_assistant_is_owner(v_actor,p_shop_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return jsonb_build_object('agentName','Shop Suit Agent','queueAvailable',shop_private.hq_assistant_queue_available(),
    'enabled',exists (
      select 1 from shop_private.hq_assistant_assignments assignment
      where assignment.actor_id = v_actor and assignment.shop_id = p_shop_id and assignment.enabled
        and assignment.consent_version = shop_private.hq_assistant_consent_version()
    ));
end;
$$;

alter function public.shop_hq_assistant_authorize(uuid,boolean) set schema shop_private;
alter function shop_private.shop_hq_assistant_authorize(uuid,boolean) rename to hq_assistant_authorize_consented;
revoke all on function shop_private.hq_assistant_authorize_consented(uuid,boolean) from public,anon,authenticated,service_role;

create function public.shop_hq_assistant_authorize(p_shop_id uuid,p_enabled boolean) returns jsonb
language sql security definer set search_path = ''
as $$
  select shop_private.hq_assistant_authorize_consented(p_shop_id,p_enabled)
    || jsonb_build_object('queueAvailable',shop_private.hq_assistant_queue_available());
$$;

-- Keep the live queue admission/limits and latest owner payment evidence. Only
-- the server can supply earlier turns, and only from this consent generation.
alter function public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb) set schema shop_private;
alter function shop_private.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb) rename to hq_assistant_enqueue_with_context;
revoke all on function shop_private.hq_assistant_enqueue_with_context(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.shop_hq_assistant_send(p_shop_id uuid,p_location_id uuid,p_request_id uuid,p_message text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_generation bigint;
  v_previous shop_private.hq_assistant_chat_messages%rowtype;
  v_messages jsonb;
begin
  perform shop_private.hq_assistant_queue_lock();
  if not coalesce(shop_private.hq_assistant_chat_owner(v_actor,p_shop_id,p_location_id),false) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_request_id is null or p_message is null or p_message !~ '[^[:space:]]' or octet_length(p_message) > 2000 then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_MESSAGES' using errcode = '22023';
  end if;
  select assignment.generation into v_generation from shop_private.hq_assistant_assignments assignment
  where assignment.actor_id = v_actor and assignment.shop_id = p_shop_id and assignment.enabled
    and assignment.consent_version = shop_private.hq_assistant_consent_version();
  if not found then raise exception 'SHOP_HQ_ASSISTANT_CONSENT_REQUIRED' using errcode = '42501'; end if;

  select * into v_previous from shop_private.hq_assistant_chat_messages message
  where message.actor_id = v_actor and message.shop_id = p_shop_id
    and message.request_id = p_request_id and message.role = 'user';
  if found then
    if (v_previous.location_id,v_previous.consent_generation,v_previous.text)
      is distinct from (p_location_id,v_generation,p_message) then
      raise exception 'SHOP_HQ_ASSISTANT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('jobId',v_previous.job_id);
  end if;
  if not shop_private.hq_assistant_queue_available() then
    raise exception 'SHOP_HQ_ASSISTANT_QUEUE_DISABLED' using errcode = '55000';
  end if;

  select coalesce(jsonb_agg(prior.turn order by prior.sequence),'[]'::jsonb) into v_messages
  from (
    select candidate.sequence,candidate.turn,
      sum(octet_length(candidate.turn::text) + 2) over (order by candidate.sequence desc) as total_bytes
    from (
      select message.sequence,jsonb_build_object('role',message.role,'content',
        case when message.kind = 'clarification' then 'Shop checkout clarification: ' || message.detail::text
          else message.text end) as turn
      from shop_private.hq_assistant_chat_messages message
      where message.actor_id = v_actor and message.shop_id = p_shop_id and message.location_id = p_location_id
        and message.consent_generation = v_generation
        and (message.kind = 'message' and octet_length(message.text) <= 2000
          or message.kind = 'clarification' and message.created_at > clock_timestamp() - interval '15 minutes')
      order by message.sequence desc limit 11
    ) candidate
  ) prior
  where prior.total_bytes <= 15000;
  return shop_private.hq_assistant_enqueue_with_context(p_shop_id,p_location_id,p_request_id,
    v_messages || jsonb_build_array(jsonb_build_object('role','user','content',p_message)));
end;
$$;

-- During a rolling app deployment the old browser may still submit its
-- previous array. Validate it as before, but take only the new owner text.
create function public.shop_hq_assistant_enqueue(p_shop_id uuid,p_location_id uuid,p_request_id uuid,p_messages jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
begin
  if jsonb_typeof(p_messages) is distinct from 'array' or octet_length(p_messages::text) > 32768 then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_MESSAGES' using errcode = '22023';
  end if;
  if jsonb_array_length(p_messages) not between 1 and 12
    or p_messages->-1->>'role' is distinct from 'user'
    or exists (
      select 1 from jsonb_array_elements(p_messages) item(value)
      where jsonb_typeof(item.value) is distinct from 'object'
        or coalesce(item.value->>'role','') not in ('user','assistant')
        or jsonb_typeof(item.value->'content') is distinct from 'string'
        or (item.value->>'content') !~ '[^[:space:]]' or octet_length(item.value->>'content') > 2000
        or case when jsonb_typeof(item.value) = 'object' then (item.value - array['role','content']) <> '{}'::jsonb else true end
    ) then raise exception 'SHOP_HQ_ASSISTANT_INVALID_MESSAGES' using errcode = '22023'; end if;
  return public.shop_hq_assistant_send(p_shop_id,p_location_id,p_request_id,p_messages->-1->>'content');
end;
$$;

create function public.shop_hq_assistant_history(
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

revoke all on function shop_private.hq_assistant_chat_topic(uuid,uuid,uuid),
  shop_private.hq_assistant_chat_owner(uuid,uuid,uuid),shop_private.hq_assistant_chat_clarification(jsonb),
  shop_private.hq_assistant_mirror_chat(),shop_private.hq_assistant_queue_available()
from public,anon,authenticated,service_role;

revoke all on function public.shop_hq_assistant_can_receive_chat(text),public.shop_hq_assistant_authorize(uuid,boolean),
  public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb),public.shop_hq_assistant_send(uuid,uuid,uuid,text),
  public.shop_hq_assistant_history(uuid,uuid,bigint,integer)
from public,anon,authenticated,service_role;
grant execute on function public.shop_hq_assistant_can_receive_chat(text),public.shop_hq_assistant_authorize(uuid,boolean),
  public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb),public.shop_hq_assistant_send(uuid,uuid,uuid,text),
  public.shop_hq_assistant_history(uuid,uuid,bigint,integer) to authenticated;

notify pgrst, 'reload schema';
commit;
