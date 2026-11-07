-- Synthetic practice ledger only. No external money transport, SaaS settlement or tax invoice.
create table public.doctor_practice_payment_intents(
 id uuid primary key default gen_random_uuid(),practice_id uuid not null references public.practices(id),location_id uuid not null references public.locations(id),
 doctor_user_id uuid not null references auth.users(id),patient_id uuid not null references public.practice_patients(id),charge_id uuid not null,
 charge_version_id uuid not null references public.doctor_visit_charge_versions(id),kind text not null check(kind in('collection','refund')),
 original_entry_id uuid,amount_minor bigint not null check(amount_minor>0 and amount_minor<=9007199254740991),
 currency text not null check(currency~'^[A-Z]{3}$'),currency_exponent integer not null check(currency_exponent>=0 and currency_exponent<=4),
 reason text not null check(length(btrim(reason))>=2 and length(btrim(reason))<=500 and reason!~'[[:cntrl:]<>]'),
 actor_user_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 check((kind='collection'and original_entry_id is null)or(kind='refund'and original_entry_id is not null))
);
create table public.doctor_practice_payment_events(
 intent_id uuid not null references public.doctor_practice_payment_intents(id),revision integer not null check(revision>0),
 state text not null check(state in('pending','unknown','failed','posted')),reason_code text not null check(reason_code in('prepared','attempt_reconciliation_required','synthetic_accepted','synthetic_rejected','cancelled_before_attempt')),
 actor_user_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),primary key(intent_id,revision)
);
create table public.doctor_practice_ledger_entries(
 id uuid primary key default gen_random_uuid(),intent_id uuid not null unique references public.doctor_practice_payment_intents(id),
 practice_id uuid not null references public.practices(id),location_id uuid not null references public.locations(id),
 patient_id uuid not null references public.practice_patients(id),kind text not null check(kind in('collection','refund')),
 original_entry_id uuid references public.doctor_practice_ledger_entries(id),receipt_number bigint not null check(receipt_number>0 and receipt_number<=9007199254740991),
 amount_minor bigint not null check(amount_minor>0 and amount_minor<=9007199254740991),currency text not null check(currency~'^[A-Z]{3}$'),
 currency_exponent integer not null check(currency_exponent>=0 and currency_exponent<=4),actor_user_id uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 unique(practice_id,location_id,receipt_number),check((kind='collection'and original_entry_id is null)or(kind='refund'and original_entry_id is not null))
);
alter table public.doctor_practice_payment_intents add foreign key(original_entry_id)references public.doctor_practice_ledger_entries(id);
create table public.doctor_practice_payment_allocations(
 entry_id uuid primary key references public.doctor_practice_ledger_entries(id),charge_id uuid not null,
 charge_version_id uuid not null references public.doctor_visit_charge_versions(id),amount_minor bigint not null check(amount_minor>0 and amount_minor<=9007199254740991)
);
create table public.doctor_practice_receipt_counters(
 practice_id uuid not null references public.practices(id),location_id uuid not null references public.locations(id),last_number bigint not null check(last_number>0 and last_number<=9007199254740991),primary key(practice_id,location_id)
);
-- This acceptance is transport evidence, separate from a posted ledger/acknowledgement.
create table doctor_private.synthetic_practice_payment_acceptances(
 intent_id uuid primary key references public.doctor_practice_payment_intents(id),outcome text not null check(outcome in('accepted','rejected')),
 evidence_id uuid not null unique default gen_random_uuid(),actor_user_id uuid not null references auth.users(id),accepted_at timestamptz not null default clock_timestamp()
);
create index doctor_practice_payment_intents_charge on public.doctor_practice_payment_intents(practice_id,location_id,charge_id,created_at desc,id);
create index doctor_practice_payment_original on public.doctor_practice_payment_intents(original_entry_id)where original_entry_id is not null;
create index doctor_practice_allocation_charge on public.doctor_practice_payment_allocations(charge_id);
create index doctor_practice_refund_original on public.doctor_practice_ledger_entries(original_entry_id)where original_entry_id is not null;
do $$declare item text;begin
 foreach item in array array['public.doctor_practice_payment_intents','public.doctor_practice_payment_events','public.doctor_practice_ledger_entries','public.doctor_practice_payment_allocations','public.doctor_practice_receipt_counters','doctor_private.synthetic_practice_payment_acceptances']loop
  execute format('alter table %s enable row level security',item);execute format('alter table %s force row level security',item);
  execute format('create policy doctor_practice_money_postgres on %s for all to postgres using(true)with check(true)',item);
  execute format('revoke all on %s from public,anon,authenticated,service_role',item);
  if item<>'public.doctor_practice_receipt_counters'then execute format('create trigger doctor_practice_money_immutable before update or delete or truncate on %s for each statement execute function doctor_private.saas_history_immutable()',item);end if;
 end loop;
end $$;
create function doctor_private.practice_receipt_counter_guard()returns trigger language plpgsql security invoker set search_path=''as $$begin
 if tg_op<>'UPDATE'then raise exception using errcode='42501',message='DOCTOR_SAAS_HISTORY_IMMUTABLE';end if;
 if new.practice_id<>old.practice_id or new.location_id<>old.location_id or new.last_number<>old.last_number+1 then raise exception using errcode='40001',message='DOCTOR_PRACTICE_RECEIPT_SEQUENCE_CONFLICT';end if;
 return new;
end $$;
create trigger doctor_practice_receipt_counter_guard before update or delete on public.doctor_practice_receipt_counters for each row execute function doctor_private.practice_receipt_counter_guard();
create trigger doctor_practice_receipt_counter_no_truncate before truncate on public.doctor_practice_receipt_counters for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.practice_money_balance(p_charge uuid)returns jsonb language sql stable security invoker set search_path=''as $$
 with ledger as(select coalesce(sum(e.amount_minor::numeric)filter(where e.kind='collection'),0)collected,coalesce(sum(e.amount_minor::numeric)filter(where e.kind='refund'),0)refunded from public.doctor_practice_ledger_entries e join public.doctor_practice_payment_allocations a on a.entry_id=e.id where a.charge_id=p_charge),
 intents as(select i.*,s.state from public.doctor_practice_payment_intents i cross join lateral(select state from public.doctor_practice_payment_events where intent_id=i.id order by revision desc limit 1)s where i.charge_id=p_charge),
 reserved as(select coalesce(sum(amount_minor::numeric)filter(where kind='collection'and state in('pending','unknown')),0)collections,coalesce(sum(amount_minor::numeric)filter(where kind='refund'and state in('pending','unknown')),0)refunds from intents)
 select jsonb_build_object('collected_minor',l.collected::text,'refunded_minor',l.refunded::text,'net_minor',(l.collected-l.refunded)::text,'reserved_collection_minor',r.collections::text,'reserved_refund_minor',r.refunds::text)from ledger l cross join reserved r
$$;
create function doctor_private.practice_refund_used(p_original uuid)returns numeric language sql stable security invoker set search_path=''as $$
 select coalesce((select sum(amount_minor::numeric)from public.doctor_practice_ledger_entries where original_entry_id=p_original),0)+coalesce((select sum(i.amount_minor::numeric)from public.doctor_practice_payment_intents i cross join lateral(select state from public.doctor_practice_payment_events where intent_id=i.id order by revision desc limit 1)s where i.original_entry_id=p_original and s.state in('pending','unknown')),0)
$$;
create function doctor_private.practice_payment_projection(p_intent uuid)returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('id',i.id,'practice_id',i.practice_id,'location_id',i.location_id,'doctor_user_id',i.doctor_user_id,'patient_id',i.patient_id,'charge_id',i.charge_id,'charge_version_id',i.charge_version_id,'kind',i.kind,'original_entry_id',i.original_entry_id,'original_receipt_label',(select 'SYN-'||lpad(e.receipt_number::text,greatest(8,length(e.receipt_number::text)),'0')from public.doctor_practice_ledger_entries e where e.id=i.original_entry_id),'amount_minor',i.amount_minor::text,'currency',i.currency,'currency_exponent',i.currency_exponent,'reason',i.reason,'actor_user_id',i.actor_user_id,'created_at',i.created_at,'revision',s.revision,'state',s.state,'reason_code',s.reason_code,'state_at',s.created_at,
 'entry',(select to_jsonb(e)-'amount_minor'-'receipt_number'||jsonb_build_object('amount_minor',e.amount_minor::text,'receipt_number',e.receipt_number::text,'receipt_label','SYN-'||lpad(e.receipt_number::text,greatest(8,length(e.receipt_number::text)),'0'),'refundable_minor',case when e.kind='collection'then(e.amount_minor::numeric-doctor_private.practice_refund_used(e.id))::text else null end)from public.doctor_practice_ledger_entries e where e.intent_id=i.id),
 'data_mode','synthetic','external_transport_enabled',false,'live_collection',false,'tax_invoice_available',false,'tax_applicability','unreviewed')
 from public.doctor_practice_payment_intents i cross join lateral(select * from public.doctor_practice_payment_events where intent_id=i.id order by revision desc limit 1)s where i.id=p_intent
$$;
create function doctor_private.prepare_practice_payment(p_practice uuid,p_location uuid,p_kind text,p_charge_version uuid,p_original uuid,p_minor text,p_reason text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;charge public.doctor_visit_charge_versions;original public.doctor_practice_ledger_entries;prior doctor_private.command_receipts;item public.doctor_practice_payment_intents;balance jsonb;result jsonb;
 request jsonb:=jsonb_build_object('command','practice.payment.prepare','practice',p_practice,'location',p_location,'kind',p_kind,'charge_version',p_charge_version,'original',p_original,'minor',p_minor,'reason',p_reason);
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_key is null or p_kind is null or p_kind not in('collection','refund')or p_charge_version is null or p_minor is null or p_minor!~'^[1-9][0-9]{0,15}$'
  or(p_kind='collection')<>(p_original is null)or p_reason is null or length(btrim(p_reason))<2 or length(btrim(p_reason))>500 or p_reason~'[[:cntrl:]<>]'then raise exception using errcode='22023',message='DOCTOR_PRACTICE_PAYMENT_INVALID';end if;
 if p_minor::numeric>9007199254740991 then raise exception using errcode='22023',message='DOCTOR_PRACTICE_PAYMENT_INVALID';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform doctor_private.practice_billing_owner(p_practice,p_location,true);
 select * into charge from public.doctor_visit_charge_versions where id=p_charge_version and practice_id=p_practice and location_id=p_location;
 if charge.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 if charge.revision<>(select max(revision)from public.doctor_visit_charge_versions where charge_id=charge.charge_id)then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 if p_kind='collection'then
  if not exists(select 1 from public.appointments where id=charge.visit_id and practice_id=p_practice and patient_id=charge.patient_id and state not in('cancelled','no_show'))then raise exception using errcode='40001',message='DOCTOR_PRACTICE_PAYMENT_VISIT_REVIEW';end if;
  balance:=doctor_private.practice_money_balance(charge.charge_id);
  if p_minor::numeric>charge.amount_minor::numeric-(balance->>'net_minor')::numeric-(balance->>'reserved_collection_minor')::numeric then raise exception using errcode='40001',message='DOCTOR_PRACTICE_OVER_ALLOCATION';end if;
 else
  select e.* into original from public.doctor_practice_ledger_entries e join public.doctor_practice_payment_allocations a on a.entry_id=e.id where e.id=p_original and e.kind='collection'and e.practice_id=p_practice and e.location_id=p_location and e.patient_id=charge.patient_id and a.charge_id=charge.charge_id and e.currency=charge.currency and e.currency_exponent=charge.currency_exponent;
  if original.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  if p_minor::numeric>original.amount_minor::numeric-doctor_private.practice_refund_used(original.id)then raise exception using errcode='40001',message='DOCTOR_PRACTICE_OVER_REFUND';end if;
 end if;
 insert into public.doctor_practice_payment_intents(practice_id,location_id,doctor_user_id,patient_id,charge_id,charge_version_id,kind,original_entry_id,amount_minor,currency,currency_exponent,reason,actor_user_id)
 values(p_practice,p_location,actor,charge.patient_id,charge.charge_id,charge.id,p_kind,p_original,p_minor::bigint,charge.currency,charge.currency_exponent,btrim(p_reason),actor)returning * into item;
 insert into public.doctor_practice_payment_events values(item.id,1,'pending','prepared',actor,clock_timestamp());
 result:=doctor_private.practice_payment_projection(item.id);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
create function doctor_private.advance_practice_payment(p_practice uuid,p_location uuid,p_intent uuid,p_revision integer,p_action text,p_outcome text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;item public.doctor_practice_payment_intents;current_event public.doctor_practice_payment_events;acceptance doctor_private.synthetic_practice_payment_acceptances;charge public.doctor_visit_charge_versions;prior doctor_private.command_receipts;posted public.doctor_practice_ledger_entries;receipt bigint;next_state text;reason text;result jsonb;
 request jsonb:=jsonb_build_object('command','practice.payment.advance','practice',p_practice,'location',p_location,'intent',p_intent,'revision',p_revision,'action',p_action,'outcome',p_outcome);
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_key is null or p_intent is null or p_revision is null or p_revision<1 or p_action is null or p_action not in('dispatch','reconcile','cancel')
  or(p_action='dispatch'and(p_outcome is null or p_outcome not in('accepted','rejected')))or(p_action<>'dispatch'and p_outcome is not null)then raise exception using errcode='22023',message='DOCTOR_PRACTICE_PAYMENT_INVALID';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into item from public.doctor_practice_payment_intents where id=p_intent and practice_id=p_practice and location_id=p_location and doctor_user_id=actor;
 if item.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 select * into current_event from public.doctor_practice_payment_events where intent_id=item.id order by revision desc limit 1;
 if current_event.revision<>p_revision or current_event.state in('failed','posted')then raise exception using errcode='40001',message='DOCTOR_PRACTICE_PAYMENT_CONFLICT';end if;
 select * into acceptance from doctor_private.synthetic_practice_payment_acceptances where intent_id=item.id;
 if p_action='dispatch'then
  perform doctor_private.practice_billing_owner(p_practice,p_location,true);
  if current_event.state<>'pending'or acceptance.intent_id is not null then raise exception using errcode='40001',message='DOCTOR_PRACTICE_RECONCILIATION_REQUIRED';end if;
  select * into charge from public.doctor_visit_charge_versions where charge_id=item.charge_id order by revision desc limit 1;
  if charge.id<>item.charge_version_id then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
  if item.kind='collection'and not exists(select 1 from public.appointments where id=charge.visit_id and practice_id=p_practice and patient_id=item.patient_id and state not in('cancelled','no_show'))then raise exception using errcode='40001',message='DOCTOR_PRACTICE_PAYMENT_VISIT_REVIEW';end if;
  insert into doctor_private.synthetic_practice_payment_acceptances(intent_id,outcome,actor_user_id)values(item.id,p_outcome,actor);
  next_state:='unknown';reason:='attempt_reconciliation_required';
 elsif p_action='cancel'then
  if current_event.state<>'pending'or acceptance.intent_id is not null then raise exception using errcode='40001',message='DOCTOR_PRACTICE_RECONCILIATION_REQUIRED';end if;
  next_state:='failed';reason:='cancelled_before_attempt';
 else
  -- No supplied outcome, invented failure or second movement: consult persisted transport evidence only.
  if current_event.state<>'unknown'or acceptance.intent_id is null then raise exception using errcode='40001',message='DOCTOR_PRACTICE_ACCEPTANCE_EVIDENCE_REQUIRED';end if;
  if acceptance.outcome='rejected'then next_state:='failed';reason:='synthetic_rejected';
  else
   insert into public.doctor_practice_receipt_counters(practice_id,location_id,last_number)values(p_practice,p_location,1)
    on conflict(practice_id,location_id)do update set last_number=public.doctor_practice_receipt_counters.last_number+1 returning last_number into receipt;
   insert into public.doctor_practice_ledger_entries(intent_id,practice_id,location_id,patient_id,kind,original_entry_id,receipt_number,amount_minor,currency,currency_exponent,actor_user_id)
    values(item.id,p_practice,p_location,item.patient_id,item.kind,item.original_entry_id,receipt,item.amount_minor,item.currency,item.currency_exponent,actor)returning * into posted;
   insert into public.doctor_practice_payment_allocations values(posted.id,item.charge_id,item.charge_version_id,item.amount_minor);
   next_state:='posted';reason:='synthetic_accepted';
  end if;
 end if;
 insert into public.doctor_practice_payment_events values(item.id,current_event.revision+1,next_state,reason,actor,clock_timestamp());
 result:=doctor_private.practice_payment_projection(item.id);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
-- Charge corrections share the same practice lock and cannot erase posted/reserved allocations.
create function doctor_private.practice_charge_allocation_floor()returns trigger language plpgsql security definer set search_path=''as $$declare balance jsonb;begin
 perform pg_advisory_xact_lock(hashtextextended(new.practice_id::text,1));
 balance:=doctor_private.practice_money_balance(new.charge_id);
 if new.amount_minor::numeric<(balance->>'net_minor')::numeric+(balance->>'reserved_collection_minor')::numeric then raise exception using errcode='40001',message='DOCTOR_PRACTICE_ALLOCATED_CHARGE_FLOOR';end if;
 return new;
end $$;
create trigger doctor_practice_charge_allocation_floor before insert on public.doctor_visit_charge_versions for each row execute function doctor_private.practice_charge_allocation_floor();
create function doctor_private.practice_money_state(p_practice uuid,p_location uuid,p_charge uuid,p_page integer)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;charge public.doctor_visit_charge_versions;result jsonb;entitlement jsonb;place public.locations;begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_charge is null or p_page is null or p_page<1 or p_page>1000000 then raise exception using errcode='22023',message='DOCTOR_PRACTICE_PAYMENT_INVALID';end if;
 select * into charge from public.doctor_visit_charge_versions where practice_id=p_practice and location_id=p_location and charge_id=p_charge order by revision desc limit 1;
 if charge.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 select * into place from public.locations where id=p_location and practice_id=p_practice;
 entitlement:=doctor_private.saas_entitlement_context(p_practice);
 select jsonb_build_object('edition',doctor_private.edition_mode(),'entitlement',entitlement,'location_archived',place.archived_at is not null,'can_write',place.archived_at is null and coalesce((entitlement->>'writes_allowed')::boolean,false),'actor_user_id',actor,'practice_id',p_practice,'location_id',p_location,'charge_id',charge.charge_id,'charge_version_id',charge.id,'patient_id',charge.patient_id,'currency',charge.currency,'currency_exponent',charge.currency_exponent,'charge_minor',charge.amount_minor::text,'charge_label',charge.label,'patient_name',(select display_name from public.practice_patients where id=charge.patient_id and practice_id=p_practice),'charge_recorded_at',charge.created_at,'clinic_name',place.name,'timezone',place.timezone,'balance',doctor_private.practice_money_balance(charge.charge_id),
 'page',p_page,'total',(select count(*)from public.doctor_practice_payment_intents where charge_id=p_charge),
 'items',coalesce((select jsonb_agg(doctor_private.practice_payment_projection(i.id)order by i.created_at desc,i.id)from(select * from public.doctor_practice_payment_intents where charge_id=p_charge order by created_at desc,id limit 20 offset(p_page-1)*20)i),'[]'::jsonb),
 'data_mode','synthetic','external_transport_enabled',false,'live_collection',false,'tax_invoice_available',false,'tax_applicability','unreviewed')into result;
 return result;
end $$;
create function public.doctor_prepare_practice_payment(p_practice uuid,p_location uuid,p_kind text,p_charge_version uuid,p_original uuid,p_minor text,p_reason text,p_key uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.prepare_practice_payment(p_practice,p_location,p_kind,p_charge_version,p_original,p_minor,p_reason,p_key)$$;
create function public.doctor_advance_practice_payment(p_practice uuid,p_location uuid,p_intent uuid,p_revision integer,p_action text,p_outcome text,p_key uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.advance_practice_payment(p_practice,p_location,p_intent,p_revision,p_action,p_outcome,p_key)$$;
create function public.doctor_practice_money_state(p_practice uuid,p_location uuid,p_charge uuid,p_page integer default 1)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.practice_money_state(p_practice,p_location,p_charge,p_page)$$;
revoke all on function doctor_private.practice_receipt_counter_guard(),doctor_private.practice_money_balance(uuid),doctor_private.practice_refund_used(uuid),doctor_private.practice_payment_projection(uuid),doctor_private.practice_charge_allocation_floor(),doctor_private.prepare_practice_payment(uuid,uuid,text,uuid,uuid,text,text,uuid),doctor_private.advance_practice_payment(uuid,uuid,uuid,integer,text,text,uuid),doctor_private.practice_money_state(uuid,uuid,uuid,integer),public.doctor_prepare_practice_payment(uuid,uuid,text,uuid,uuid,text,text,uuid),public.doctor_advance_practice_payment(uuid,uuid,uuid,integer,text,text,uuid),public.doctor_practice_money_state(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.prepare_practice_payment(uuid,uuid,text,uuid,uuid,text,text,uuid),doctor_private.advance_practice_payment(uuid,uuid,uuid,integer,text,text,uuid),doctor_private.practice_money_state(uuid,uuid,uuid,integer),public.doctor_prepare_practice_payment(uuid,uuid,text,uuid,uuid,text,text,uuid),public.doctor_advance_practice_payment(uuid,uuid,uuid,integer,text,text,uuid),public.doctor_practice_money_state(uuid,uuid,uuid,integer)to authenticated;
