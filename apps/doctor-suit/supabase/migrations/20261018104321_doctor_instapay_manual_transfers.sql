-- Doctor-only manual InstaPay notices. No merchant, price, recipient, reviewer or
-- live acceptance is seeded. Customer evidence is never a settlement command.
create table public.doctor_manual_payment_recipients(
 id uuid primary key default gen_random_uuid(),
 account_key uuid not null,
 address_kind text not null check(address_kind in('ipa','mobile')),
 address text not null check(length(btrim(address))>=2 and length(btrim(address))<=200 and address !~ '[[:cntrl:]<>]' and address !~ '://'),
 beneficiary_name text not null check(length(btrim(beneficiary_name)) between 2 and 200),
 instructions_en text not null check(length(btrim(instructions_en)) between 1 and 2000),
 instructions_ar text not null check(length(btrim(instructions_ar)) between 1 and 2000),
 currency text not null check(currency~'^[A-Z]{3}$'),
 currency_exponent integer not null check(currency_exponent between 0 and 4),
 merchant_approval_ref text not null check(length(btrim(merchant_approval_ref)) between 1 and 200),
 created_at timestamptz not null default clock_timestamp(),
 database_actor text not null default session_user
);
create table public.doctor_manual_payment_configuration(
 singleton boolean primary key default true check(singleton),
 revision integer not null check(revision>0),
 recipient_id uuid references public.doctor_manual_payment_recipients(id),
 enabled boolean not null default false,
 acceptance_mode text not null default 'disabled' check(acceptance_mode in('disabled','synthetic')),
 activation_policy text check(activation_policy='inactive_account_on_review'),
 activation_approval_ref text check(length(btrim(activation_approval_ref)) between 1 and 200),
 change_reason text not null check(length(btrim(change_reason)) between 1 and 200),
 changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or (recipient_id is not null and acceptance_mode='synthetic'))
);
create table public.doctor_manual_payment_configuration_events(
 revision integer primary key,recipient_id uuid references public.doctor_manual_payment_recipients(id),
 enabled boolean not null,acceptance_mode text not null,activation_policy text,activation_approval_ref text,
 change_reason text not null,database_actor text not null,happened_at timestamptz not null default clock_timestamp()
);
create table public.doctor_manual_payment_reviewers(
 user_id uuid primary key references auth.users(id),enabled boolean not null,
 revision integer not null check(revision>0),approval_ref text not null check(length(btrim(approval_ref)) between 1 and 200),
 valid_until timestamptz not null check(pg_catalog.isfinite(valid_until)),
 changed_at timestamptz not null default clock_timestamp()
);
create table public.doctor_manual_payment_reviewer_events(
 user_id uuid not null references auth.users(id),revision integer not null,
 enabled boolean not null,approval_ref text not null,valid_until timestamptz not null,
 database_actor text not null,happened_at timestamptz not null default clock_timestamp(),primary key(user_id,revision)
);
create table public.doctor_manual_payment_requests(
 id uuid primary key default gen_random_uuid(),subscriber_user_id uuid not null references auth.users(id),
 intent_id uuid not null unique references public.doctor_saas_payment_intents(id),
 recipient_id uuid not null references public.doctor_manual_payment_recipients(id),configuration_revision integer not null,
 created_at timestamptz not null default clock_timestamp(),unique(id,recipient_id,intent_id,subscriber_user_id)
);
create table public.doctor_manual_payment_notices(
 id uuid primary key default gen_random_uuid(),
 subscriber_user_id uuid not null references auth.users(id),
 intent_id uuid not null unique references public.doctor_saas_payment_intents(id),
 recipient_id uuid not null references public.doctor_manual_payment_recipients(id),
 configuration_revision integer not null,request_id uuid not null,requires_attention boolean not null,
 foreign key(request_id,recipient_id,intent_id,subscriber_user_id)references public.doctor_manual_payment_requests(id,recipient_id,intent_id,subscriber_user_id),
 transfer_reference text not null check(length(btrim(transfer_reference))>=2 and length(btrim(transfer_reference))<=200 and transfer_reference !~ '[[:cntrl:]<>]'),
 transferred_at timestamptz not null check(pg_catalog.isfinite(transferred_at)),
 created_at timestamptz not null default clock_timestamp(),
 unique(subscriber_user_id,id)
);
create index doctor_manual_payment_notices_owner on public.doctor_manual_payment_notices(subscriber_user_id,created_at desc,id);
create table public.doctor_manual_received_funds(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null unique references public.doctor_manual_payment_notices(id),
 recipient_account_key uuid not null,received_reference text not null,
 received_minor bigint not null check(received_minor>0 and received_minor<=9007199254740991),
 currency text not null check(currency~'^[A-Z]{3}$'),received_at timestamptz not null check(pg_catalog.isfinite(received_at)),
 verified_by uuid not null references auth.users(id),verification_ref text not null check(length(btrim(verification_ref)) between 2 and 200),
 verified_at timestamptz not null default clock_timestamp(),
 unique(recipient_account_key,received_reference),
 check(received_reference=upper(btrim(received_reference)) and length(received_reference)>=2 and length(received_reference)<=200 and received_reference !~ '[[:cntrl:]<>]')
);
create table public.doctor_manual_payment_reviews(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null references public.doctor_manual_payment_notices(id),
 revision integer not null check(revision>0),
 action text not null check(action in('under_review','rejected','funds_verified','activated')),
 actor_user_id uuid not null references auth.users(id),reason text not null check(length(btrim(reason)) between 2 and 500),
 funds_id uuid references public.doctor_manual_received_funds(id),
 period_id uuid references public.doctor_saas_periods(id) deferrable initially deferred,
 happened_at timestamptz not null default clock_timestamp(),unique(notice_id,revision),
 check((action in('funds_verified','activated'))=(funds_id is not null)),
 check((action='activated')=(period_id is not null))
);
create unique index doctor_manual_payment_activation_once on public.doctor_manual_payment_reviews(notice_id)where action='activated';
insert into public.doctor_manual_payment_configuration(singleton,revision,change_reason)
 values(true,1,'InstaPay selected; recipient, terms and independent review authority remain unconfigured');
insert into public.doctor_manual_payment_configuration_events(revision,recipient_id,enabled,acceptance_mode,change_reason,database_actor)
 select revision,recipient_id,enabled,acceptance_mode,change_reason,session_user from public.doctor_manual_payment_configuration;

do $$declare name text;begin
 foreach name in array array['doctor_manual_payment_recipients','doctor_manual_payment_configuration','doctor_manual_payment_configuration_events','doctor_manual_payment_reviewers','doctor_manual_payment_reviewer_events','doctor_manual_payment_requests','doctor_manual_payment_notices','doctor_manual_received_funds','doctor_manual_payment_reviews']loop
  execute format('alter table public.%I enable row level security',name);
  execute format('alter table public.%I force row level security',name);
  execute format('create policy %I on public.%I for all to postgres using(true)with check(true)',name||'_owner',name);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
  if name not in('doctor_manual_payment_configuration','doctor_manual_payment_reviewers')then
   execute format('create trigger %I before update or delete or truncate on public.%I for each statement execute function doctor_private.saas_history_immutable()',name||'_immutable',name);
  else
   execute format('create trigger %I before truncate on public.%I for each statement execute function doctor_private.saas_history_immutable()',name||'_no_truncate',name);
  end if;
 end loop;
end $$;
create function doctor_private.saas_offer_selected(p_terms uuid,p_revision integer)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.doctor_saas_configuration where revision=p_revision and terms_version_id=p_terms)
$$;
create function doctor_private.manual_payment_configuration_change()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if tg_op='DELETE' or new.singleton is distinct from old.singleton or new.revision<>old.revision+1 then
  raise exception using errcode='40001',message='DOCTOR_MANUAL_CONFIGURATION_CONFLICT';end if;
 new.changed_at:=clock_timestamp();
 insert into public.doctor_manual_payment_configuration_events(revision,recipient_id,enabled,acceptance_mode,activation_policy,activation_approval_ref,change_reason,database_actor)
 values(new.revision,new.recipient_id,new.enabled,new.acceptance_mode,new.activation_policy,new.activation_approval_ref,new.change_reason,session_user);
 return new;
end $$;
create trigger doctor_manual_payment_configuration_change before update or delete on public.doctor_manual_payment_configuration
 for each row execute function doctor_private.manual_payment_configuration_change();
create function doctor_private.manual_payment_reviewer_change()returns trigger
language plpgsql security definer set search_path=''as $$begin
 if tg_op='DELETE' then raise exception using errcode='42501',message='DOCTOR_SAAS_HISTORY_IMMUTABLE';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-manual-reviewer:'||new.user_id::text,7));
 if(tg_op='INSERT' and new.revision<>1)or(tg_op='UPDATE' and(new.user_id is distinct from old.user_id or new.revision<>old.revision+1))then
  raise exception using errcode='40001',message='DOCTOR_MANUAL_REVIEWER_CONFLICT';end if;
 new.changed_at:=clock_timestamp();
 insert into public.doctor_manual_payment_reviewer_events(user_id,revision,enabled,approval_ref,valid_until,database_actor)
 values(new.user_id,new.revision,new.enabled,new.approval_ref,new.valid_until,session_user);
 return new;
end $$;
create trigger doctor_manual_payment_reviewer_change before insert or update or delete on public.doctor_manual_payment_reviewers
 for each row execute function doctor_private.manual_payment_reviewer_change();
create function doctor_private.require_manual_reviewer()returns uuid
language plpgsql volatile security definer set search_path=''as $$declare actor uuid:=doctor_private.current_actor();begin
 if not exists(select 1 from public.doctor_manual_payment_reviewers where user_id=actor and enabled and valid_until>clock_timestamp())then
  raise exception using errcode='42501',message='DOCTOR_MANUAL_REVIEW_AUTHORITY_REQUIRED';end if;
 return actor;
end $$;
create function doctor_private.manual_payment_configuration()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();c public.doctor_manual_payment_configuration;r public.doctor_manual_payment_recipients;ready boolean;begin
 perform doctor_private.require_owner_enrollment();
 select * into c from public.doctor_manual_payment_configuration where singleton;
 select * into r from public.doctor_manual_payment_recipients where id=c.recipient_id;
 ready:=coalesce(c.enabled and c.acceptance_mode='synthetic' and r.id is not null,false);
 return jsonb_build_object('subscriber_user_id',actor,'selected_route','instapay_manual','configuration_revision',c.revision,
 'configured',ready,'acceptance_mode',case when ready then 'synthetic'else'disabled'end,
 'recipient',case when ready then jsonb_build_object('id',r.id,'kind',r.address_kind,'address',r.address,'beneficiary_name',r.beneficiary_name,
  'instructions_en',r.instructions_en,'instructions_ar',r.instructions_ar,'currency',r.currency,'currency_exponent',r.currency_exponent)else null end,
 'live_acceptance_enabled',false,'automatic_verification',false,'customer_submission_activates',false);
end $$;
create function doctor_private.manual_notice_projection(n public.doctor_manual_payment_notices)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare q public.doctor_saas_quotes;r public.doctor_manual_payment_recipients;review public.doctor_manual_payment_reviews;begin
 select q0.* into q from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q0 on q0.id=i.quote_id where i.id=n.intent_id;
 select * into r from public.doctor_manual_payment_recipients where id=n.recipient_id;
 select * into review from public.doctor_manual_payment_reviews where notice_id=n.id order by revision desc limit 1;
 return jsonb_build_object('id',n.id,'subscriber_user_id',n.subscriber_user_id,'intent_id',n.intent_id,'quote_id',q.id,
 'terms_id',q.terms_version_id,'billing_interval',q.billing_interval,'amount_minor',q.amount_minor::text,'currency',q.currency,'currency_exponent',q.currency_exponent,
 'recipient_id',r.id,'beneficiary_name',r.beneficiary_name,'transfer_reference',n.transfer_reference,'transferred_at',n.transferred_at,'created_at',n.created_at,
 'status',coalesce(review.action,'submitted'),'revision',coalesce(review.revision,0),'review_reason',review.reason,
 'period_id',review.period_id,'requires_attention',n.requires_attention,'independent_verification_required',true,'automatic_verification',false,'live_acceptance_enabled',false);
end $$;
create function doctor_private.prepare_manual_payment(p_intent uuid,p_configuration_revision integer,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();i public.doctor_saas_payment_intents;q public.doctor_saas_quotes;
 c public.doctor_manual_payment_configuration;r public.doctor_manual_payment_recipients;item public.doctor_manual_payment_requests;
 prior doctor_private.command_receipts;state jsonb;result jsonb;
 request jsonb:=jsonb_build_object('command','manual.payment.prepare','intent',p_intent,'configuration_revision',p_configuration_revision);
begin
 if p_intent is null or p_key is null or p_configuration_revision is null then raise exception using errcode='22023',message='DOCTOR_MANUAL_SUBMISSION_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 select * into i from public.doctor_saas_payment_intents where id=p_intent and subscriber_user_id=actor;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into c from public.doctor_manual_payment_configuration where singleton for share;
 select * into r from public.doctor_manual_payment_recipients where id=c.recipient_id;
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 if not coalesce(c.enabled and c.acceptance_mode='synthetic'and r.id is not null,false)then raise exception using errcode='DS008',message='DOCTOR_MANUAL_PAYMENT_UNCONFIGURED';end if;
 if c.revision<>p_configuration_revision then raise exception using errcode='40001',message='DOCTOR_MANUAL_CONFIGURATION_CONFLICT';end if;
 select * into q from public.doctor_saas_quotes where id=i.quote_id;state:=doctor_private.saas_account_state(actor);
 if not doctor_private.saas_offer_selected(q.terms_version_id,q.configuration_revision)or q.currency<>r.currency or q.currency_exponent<>r.currency_exponent or q.amount_minor<=0
  or(state->>'revision')::integer<>q.account_revision or(state#>>'{period,id}')::uuid is distinct from q.current_period_id or state->>'state'='suspended'
 then raise exception using errcode='40001',message='DOCTOR_SAAS_QUOTE_STALE';end if;
 insert into public.doctor_manual_payment_requests(subscriber_user_id,intent_id,recipient_id,configuration_revision)values(actor,i.id,r.id,c.revision)on conflict(intent_id)do nothing;
 select * into item from public.doctor_manual_payment_requests where intent_id=i.id;
 select * into r from public.doctor_manual_payment_recipients where id=item.recipient_id;
 result:=jsonb_build_object('request_id',item.id,'intent_id',i.id,'quote_id',q.id,'subscriber_user_id',actor,'configuration_revision',item.configuration_revision,
  'recipient',jsonb_build_object('id',r.id,'kind',r.address_kind,'address',r.address,'beneficiary_name',r.beneficiary_name,'instructions_en',r.instructions_en,'instructions_ar',r.instructions_ar),
  'amount_minor',q.amount_minor::text,'currency',q.currency,'currency_exponent',q.currency_exponent,'acceptance_mode','synthetic','live_acceptance_enabled',false);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
create function doctor_private.submit_manual_payment(p_intent uuid,p_reference text,p_transferred_at timestamptz,p_configuration_revision integer,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();i public.doctor_saas_payment_intents;q public.doctor_saas_quotes;c public.doctor_manual_payment_configuration;
 r public.doctor_manual_payment_recipients;prepared public.doctor_manual_payment_requests;n public.doctor_manual_payment_notices;prior doctor_private.command_receipts;result jsonb;state jsonb;
 request jsonb:=jsonb_build_object('command','manual.payment.submit','intent',p_intent,'reference',p_reference,'transferred_at',p_transferred_at,'configuration_revision',p_configuration_revision);
begin
 if p_intent is null or p_key is null or p_reference is null or length(btrim(p_reference))not between 2 and 200 or p_reference~'[[:cntrl:]<>]'
  or p_transferred_at is null or not pg_catalog.isfinite(p_transferred_at)or p_transferred_at>clock_timestamp()or p_configuration_revision is null then
  raise exception using errcode='22023',message='DOCTOR_MANUAL_SUBMISSION_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 select * into i from public.doctor_saas_payment_intents where id=p_intent and subscriber_user_id=actor;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 -- A claim about an already-instructed transfer must remain recordable after
 -- recipient rotation, offer expiry or configuration withdrawal. It grants no
 -- funds/entitlement authority and retains its original recipient snapshot.
 select * into prepared from public.doctor_manual_payment_requests where intent_id=i.id and subscriber_user_id=actor;
 if not found then raise exception using errcode='DS008',message='DOCTOR_MANUAL_PAYMENT_UNCONFIGURED';end if;
 if prepared.configuration_revision<>p_configuration_revision then raise exception using errcode='40001',message='DOCTOR_MANUAL_CONFIGURATION_CONFLICT';end if;
 select * into r from public.doctor_manual_payment_recipients where id=prepared.recipient_id;
 select * into q from public.doctor_saas_quotes where id=i.quote_id;state:=doctor_private.saas_account_state(actor);
 select * into n from public.doctor_manual_payment_notices where intent_id=i.id;
 if found then
  if n.transfer_reference<>btrim(p_reference)or n.transferred_at<>p_transferred_at or n.recipient_id<>r.id then
   raise exception using errcode='22023',message='DOCTOR_MANUAL_NOTICE_EXISTS';end if;
 else
  insert into public.doctor_manual_payment_notices(subscriber_user_id,intent_id,recipient_id,configuration_revision,request_id,requires_attention,transfer_reference,transferred_at)
  values(actor,i.id,r.id,prepared.configuration_revision,prepared.id,not doctor_private.saas_offer_selected(q.terms_version_id,q.configuration_revision)or(state->>'revision')::integer<>q.account_revision or state->>'state'='suspended',btrim(p_reference),p_transferred_at)returning * into n;
 end if;
 result:=doctor_private.manual_notice_projection(n);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;
create function doctor_private.manual_payments(p_notice uuid,p_review_queue boolean,p_page integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare actor uuid:=doctor_private.current_actor();result jsonb;begin
 if p_page is null or p_page<1 or p_page>1000000 or p_review_queue is null then raise exception using errcode='22023',message='DOCTOR_MANUAL_QUERY_INVALID';end if;
 if p_review_queue then perform doctor_private.require_manual_reviewer();end if;
 if p_notice is not null then
  select doctor_private.manual_notice_projection(n)into result from public.doctor_manual_payment_notices n
   where n.id=p_notice and(p_review_queue or n.subscriber_user_id=actor);
  if result is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  return result;
 end if;
 with population as materialized(select n.* from public.doctor_manual_payment_notices n where p_review_queue or n.subscriber_user_id=actor),
 page as(select * from population order by created_at desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('actor_user_id',actor,'review_queue',p_review_queue,'total',(select count(*)from population),'page',p_page,
  'items',coalesce((select jsonb_agg(doctor_private.manual_notice_projection(p::public.doctor_manual_payment_notices)order by p.created_at desc,p.id)from page p),'[]'::jsonb))into result;
 return result;
end $$;
create function doctor_private.review_manual_payment(p_notice uuid,p_revision integer,p_action text,p_reason text,p_received_reference text,p_received_minor text,p_currency text,p_received_at timestamptz,p_verification_ref text,p_independently_verified boolean,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.require_manual_reviewer();n public.doctor_manual_payment_notices;q public.doctor_saas_quotes;r public.doctor_manual_payment_recipients;
 prior doctor_private.command_receipts;review public.doctor_manual_payment_reviews;funds uuid;result jsonb;request jsonb;
begin
 if p_notice is null or p_key is null or p_revision is null or p_revision<0 or p_action is null or p_action not in('under_review','rejected','funds_verified')
  or p_reason is null or length(btrim(p_reason))not between 2 and 500 then raise exception using errcode='22023',message='DOCTOR_MANUAL_REVIEW_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 request:=jsonb_build_object('command','manual.payment.review','notice',p_notice,'revision',p_revision,'action',p_action,'reason',p_reason,
  'received_reference',p_received_reference,'received_minor',p_received_minor,'currency',p_currency,'received_at',p_received_at,'verification_ref',p_verification_ref,'independently_verified',p_independently_verified);
 -- Grant revocation and review serialize before subscriber locks. No grant-row
 -- lock is taken here, avoiding a row/advisory lock inversion with revocation.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-manual-reviewer:'||actor::text,7));
 select * into n from public.doctor_manual_payment_notices where id=p_notice;
 if not found or n.subscriber_user_id=actor then raise exception using errcode='42501',message='DOCTOR_INDEPENDENT_REVIEW_REQUIRED';end if;
 perform doctor_private.saas_lock_subscriber(n.subscriber_user_id);
 perform doctor_private.require_manual_reviewer();
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 select * into review from public.doctor_manual_payment_reviews where notice_id=n.id order by revision desc limit 1;
 if coalesce(review.revision,0)<>p_revision then raise exception using errcode='40001',message='DOCTOR_MANUAL_REVIEW_CONFLICT';end if;
 if coalesce(review.action,'submitted')not in('submitted','under_review')or(review.action='under_review'and p_action='under_review')then
  raise exception using errcode='22023',message='DOCTOR_MANUAL_REVIEW_STATE_INVALID';end if;
 if p_action='funds_verified'then
  if not coalesce(p_received_minor~'^[1-9][0-9]{0,15}$',false)then raise exception using errcode='22023',message='DOCTOR_RECEIVED_FUNDS_VERIFICATION_REQUIRED';end if;
  select q0.* into q from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q0 on q0.id=i.quote_id where i.id=n.intent_id;
  select * into r from public.doctor_manual_payment_recipients where id=n.recipient_id;
  if p_independently_verified is distinct from true or p_received_reference is null or length(btrim(p_received_reference))not between 2 and 200
   or p_received_reference~'[[:cntrl:]<>]'or p_received_minor is null or p_received_minor!~'^[1-9][0-9]{0,15}$'
   or p_received_minor::numeric>9007199254740991 or p_received_minor::bigint<>q.amount_minor or p_currency is distinct from q.currency
   or p_received_at is null or not pg_catalog.isfinite(p_received_at)or p_received_at>clock_timestamp()
   or p_verification_ref is null or length(btrim(p_verification_ref))not between 2 and 200 then
   raise exception using errcode='22023',message='DOCTOR_RECEIVED_FUNDS_VERIFICATION_REQUIRED';end if;
  insert into public.doctor_manual_received_funds(notice_id,recipient_account_key,received_reference,received_minor,currency,received_at,verified_by,verification_ref)
   values(n.id,r.account_key,upper(btrim(p_received_reference)),p_received_minor::bigint,p_currency,p_received_at,actor,btrim(p_verification_ref))returning id into funds;
 elsif p_independently_verified is not false or p_received_reference is not null or p_received_minor is not null or p_currency is not null or p_received_at is not null or p_verification_ref is not null then
  raise exception using errcode='22023',message='DOCTOR_MANUAL_REVIEW_INVALID';
 end if;
 insert into public.doctor_manual_payment_reviews(notice_id,revision,action,actor_user_id,reason,funds_id)
  values(n.id,p_revision+1,p_action,actor,btrim(p_reason),funds);
 result:=doctor_private.manual_notice_projection(n);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;
create function public.doctor_manual_payment_configuration()returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.manual_payment_configuration()$$;
create function public.doctor_prepare_manual_payment(p_intent uuid,p_configuration_revision integer,p_key uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.prepare_manual_payment(p_intent,p_configuration_revision,p_key)$$;
create function public.doctor_submit_manual_payment(p_intent uuid,p_reference text,p_transferred_at timestamptz,p_configuration_revision integer,p_key uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.submit_manual_payment(p_intent,p_reference,p_transferred_at,p_configuration_revision,p_key)$$;
create function public.doctor_manual_payments(p_notice uuid default null,p_review_queue boolean default false,p_page integer default 1)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.manual_payments(p_notice,p_review_queue,p_page)$$;
create function public.doctor_review_manual_payment(p_notice uuid,p_revision integer,p_action text,p_reason text,p_received_reference text,p_received_minor text,p_currency text,p_received_at timestamptz,p_verification_ref text,p_independently_verified boolean,p_key uuid)returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.review_manual_payment(p_notice,p_revision,p_action,p_reason,p_received_reference,p_received_minor,p_currency,p_received_at,p_verification_ref,p_independently_verified,p_key)$$;
-- Explicit execution grants are the public facade; raw data and helper functions
-- remain unavailable to anonymous/service clients and editable metadata.
revoke all on function doctor_private.saas_offer_selected(uuid,integer),doctor_private.manual_payment_configuration_change(),doctor_private.manual_payment_reviewer_change(),doctor_private.require_manual_reviewer(),doctor_private.manual_payment_configuration(),doctor_private.manual_notice_projection(public.doctor_manual_payment_notices),doctor_private.submit_manual_payment(uuid,text,timestamptz,integer,uuid),doctor_private.manual_payments(uuid,boolean,integer),doctor_private.review_manual_payment(uuid,integer,text,text,text,text,text,timestamptz,text,boolean,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.manual_payment_configuration(),doctor_private.submit_manual_payment(uuid,text,timestamptz,integer,uuid),doctor_private.manual_payments(uuid,boolean,integer),doctor_private.review_manual_payment(uuid,integer,text,text,text,text,text,timestamptz,text,boolean,uuid)to authenticated;
revoke all on function public.doctor_manual_payment_configuration(),public.doctor_submit_manual_payment(uuid,text,timestamptz,integer,uuid),public.doctor_manual_payments(uuid,boolean,integer),public.doctor_review_manual_payment(uuid,integer,text,text,text,text,text,timestamptz,text,boolean,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_manual_payment_configuration(),public.doctor_submit_manual_payment(uuid,text,timestamptz,integer,uuid),public.doctor_manual_payments(uuid,boolean,integer),public.doctor_review_manual_payment(uuid,integer,text,text,text,text,text,timestamptz,text,boolean,uuid)to authenticated;

revoke all on function doctor_private.prepare_manual_payment(uuid,integer,uuid),public.doctor_prepare_manual_payment(uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.prepare_manual_payment(uuid,integer,uuid),public.doctor_prepare_manual_payment(uuid,integer,uuid)to authenticated;
