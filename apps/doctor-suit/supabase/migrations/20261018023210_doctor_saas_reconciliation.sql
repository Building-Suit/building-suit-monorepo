-- DOS-AE-005 synthetic reconciliation foundation. No provider/manual route is
-- approved, no callback entrypoint is exposed, and no paid access is possible.
create table public.doctor_saas_synthetic_events(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 event_ref text not null unique check(event_ref~'^synthetic-fixture/[a-zA-Z0-9._/-]{1,160}$'),
 intent_id uuid not null references public.doctor_saas_payment_intents(id),
 reported_subscriber_id uuid not null references auth.users(id),
 amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),
 currency text not null check(currency~'^[A-Z]{3}$'),
 outcome text not null check(outcome in('pending','unknown','confirmed','failed')),
 source_sequence bigint not null check(source_sequence between 1 and 9007199254740991),
 binding text not null check(binding in('matching','mismatch')),
 received_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user
);
create index doctor_saas_synthetic_events_intent on public.doctor_saas_synthetic_events(intent_id,source_sequence);
create table public.doctor_saas_synthetic_deliveries(
 delivery_id uuid primary key,event_id uuid not null references public.doctor_saas_synthetic_events(id),
 intent_id uuid not null references public.doctor_saas_payment_intents(id),
 disposition text not null check(disposition in('recorded','duplicate','conflict')),
 request jsonb not null,result jsonb not null,
 received_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user
);
create index doctor_saas_synthetic_deliveries_event on public.doctor_saas_synthetic_deliveries(event_id);
create index doctor_saas_synthetic_deliveries_intent on public.doctor_saas_synthetic_deliveries(intent_id);
alter table public.doctor_saas_synthetic_events enable row level security;
alter table public.doctor_saas_synthetic_events force row level security;
alter table public.doctor_saas_synthetic_deliveries enable row level security;
alter table public.doctor_saas_synthetic_deliveries force row level security;
create policy doctor_saas_synthetic_events_database on public.doctor_saas_synthetic_events for all to postgres using(true)with check(true);
create policy doctor_saas_synthetic_deliveries_database on public.doctor_saas_synthetic_deliveries for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_synthetic_events,public.doctor_saas_synthetic_deliveries from public,anon,authenticated,service_role;
create trigger doctor_saas_synthetic_events_immutable before update or delete or truncate on public.doctor_saas_synthetic_events
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_saas_synthetic_deliveries_immutable before update or delete or truncate on public.doctor_saas_synthetic_deliveries
 for each statement execute function doctor_private.saas_history_immutable();

-- This is an explicit database-owner fixture interface, never a provider
-- authentication substitute. It cannot accept live evidence or change access.
create function doctor_private.record_saas_synthetic_evidence(p_intent uuid,p_event_ref text,p_sequence bigint,p_outcome text,p_subscriber uuid,p_amount_minor bigint,p_currency text,p_delivery uuid)returns jsonb
language plpgsql volatile security invoker set search_path=''as $$
declare intent public.doctor_saas_payment_intents;quote public.doctor_saas_quotes;event public.doctor_saas_synthetic_events;
 prior public.doctor_saas_synthetic_deliveries;request jsonb;result jsonb;disposition text;binding text;
begin
 if p_intent is null or p_event_ref is null or p_event_ref!~'^synthetic-fixture/[a-zA-Z0-9._/-]{1,160}$'or p_delivery is null
  or p_sequence is null or p_sequence not between 1 and 9007199254740991 or p_subscriber is null or p_amount_minor is null
  or p_amount_minor not between 0 and 9007199254740991 or p_currency is null or p_currency!~'^[A-Z]{3}$'
  or p_outcome is null or p_outcome not in('pending','unknown','confirmed','failed')then
  raise exception using errcode='22023',message='DOCTOR_SAAS_SYNTHETIC_EVIDENCE_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 request:=jsonb_build_object('intent',p_intent,'event_ref',p_event_ref,'sequence',p_sequence,'outcome',p_outcome,'subscriber',p_subscriber,'amount_minor',p_amount_minor::text,'currency',p_currency);
 -- Global identifiers serialize before the per-subscriber lock. Only this
 -- fixture-only interface takes these namespaces, so independent actors progress.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-saas-delivery:'||p_delivery::text,7));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-saas-event:'||p_event_ref,7));
 select * into prior from public.doctor_saas_synthetic_deliveries where delivery_id=p_delivery;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 select * into intent from public.doctor_saas_payment_intents where id=p_intent;
 if not found then raise exception using errcode='22023',message='DOCTOR_SAAS_INTENT_UNKNOWN';end if;
 perform doctor_private.saas_lock_subscriber(intent.subscriber_user_id);
 select * into quote from public.doctor_saas_quotes where id=intent.quote_id and subscriber_user_id=intent.subscriber_user_id;
 select * into event from public.doctor_saas_synthetic_events where event_ref=p_event_ref;
 if found then
  disposition:=case when event.intent_id=p_intent and event.source_sequence=p_sequence and event.outcome=p_outcome
   and event.reported_subscriber_id=p_subscriber and event.amount_minor=p_amount_minor and event.currency=p_currency then'duplicate'else'conflict'end;
 else
  binding:=case when quote.subscriber_user_id=p_subscriber and quote.amount_minor=p_amount_minor and quote.currency=p_currency then'matching'else'mismatch'end;
  insert into public.doctor_saas_synthetic_events(event_ref,intent_id,reported_subscriber_id,amount_minor,currency,outcome,source_sequence,binding)
  values(p_event_ref,p_intent,p_subscriber,p_amount_minor,p_currency,p_outcome,p_sequence,binding)returning * into event;
  disposition:='recorded';
 end if;
 result:=jsonb_build_object('event_id',event.id,'disposition',disposition,'binding',event.binding,'evidence_mode','synthetic_fixture',
  'payment_route','unconfigured','settled',false,'paid_activation_available',false,'live_activation',false);
 insert into public.doctor_saas_synthetic_deliveries(delivery_id,event_id,intent_id,disposition,request,result)
 values(p_delivery,event.id,p_intent,disposition,request,result);
 return result;
end $$;

create function doctor_private.saas_synthetic_reconciliation(p_intent uuid)returns text
language sql stable security invoker set search_path=''as $$
 select case
 when exists(select 1 from public.doctor_saas_synthetic_deliveries d join public.doctor_saas_synthetic_events e on e.id=d.event_id where(d.intent_id=p_intent or e.intent_id=p_intent)and d.disposition='conflict')
  or exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and binding='mismatch')
  or exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent group by source_sequence having count(distinct outcome)>1)
  or(exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and outcome='confirmed')and exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and outcome='failed'))then'discrepancy_review'
 when exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and outcome='confirmed')then'confirmed_synthetic'
 when exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and outcome='unknown')then'unknown_review'
 when exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent and outcome='failed')then'failed_synthetic'
 when exists(select 1 from public.doctor_saas_synthetic_events where intent_id=p_intent)then'pending_synthetic'
 else'awaiting_evidence'end
$$;
create function doctor_private.saas_financial_status(p_page integer,p_size integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();items jsonb;currencies jsonb;total bigint;
begin
 if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 then raise exception using errcode='22023',message='DOCTOR_PAGE_INVALID';end if;
 if not exists(select 1 from public.doctor_saas_quotes where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 select count(*)into total from public.doctor_saas_payment_intents i where i.subscriber_user_id=actor;
 select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'currency_exponent',currency_exponent,'held_intents',held_intents,
  'quoted_minor',quoted_minor::text,'settled_minor',null)order by currency,currency_exponent),'[]'::jsonb)into currencies from(
  select q.currency,q.currency_exponent,count(*)as held_intents,sum(q.amount_minor::numeric)as quoted_minor
  from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q on q.id=i.quote_id and q.subscriber_user_id=i.subscriber_user_id
  where i.subscriber_user_id=actor group by q.currency,q.currency_exponent)population;
 select coalesce(jsonb_agg(jsonb_build_object('intent_id',id,'quote_id',quote_id,'state',state,'created_at',created_at,'reconciliation',doctor_private.saas_synthetic_reconciliation(id),
  'synthetic_event_ids',(select coalesce(jsonb_agg(e.id order by e.source_sequence,e.id),'[]'::jsonb)from public.doctor_saas_synthetic_events e where e.intent_id=page.id))order by created_at desc,id),'[]'::jsonb)
 into items from(select i.*from public.doctor_saas_payment_intents i where i.subscriber_user_id=actor order by i.created_at desc,i.id limit p_size offset p_page::bigint*p_size)page;
 return jsonb_build_object('subscriber_user_id',actor,'scope','saas_only','data_mode','synthetic','payment_route','unconfigured',
  'invoices_available',false,'settlement_available',false,'lifecycle_available',false,'independent_financial_review','pending',
  'patient_revenue_included',false,'totals_scope','full_population','total',total,'currencies',currencies,'items',items,
  'paid_activation_available',false,'live_activation',false);
end $$;
create function public.doctor_saas_financial_status(p_page integer default 0,p_size integer default 25)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.saas_financial_status(p_page,p_size)$$;
revoke all on function doctor_private.record_saas_synthetic_evidence(uuid,text,bigint,text,uuid,bigint,text,uuid),
 doctor_private.saas_synthetic_reconciliation(uuid),doctor_private.saas_financial_status(integer,integer),public.doctor_saas_financial_status(integer,integer)
 from public,anon,authenticated,service_role;
grant execute on function doctor_private.saas_financial_status(integer,integer),public.doctor_saas_financial_status(integer,integer)to authenticated;
