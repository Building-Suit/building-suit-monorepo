-- Synthetic paid-period activation is a separate, reviewer-authorized command.
-- Live money acceptance and real-user/clinical authority remain unavailable.
alter table public.doctor_saas_periods drop constraint doctor_saas_periods_kind_check;
alter table public.doctor_saas_periods add constraint doctor_saas_periods_kind_check check(kind in('trial','manual_paid'));
alter table public.doctor_saas_quotes drop constraint doctor_saas_quotes_account_state_check;
alter table public.doctor_saas_quotes add constraint doctor_saas_quotes_account_state_check check(account_state in('unconfigured','trial','paid','scheduled','expired','suspended'));
alter table public.doctor_manual_payment_reviews add column activation_policy text;
alter table public.doctor_manual_payment_reviews add column activation_approval_ref text;
alter table public.doctor_manual_payment_reviews add column activation_configuration_revision integer;
alter table public.doctor_manual_payment_reviews add constraint doctor_manual_activation_snapshot check((
 (action='activated' and activation_policy='inactive_account_on_review' and length(btrim(activation_approval_ref))between 1 and 200 and activation_configuration_revision>0)
 or(action<>'activated'and activation_policy is null and activation_approval_ref is null and activation_configuration_revision is null))is true);
create function doctor_private.manual_paid_period_valid(p public.doctor_saas_periods)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.doctor_manual_payment_reviews e
 join public.doctor_manual_payment_notices n on n.id=e.notice_id
 join public.doctor_saas_payment_intents i on i.id=n.intent_id
 join public.doctor_saas_quotes q on q.id=i.quote_id
 join public.doctor_manual_received_funds f on f.id=e.funds_id and f.notice_id=n.id
 where e.action='activated'and e.period_id=p.id and e.actor_user_id<>n.subscriber_user_id
 and p.subscriber_user_id=n.subscriber_user_id and p.terms_version_id=q.terms_version_id
 and p.accepted_document_ref=q.accepted_document_ref and f.received_minor=q.amount_minor and f.currency=q.currency
 and p.started_at=e.happened_at
 and p.ends_at=((e.happened_at at time zone'UTC')+pg_catalog.make_interval(months=>case q.billing_interval when 'monthly'then 1 else 12 end))at time zone'UTC')
$$;
create or replace function doctor_private.saas_period_validate()returns trigger
language plpgsql security definer set search_path=''as $$
declare terms public.doctor_saas_terms_versions;expected_end timestamptz;begin
 if not pg_catalog.isfinite(new.started_at)or not pg_catalog.isfinite(new.ends_at)
  or new.started_at<'0001-01-01 00:00:00+00'::timestamptz or new.ends_at>'9999-12-31 23:59:59.999999+00'::timestamptz then
  raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 select * into terms from public.doctor_saas_terms_versions where id=new.terms_version_id and status='approved';
 if not found or new.accepted_document_ref<>terms.terms_document_ref then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 if new.kind='manual_paid'then
  if not doctor_private.manual_paid_period_valid(new)then raise exception using errcode='42501',message='DOCTOR_VERIFIED_MANUAL_ACTIVATION_REQUIRED';end if;
 else
  if new.kind<>'trial'or terms.trial_days<=0 then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
  begin expected_end:=((new.started_at at time zone'UTC')+pg_catalog.make_interval(days=>terms.trial_days))at time zone'UTC';
  exception when datetime_field_overflow or interval_field_overflow then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end;
  if new.ends_at is distinct from expected_end then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 end if;
 return new;
end $$;
create or replace function doctor_private.saas_account_state(p_subscriber uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare account public.doctor_saas_accounts;period public.doctor_saas_periods;terms public.doctor_saas_terms_versions;moment timestamptz;selected text;begin
 select * into account from public.doctor_saas_accounts where subscriber_user_id=p_subscriber;
 if not found then return jsonb_build_object('state','unconfigured','revision',0,'period_active',false,'period',null,'terms',null);end if;
 select * into period from public.doctor_saas_periods where id=account.current_period_id and subscriber_user_id=p_subscriber;
 select * into terms from public.doctor_saas_terms_versions where id=period.terms_version_id and status='approved';
 if period.id is null or terms.id is null or period.accepted_document_ref<>terms.terms_document_ref
  or(period.kind='trial'and terms.trial_days<=0)or(period.kind='manual_paid'and not doctor_private.manual_paid_period_valid(period))then
  raise exception using errcode='42501',message='DOCTOR_SAAS_ACCOUNT_UNAVAILABLE';end if;
 moment:=clock_timestamp();
 selected:=case when account.state='suspended'then'suspended'when moment<period.started_at then'scheduled'when moment>=period.ends_at then'expired'when period.kind='manual_paid'then'paid'else'trial'end;
 return jsonb_build_object('state',selected,'revision',account.revision,'period_active',selected in('trial','paid'),
  'period',jsonb_build_object('id',period.id,'kind',period.kind,'terms_id',period.terms_version_id,'started_at',period.started_at,'ends_at',period.ends_at,'accepted_document_ref',period.accepted_document_ref),
  'terms',doctor_private.saas_terms_projection(terms));
end $$;
create function doctor_private.activate_manual_payment(p_notice uuid,p_revision integer,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.require_manual_reviewer();n public.doctor_manual_payment_notices;q public.doctor_saas_quotes;
 c public.doctor_manual_payment_configuration;review public.doctor_manual_payment_reviews;funds public.doctor_manual_received_funds;
 prior doctor_private.command_receipts;state jsonb;period uuid:=gen_random_uuid();moment timestamptz;ending timestamptz;result jsonb;
 request jsonb:=jsonb_build_object('command','manual.payment.activate','notice',p_notice,'revision',p_revision);
begin
 if p_notice is null or p_revision is null or p_revision<1 or p_key is null then raise exception using errcode='22023',message='DOCTOR_MANUAL_REVIEW_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-manual-reviewer:'||actor::text,7));
 select * into n from public.doctor_manual_payment_notices where id=p_notice;
 if not found or n.subscriber_user_id=actor then raise exception using errcode='42501',message='DOCTOR_INDEPENDENT_REVIEW_REQUIRED';end if;
 perform doctor_private.saas_lock_subscriber(n.subscriber_user_id);perform doctor_private.require_manual_reviewer();
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 select * into review from public.doctor_manual_payment_reviews where notice_id=n.id order by revision desc limit 1;
 if review.revision is distinct from p_revision then raise exception using errcode='40001',message='DOCTOR_MANUAL_REVIEW_CONFLICT';end if;
 if review.action<>'funds_verified'then raise exception using errcode='42501',message='DOCTOR_VERIFIED_MANUAL_ACTIVATION_REQUIRED';end if;
 select * into c from public.doctor_manual_payment_configuration where singleton for share;
 perform doctor_private.require_manual_reviewer();
 if not c.enabled or c.acceptance_mode<>'synthetic'or c.activation_policy is distinct from'inactive_account_on_review'or c.activation_approval_ref is null then
  raise exception using errcode='DS009',message='DOCTOR_MANUAL_ACTIVATION_UNCONFIGURED';end if;
 select q0.* into q from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q0 on q0.id=i.quote_id where i.id=n.intent_id;
 select * into funds from public.doctor_manual_received_funds where id=review.funds_id and notice_id=n.id;
 state:=doctor_private.saas_account_state(n.subscriber_user_id);
 if funds.id is null or funds.received_minor<>q.amount_minor or funds.currency<>q.currency
  or not doctor_private.saas_offer_selected(q.terms_version_id,q.configuration_revision)
  or state->>'state'not in('unconfigured','expired')or(state->>'revision')::integer<>q.account_revision
  or(state#>>'{period,id}')::uuid is distinct from q.current_period_id then
  raise exception using errcode='DS010',message='DOCTOR_MANUAL_ACTIVATION_REVIEW_REQUIRED';end if;
 -- Bounds are computed exclusively by the server from the frozen interval.
 -- No client/admin supplied expiry, plan override or automatic renewal exists.
 moment:=clock_timestamp();
 begin ending:=((moment at time zone'UTC')+pg_catalog.make_interval(months=>case q.billing_interval when 'monthly'then 1 else 12 end))at time zone'UTC';
 exception when datetime_field_overflow or interval_field_overflow then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end;
 insert into public.doctor_manual_payment_reviews(notice_id,revision,action,actor_user_id,reason,funds_id,period_id,happened_at,activation_policy,activation_approval_ref,activation_configuration_revision)
 values(n.id,p_revision+1,'activated',actor,'Verified funds; configured inactive-account activation',funds.id,period,moment,c.activation_policy,c.activation_approval_ref,c.revision);
 insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 values(period,n.subscriber_user_id,q.terms_version_id,'manual_paid',moment,ending,q.accepted_document_ref);
 if(state->>'revision')::integer=0 then
  insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,revision,state,reason_code)values(n.subscriber_user_id,period,1,'enabled','period_transition');
  insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,previous_state,next_state,database_actor)
   values(n.subscriber_user_id,1,period,'period_transition',null,'enabled',session_user);
 else
  update public.doctor_saas_accounts set current_period_id=period,revision=revision+1,state='enabled',reason_code='period_transition'where subscriber_user_id=n.subscriber_user_id;
 end if;
 result:=doctor_private.manual_notice_projection(n)||jsonb_build_object('period_started_at',moment,'period_ends_at',ending,'data_mode','synthetic');
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
create function public.doctor_activate_manual_payment(p_notice uuid,p_revision integer,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.activate_manual_payment(p_notice,p_revision,p_key)$$;
revoke all on function doctor_private.manual_paid_period_valid(public.doctor_saas_periods),doctor_private.activate_manual_payment(uuid,integer,uuid),public.doctor_activate_manual_payment(uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.activate_manual_payment(uuid,integer,uuid),public.doctor_activate_manual_payment(uuid,integer,uuid)to authenticated;

-- Receipt evidence is optional and bounded to one immutable file per notice,
-- using the already validated 5 MiB PDF/PNG/JPEG private-file contract.
create table doctor_private.manual_evidence_intents(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null unique references public.doctor_manual_payment_notices(id),
 actor_user_id uuid not null references auth.users(id),command_key uuid not null,
 filename text not null,mime_type text not null check(mime_type in('application/pdf','image/png','image/jpeg')),
 byte_size bigint not null check(byte_size between 1 and 5242880),sha256 text not null check(sha256~'^[a-f0-9]{64}$'),
 object_path text not null unique,state text not null default'reserved'check(state in('reserved','committed')),
 created_at timestamptz not null default clock_timestamp(),unique(actor_user_id,command_key)
);
create table public.doctor_manual_payment_evidence(
 id uuid primary key references doctor_private.manual_evidence_intents(id),notice_id uuid not null unique references public.doctor_manual_payment_notices(id),
 uploaded_by uuid not null references auth.users(id),filename text not null,mime_type text not null,byte_size bigint not null,sha256 text not null,
 object_path text not null unique,created_at timestamptz not null default clock_timestamp()
);
create table public.doctor_manual_payment_evidence_events(
 id uuid primary key default gen_random_uuid(),notice_id uuid not null references public.doctor_manual_payment_notices(id),
 evidence_id uuid not null references public.doctor_manual_payment_evidence(id),actor_user_id uuid not null references auth.users(id),session_id uuid not null,
 action text not null check(action in('uploaded','download_requested')),happened_at timestamptz not null default clock_timestamp()
);
alter table doctor_private.manual_evidence_intents enable row level security;
alter table doctor_private.manual_evidence_intents force row level security;
create policy doctor_manual_evidence_intents_owner on doctor_private.manual_evidence_intents for all to postgres using(true)with check(true);
revoke all on doctor_private.manual_evidence_intents from public,anon,authenticated,service_role;
alter table public.doctor_manual_payment_evidence enable row level security;
alter table public.doctor_manual_payment_evidence force row level security;
alter table public.doctor_manual_payment_evidence_events enable row level security;
alter table public.doctor_manual_payment_evidence_events force row level security;
create policy doctor_manual_payment_evidence_owner on public.doctor_manual_payment_evidence for all to postgres using(true)with check(true);
create policy doctor_manual_payment_evidence_events_owner on public.doctor_manual_payment_evidence_events for all to postgres using(true)with check(true);
revoke all on public.doctor_manual_payment_evidence,public.doctor_manual_payment_evidence_events from public,anon,authenticated,service_role;
create trigger doctor_manual_payment_evidence_immutable before update or delete or truncate on public.doctor_manual_payment_evidence
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_manual_payment_evidence_events_immutable before update or delete or truncate on public.doctor_manual_payment_evidence_events
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.manual_evidence_access(p_notice uuid,p_write boolean)returns public.doctor_manual_payment_notices
language plpgsql volatile security definer set search_path=''as $$declare actor uuid:=doctor_private.current_actor();n public.doctor_manual_payment_notices;begin
 select * into n from public.doctor_manual_payment_notices where id=p_notice;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if actor<>n.subscriber_user_id then
  if p_write then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  perform doctor_private.require_manual_reviewer();
 elsif p_write then
  perform doctor_private.require_owner_enrollment();
  if exists(select 1 from public.doctor_manual_payment_reviews where notice_id=n.id and action in('rejected','funds_verified','activated'))then
   raise exception using errcode='42501',message='DOCTOR_MANUAL_EVIDENCE_CLOSED';end if;
 end if;
 return n;
end $$;
create function public.doctor_payment_evidence_access(p_notice uuid,p_write boolean)returns jsonb
language plpgsql volatile security invoker set search_path=''as $$begin
 perform doctor_private.manual_evidence_access(p_notice,p_write);
 return jsonb_build_object('notice_id',p_notice,'max_bytes',5242880,'max_files',1,'mime_types',jsonb_build_array('application/pdf','image/png','image/jpeg'));
end $$;
create function doctor_private.reserve_manual_evidence(p_actor uuid,p_session uuid,p_notice uuid,p_filename text,p_mime text,p_size bigint,p_sha text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare previous jsonb;item doctor_private.manual_evidence_intents;n public.doctor_manual_payment_notices;begin
 previous:=doctor_private.document_actor(p_actor,p_session);
 if p_notice is null or p_key is null or p_filename is null or char_length(p_filename)not between 1 and 160 or btrim(p_filename)<>p_filename or p_filename~'[[:cntrl:]]'or position('/'in p_filename)>0 or position(chr(92)in p_filename)>0 or p_mime is null or p_mime not in('application/pdf','image/png','image/jpeg')
  or(p_mime='application/pdf'and right(lower(p_filename),4)<>'.pdf')or(p_mime='image/png'and right(lower(p_filename),4)<>'.png')or(p_mime='image/jpeg'and right(lower(p_filename),4)<>'.jpg'and right(lower(p_filename),5)<>'.jpeg')
  or p_size is null or p_size not between 1 and 5242880 or p_sha is null or p_sha!~'^[a-f0-9]{64}$'then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_INVALID';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
 n:=doctor_private.manual_evidence_access(p_notice,true);perform doctor_private.saas_lock_subscriber(n.subscriber_user_id);
 perform doctor_private.current_actor();perform doctor_private.manual_evidence_access(p_notice,true);
 select * into item from doctor_private.manual_evidence_intents where notice_id=n.id;
 if found then
  if item.actor_user_id<>p_actor or item.filename<>p_filename or item.mime_type<>p_mime or item.byte_size<>p_size or item.sha256<>p_sha then
   raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
 else
  if exists(select 1 from doctor_private.command_receipts where actor_user_id=p_actor and command_key=p_key)then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  insert into doctor_private.manual_evidence_intents(notice_id,actor_user_id,command_key,filename,mime_type,byte_size,sha256,object_path)
  values(n.id,p_actor,p_key,p_filename,p_mime,p_size,p_sha,p_actor::text||'/'||n.id::text||'/'||gen_random_uuid()::text||case p_mime when'application/pdf'then'.pdf'when'image/png'then'.png'else'.jpg'end)returning * into item;
 end if;
 perform set_config('request.jwt.claims',previous::text,true);
 return to_jsonb(item);
end $$;
create function doctor_private.finalize_manual_evidence(p_actor uuid,p_session uuid,p_intent uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare previous jsonb;item doctor_private.manual_evidence_intents;n public.doctor_manual_payment_notices;result jsonb;begin
 previous:=doctor_private.document_actor(p_actor,p_session);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));
 select * into item from doctor_private.manual_evidence_intents where id=p_intent and actor_user_id=p_actor for update;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 n:=doctor_private.manual_evidence_access(item.notice_id,item.state<>'committed');perform doctor_private.saas_lock_subscriber(n.subscriber_user_id);
 perform doctor_private.current_actor();perform doctor_private.manual_evidence_access(item.notice_id,item.state<>'committed');
 if not exists(select 1 from storage.buckets where id='doctor-payment-evidence'and not public and file_size_limit=5242880)
  or not exists(select 1 from storage.objects where bucket_id='doctor-payment-evidence'and name=item.object_path
   and(metadata->>'size')::bigint=item.byte_size and metadata->>'mimetype'=item.mime_type)then raise exception using errcode='22023',message='DOCTOR_DOCUMENT_UNAVAILABLE';end if;
 if item.state<>'committed'then
  insert into public.doctor_manual_payment_evidence(id,notice_id,uploaded_by,filename,mime_type,byte_size,sha256,object_path)
   values(item.id,n.id,p_actor,item.filename,item.mime_type,item.byte_size,item.sha256,item.object_path);
  insert into public.doctor_manual_payment_evidence_events(notice_id,evidence_id,actor_user_id,session_id,action)values(n.id,item.id,p_actor,p_session,'uploaded');
  update doctor_private.manual_evidence_intents set state='committed'where id=item.id;
 end if;
 result:=jsonb_build_object('id',item.id,'notice_id',n.id,'filename',item.filename,'mime_type',item.mime_type,'byte_size',item.byte_size,'sha256',item.sha256);
 perform set_config('request.jwt.claims',previous::text,true);return result;
end $$;
create function doctor_private.deliver_manual_evidence(p_actor uuid,p_session uuid,p_notice uuid,p_evidence uuid,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare previous jsonb;item public.doctor_manual_payment_evidence;prior doctor_private.command_receipts;request jsonb;begin
 previous:=doctor_private.document_actor(p_actor,p_session);perform doctor_private.manual_evidence_access(p_notice,false);
 select * into item from public.doctor_manual_payment_evidence where id=p_evidence and notice_id=p_notice;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if p_key is not null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_actor::text,0));perform doctor_private.current_actor();perform doctor_private.manual_evidence_access(p_notice,false);
  request:=jsonb_build_object('command','manual.evidence.download','notice',p_notice,'evidence',p_evidence);
  select * into prior from doctor_private.command_receipts where actor_user_id=p_actor and command_key=p_key;
  if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  else
   insert into public.doctor_manual_payment_evidence_events(notice_id,evidence_id,actor_user_id,session_id,action)values(p_notice,p_evidence,p_actor,p_session,'download_requested');
   insert into doctor_private.command_receipts values(p_actor,p_key,request,jsonb_build_object('id',item.id));
  end if;
 end if;
 perform set_config('request.jwt.claims',previous::text,true);return to_jsonb(item);
end $$;
create function public.doctor_reserve_payment_evidence(p_actor uuid,p_session uuid,p_notice uuid,p_filename text,p_mime text,p_size bigint,p_sha text,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.reserve_manual_evidence(p_actor,p_session,p_notice,p_filename,p_mime,p_size,p_sha,p_key)$$;
create function public.doctor_finalize_payment_evidence(p_actor uuid,p_session uuid,p_intent uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.finalize_manual_evidence(p_actor,p_session,p_intent)$$;
create function public.doctor_deliver_payment_evidence(p_actor uuid,p_session uuid,p_notice uuid,p_evidence uuid,p_key uuid default null)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.deliver_manual_evidence(p_actor,p_session,p_notice,p_evidence,p_key)$$;
revoke all on function doctor_private.manual_evidence_access(uuid,boolean),public.doctor_payment_evidence_access(uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function doctor_private.manual_evidence_access(uuid,boolean),public.doctor_payment_evidence_access(uuid,boolean)to authenticated;
revoke all on function doctor_private.reserve_manual_evidence(uuid,uuid,uuid,text,text,bigint,text,uuid),doctor_private.finalize_manual_evidence(uuid,uuid,uuid),doctor_private.deliver_manual_evidence(uuid,uuid,uuid,uuid,uuid),public.doctor_reserve_payment_evidence(uuid,uuid,uuid,text,text,bigint,text,uuid),public.doctor_finalize_payment_evidence(uuid,uuid,uuid),public.doctor_deliver_payment_evidence(uuid,uuid,uuid,uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.reserve_manual_evidence(uuid,uuid,uuid,text,text,bigint,text,uuid),doctor_private.finalize_manual_evidence(uuid,uuid,uuid),doctor_private.deliver_manual_evidence(uuid,uuid,uuid,uuid,uuid),public.doctor_reserve_payment_evidence(uuid,uuid,uuid,text,text,bigint,text,uuid),public.doctor_finalize_payment_evidence(uuid,uuid,uuid),public.doctor_deliver_payment_evidence(uuid,uuid,uuid,uuid,uuid)to service_role;

create or replace function doctor_private.manual_notice_projection(n public.doctor_manual_payment_notices)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare q public.doctor_saas_quotes;r public.doctor_manual_payment_recipients;review public.doctor_manual_payment_reviews;begin
 select q0.* into q from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q0 on q0.id=i.quote_id where i.id=n.intent_id;
 select * into r from public.doctor_manual_payment_recipients where id=n.recipient_id;
 select * into review from public.doctor_manual_payment_reviews where notice_id=n.id order by revision desc limit 1;
 return jsonb_build_object('id',n.id,'subscriber_user_id',n.subscriber_user_id,'intent_id',n.intent_id,'quote_id',q.id,
 'terms_id',q.terms_version_id,'billing_interval',q.billing_interval,'amount_minor',q.amount_minor::text,'currency',q.currency,'currency_exponent',q.currency_exponent,
 'recipient_id',r.id,'beneficiary_name',r.beneficiary_name,'recipient_address',r.address,'recipient_kind',r.address_kind,'transfer_reference',n.transfer_reference,'transferred_at',n.transferred_at,'created_at',n.created_at,
 'status',coalesce(review.action,'submitted'),'revision',coalesce(review.revision,0),'review_reason',review.reason,
 'period_id',review.period_id,'history',coalesce((select jsonb_agg(jsonb_build_object('revision',h.revision,'action',h.action,'actor',h.actor_user_id,'reason',h.reason,'at',h.happened_at)order by h.revision)from public.doctor_manual_payment_reviews h where h.notice_id=n.id),'[]'::jsonb),'evidence',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'filename',e.filename,'mime_type',e.mime_type,'byte_size',e.byte_size,'sha256',e.sha256))from public.doctor_manual_payment_evidence e where e.notice_id=n.id),'[]'::jsonb),'requires_attention',n.requires_attention,'independent_verification_required',true,'automatic_verification',false,'live_acceptance_enabled',false);
end $$;

create or replace function doctor_private.manual_payments(p_notice uuid,p_review_queue boolean,p_page integer)returns jsonb
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
  'activation_configured',p_review_queue and coalesce((select enabled and acceptance_mode='synthetic'and activation_policy='inactive_account_on_review'and activation_approval_ref is not null from public.doctor_manual_payment_configuration where singleton),false),'items',coalesce((select jsonb_agg(doctor_private.manual_notice_projection(p::public.doctor_manual_payment_notices)order by p.created_at desc,p.id)from page p),'[]'::jsonb))into result;
 return result;
end $$;
create function doctor_private.manual_review_capability()returns jsonb language plpgsql volatile security definer set search_path=''as $$declare actor uuid:=doctor_private.current_actor();begin
 return jsonb_build_object('actor_user_id',actor,'can_review',exists(select 1 from public.doctor_manual_payment_reviewers where user_id=actor and enabled and valid_until>clock_timestamp()));
end $$;
create function public.doctor_manual_review_capability()returns jsonb language sql volatile security invoker set search_path=''as $$select doctor_private.manual_review_capability()$$;
revoke all on function doctor_private.manual_review_capability(),public.doctor_manual_review_capability()from public,anon,authenticated,service_role;
grant execute on function doctor_private.manual_review_capability(),public.doctor_manual_review_capability()to authenticated;

create or replace function doctor_private.saas_entitlement_context(p_practice uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare subscriber uuid;state jsonb;usage jsonb;staff jsonb;clinics jsonb;selected text;moment timestamptz;ending timestamptz;
 active boolean;over_limit boolean:=false;writable boolean:=false;staff_room boolean:=false;clinic_room boolean:=false;policy text;
begin
 select owner_user_id into subscriber from public.practices where id=p_practice;
 if subscriber is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if doctor_private.edition_mode()='synthetic_preview'then
  return jsonb_build_object('state','preview','revision',0,'writes_allowed',true,'can_add_staff',true,'can_add_clinic',true,'over_limit',false,'valid_until',null,'observed_at',clock_timestamp());end if;
 state:=doctor_private.saas_account_state(subscriber);selected:=state->>'state';ending:=(state#>>'{period,ends_at}')::timestamptz;moment:=clock_timestamp();
 -- Derive clock state and observation from the same instant, even at expiry.
 if selected in('trial','scheduled','expired')then
  selected:=case when moment<(state#>>'{period,started_at}')::timestamptz then'scheduled'when moment>=ending then'expired'when state#>>'{period,kind}'='manual_paid'then'paid'else'trial'end;
 end if;
 active:=selected in('trial','paid');
 if selected<>'unconfigured'then
  usage:=doctor_private.saas_usage(p_practice);staff:=state->'terms'->'staff';clinics:=state->'terms'->'clinics';policy:=state#>>'{terms,over_limit_policy}';
  if(staff->>'kind')not in('limited','unlimited')or(staff->>'kind')is null or(clinics->>'kind')not in('limited','unlimited')or(clinics->>'kind')is null
   or policy not in('block_new_allocation','read_only_until_within_limit')or policy is null then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
  over_limit:=(staff->>'kind'='limited'and(usage->>'staff_total')::bigint>(staff->>'limit')::bigint)
   or(clinics->>'kind'='limited'and(usage->>'clinics')::bigint>(clinics->>'limit')::bigint);
  writable:=active and(not over_limit or policy='block_new_allocation');
  staff_room:=active and not over_limit and(staff->>'kind'='unlimited'or(usage->>'staff_total')::bigint<(staff->>'limit')::bigint);
  clinic_room:=active and not over_limit and(clinics->>'kind'='unlimited'or(usage->>'clinics')::bigint<(clinics->>'limit')::bigint);
 end if;
 return jsonb_build_object('state',selected,'revision',(state->>'revision')::integer,'writes_allowed',writable,'can_add_staff',staff_room,'can_add_clinic',clinic_room,
  'over_limit',over_limit,'valid_until',ending,'observed_at',moment);
end $$;

create or replace function doctor_private.saas_status()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();practice uuid;state jsonb;moment timestamptz;kind text;writable boolean:=false;
begin
 if not exists(select 1 from public.doctor_saas_accounts where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 select id into practice from public.practices where owner_user_id=actor;
 state:=doctor_private.saas_account_state(actor);moment:=clock_timestamp();kind:=state->>'state';
 if kind in('trial','paid','expired','scheduled')then
  kind:=case when moment<(state#>>'{period,started_at}')::timestamptz then'scheduled'when moment>=(state#>>'{period,ends_at}')::timestamptz then'expired'when state#>>'{period,kind}'='manual_paid'then'paid'else'trial'end;
 end if;
 if kind in('trial','paid')then
  if practice is not null then writable:=(doctor_private.saas_entitlement_context(practice)->>'writes_allowed')::boolean;
  else writable:=state#>>'{terms,clinics,kind}'='unlimited'or(state#>>'{terms,clinics,limit}')::integer>0;end if;
 end if;
 return state||jsonb_build_object('business_writes_allowed',writable,'state',kind,'period_active',kind in('trial','paid'),'observed_at',moment,'subscriber_user_id',actor,'practice_id',practice,'usage',doctor_private.saas_usage(practice),
  'data_mode','synthetic','paid_activation_available',false,'live_activation',false);
end $$;
