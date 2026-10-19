-- DOS-AE-003: explicit one-time synthetic trial periods, before clinic setup.
-- Paid periods/activation remain unavailable until verified settlement work.
create table public.doctor_saas_periods(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 subscriber_user_id uuid not null references auth.users(id),
 terms_version_id uuid not null references public.doctor_saas_terms_versions(id),
 kind text not null check(kind='trial'),
 started_at timestamptz not null,ends_at timestamptz not null check(ends_at>started_at and pg_catalog.isfinite(started_at)and pg_catalog.isfinite(ends_at)),
 accepted_document_ref text not null check(accepted_document_ref~'^[a-z0-9][a-z0-9._/-]{0,199}$'),
 created_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user,
 unique(subscriber_user_id,id)
);
create unique index doctor_saas_trial_once on public.doctor_saas_periods(subscriber_user_id)where kind='trial';
create table public.doctor_saas_accounts(
 subscriber_user_id uuid primary key references auth.users(id),current_period_id uuid not null,
 revision integer not null default 1 check(revision>0),state text not null default'enabled'check(state in('enabled','suspended')),
 reason_code text not null check(reason_code in('trial_started','operator_hold','operator_resume','period_transition')),
 created_at timestamptz not null default clock_timestamp(),changed_at timestamptz not null default clock_timestamp(),
 foreign key(subscriber_user_id,current_period_id)references public.doctor_saas_periods(subscriber_user_id,id)
);
create table public.doctor_saas_period_events(
 subscriber_user_id uuid not null references auth.users(id),revision integer not null check(revision>0),period_id uuid not null,
 reason_code text not null check(reason_code in('trial_started','operator_hold','operator_resume','period_transition')),
 previous_state text,next_state text not null check(next_state in('enabled','suspended')),
 happened_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user,
 primary key(subscriber_user_id,revision),foreign key(subscriber_user_id,period_id)references public.doctor_saas_periods(subscriber_user_id,id)
);
alter table public.doctor_saas_periods enable row level security;
alter table public.doctor_saas_periods force row level security;
alter table public.doctor_saas_accounts enable row level security;
alter table public.doctor_saas_accounts force row level security;
alter table public.doctor_saas_period_events enable row level security;
alter table public.doctor_saas_period_events force row level security;
create policy doctor_saas_periods_owner on public.doctor_saas_periods for all to postgres using(true)with check(true);
create policy doctor_saas_accounts_owner on public.doctor_saas_accounts for all to postgres using(true)with check(true);
create policy doctor_saas_period_events_owner on public.doctor_saas_period_events for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_periods,public.doctor_saas_accounts,public.doctor_saas_period_events from public,anon,authenticated,service_role;
create function doctor_private.saas_history_immutable()returns trigger
language plpgsql security invoker set search_path=''as $$
begin raise exception using errcode='42501',message='DOCTOR_SAAS_HISTORY_IMMUTABLE';end $$;
create trigger doctor_saas_periods_immutable before update or delete or truncate on public.doctor_saas_periods
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_saas_period_events_immutable before update or delete or truncate on public.doctor_saas_period_events
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_saas_accounts_no_truncate before truncate on public.doctor_saas_accounts
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.saas_account_change()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if tg_op='DELETE'or new.subscriber_user_id is distinct from old.subscriber_user_id or new.created_at is distinct from old.created_at then
  raise exception using errcode='42501',message='DOCTOR_SAAS_HISTORY_IMMUTABLE';end if;
 perform doctor_private.saas_lock_subscriber(old.subscriber_user_id);
 if new.revision<>old.revision+1 then raise exception using errcode='40001',message='DOCTOR_SAAS_ACCOUNT_CONFLICT';end if;
 if new.current_period_id is distinct from old.current_period_id then
  if new.reason_code<>'period_transition'then raise exception using errcode='22023',message='DOCTOR_SAAS_CHANGE_REASON_REQUIRED';end if;
 elsif new.state is distinct from old.state then
  if new.reason_code<>(case when new.state='suspended'then'operator_hold'else'operator_resume'end)then
   raise exception using errcode='22023',message='DOCTOR_SAAS_CHANGE_REASON_REQUIRED';end if;
 else raise exception using errcode='22023',message='DOCTOR_SAAS_CHANGE_REQUIRED';end if;
 new.changed_at:=clock_timestamp();
 insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,previous_state,next_state,database_actor)
 values(new.subscriber_user_id,new.revision,new.current_period_id,new.reason_code,old.state,new.state,session_user);
 return new;
end $$;
create trigger doctor_saas_account_change before update or delete on public.doctor_saas_accounts
 for each row execute function doctor_private.saas_account_change();
create function doctor_private.saas_lock_subscriber(p_subscriber uuid)returns void
language plpgsql volatile security invoker set search_path=''as $$
begin
 if p_subscriber is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('doctor-saas:'||p_subscriber::text,6));
end $$;

-- One whitelist is shared by current offers and immutable subscribed snapshots.
create function doctor_private.saas_terms_projection(p_terms public.doctor_saas_terms_versions)returns jsonb
language plpgsql immutable security invoker set search_path=''as $$
begin
  return jsonb_build_object('terms_id',p_terms.id,'plan_key',p_terms.plan_key,'version',p_terms.version,
   'currency',p_terms.currency,'currency_exponent',p_terms.currency_exponent,'monthly_minor',p_terms.monthly_minor,'yearly_minor',p_terms.yearly_minor,
   'trial_days',p_terms.trial_days,'grace_days',p_terms.grace_days,
   'staff',case when p_terms.staff_unlimited then jsonb_build_object('kind','unlimited')else jsonb_build_object('kind','limited','limit',p_terms.staff_limit)end,
   'clinics',case when p_terms.clinic_unlimited then jsonb_build_object('kind','unlimited')else jsonb_build_object('kind','limited','limit',p_terms.clinic_limit)end,
   'over_limit_policy',p_terms.over_limit_policy,'renewal_policy',p_terms.renewal_policy,'expiry_policy',p_terms.expiry_policy,'cancellation_policy',p_terms.cancellation_policy,'refund_policy',p_terms.refund_policy,
   'terms_document_ref',p_terms.terms_document_ref);
end $$;

create or replace function doctor_private.saas_terms()returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();practice uuid;configuration public.doctor_saas_configuration;terms public.doctor_saas_terms_versions;offer jsonb:=null;
begin
 perform doctor_private.require_owner_enrollment();
 select id into practice from public.practices where owner_user_id=actor;
 select * into configuration from public.doctor_saas_configuration where singleton;
 if not found then raise exception using errcode='42501',message='DOCTOR_SAAS_CONFIGURATION_UNAVAILABLE';end if;
 if configuration.terms_version_id is not null then
  select * into terms from public.doctor_saas_terms_versions where id=configuration.terms_version_id and status='approved';
  if not found then raise exception using errcode='42501',message='DOCTOR_SAAS_CONFIGURATION_UNAVAILABLE';end if;
  offer:=doctor_private.saas_terms_projection(terms);
 end if;
 return jsonb_build_object('subscriber_user_id',actor,'practice_id',practice,'configuration_revision',configuration.revision,
  'configured',offer is not null,'terms',offer,'data_mode','synthetic','payment_route','unconfigured','purchase_available',false,'live_activation',false);
end $$;
create function doctor_private.saas_period_validate()returns trigger
language plpgsql security definer set search_path=''as $$
declare terms public.doctor_saas_terms_versions;expected_end timestamptz;
begin
 if new.kind<>'trial'or not pg_catalog.isfinite(new.started_at)or not pg_catalog.isfinite(new.ends_at)
  or new.started_at<'0001-01-01 00:00:00+00'::timestamptz or new.ends_at>'9999-12-31 23:59:59.999999+00'::timestamptz then
  raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 select * into terms from public.doctor_saas_terms_versions where id=new.terms_version_id and status='approved';
 if not found or terms.trial_days<=0 or new.accepted_document_ref<>terms.terms_document_ref then
  raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 begin expected_end:=((new.started_at at time zone'UTC')+pg_catalog.make_interval(days=>terms.trial_days))at time zone'UTC';
 exception when datetime_field_overflow or interval_field_overflow then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end;
 if new.ends_at is distinct from expected_end then raise exception using errcode='22023',message='DOCTOR_SAAS_PERIOD_INVALID';end if;
 return new;
end $$;
create trigger doctor_saas_period_validate before insert on public.doctor_saas_periods
 for each row execute function doctor_private.saas_period_validate();

create function doctor_private.saas_account_state(p_subscriber uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare account public.doctor_saas_accounts;period public.doctor_saas_periods;terms public.doctor_saas_terms_versions;moment timestamptz;selected text;
begin
 select * into account from public.doctor_saas_accounts where subscriber_user_id=p_subscriber;
 if not found then return jsonb_build_object('state','unconfigured','revision',0,'period_active',false,'period',null,'terms',null);end if;
 select * into period from public.doctor_saas_periods where id=account.current_period_id and subscriber_user_id=p_subscriber;
 select * into terms from public.doctor_saas_terms_versions where id=period.terms_version_id and status='approved';
 if period.id is null or terms.id is null or period.kind<>'trial'or terms.trial_days<=0 or period.accepted_document_ref<>terms.terms_document_ref then raise exception using errcode='42501',message='DOCTOR_SAAS_ACCOUNT_UNAVAILABLE';end if;
 moment:=clock_timestamp();
 selected:=case when account.state='suspended'then'suspended'when moment<period.started_at then'scheduled'when moment>=period.ends_at then'expired'else'trial'end;
 return jsonb_build_object('state',selected,'revision',account.revision,'period_active',selected='trial',
  'period',jsonb_build_object('id',period.id,'kind',period.kind,'terms_id',period.terms_version_id,'started_at',period.started_at,'ends_at',period.ends_at,'accepted_document_ref',period.accepted_document_ref),
  'terms',doctor_private.saas_terms_projection(terms));
end $$;
create function doctor_private.saas_status()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();practice uuid;
begin
 -- A previous subscriber keeps their own history if subsequently delegated.
 -- Reading status never creates an account or promotes a staff identity.
 if not exists(select 1 from public.doctor_saas_accounts where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 select id into practice from public.practices where owner_user_id=actor;
 return doctor_private.saas_account_state(actor)||jsonb_build_object('subscriber_user_id',actor,'practice_id',practice,'data_mode','synthetic','paid_activation_available',false,'live_activation',false);
end $$;
create function doctor_private.start_saas_trial(p_terms uuid,p_configuration_revision integer,p_document_ref text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();configuration public.doctor_saas_configuration;terms public.doctor_saas_terms_versions;prior doctor_private.command_receipts;
 period uuid;started timestamptz;ends timestamptz;result jsonb;request jsonb:=jsonb_build_object('command','saas.trial.start','terms',p_terms,'configuration_revision',p_configuration_revision,'document_ref',p_document_ref);
begin
 if p_key is null or p_terms is null or p_configuration_revision is null or p_configuration_revision<1 or p_document_ref is null then
  raise exception using errcode='22023',message='DOCTOR_SAAS_TRIAL_INVALID';end if;
 perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.require_owner_enrollment();
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 if exists(select 1 from public.doctor_saas_periods where subscriber_user_id=actor)then
  raise exception using errcode='DS004',message='DOCTOR_SAAS_TRIAL_ALREADY_USED';end if;
 select * into configuration from public.doctor_saas_configuration where singleton for share;
 if not found or configuration.terms_version_id is null then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 if configuration.revision<>p_configuration_revision or configuration.terms_version_id<>p_terms then
  raise exception using errcode='40001',message='DOCTOR_SAAS_TERMS_CONFLICT';end if;
 select * into terms from public.doctor_saas_terms_versions where id=p_terms and status='approved';
 if not found then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 if p_document_ref<>terms.terms_document_ref then raise exception using errcode='22023',message='DOCTOR_SAAS_TERMS_ACCEPTANCE_REQUIRED';end if;
 if terms.trial_days=0 then raise exception using errcode='DS005',message='DOCTOR_SAAS_TRIAL_UNAVAILABLE';end if;
 started:=clock_timestamp();
 -- A trial day is an exact UTC day, independent of the connection's DST zone.
 begin ends:=((started at time zone'UTC')+pg_catalog.make_interval(days=>terms.trial_days))at time zone'UTC';
 exception when datetime_field_overflow or interval_field_overflow then raise exception using errcode='22023',message='DOCTOR_SAAS_POLICY_INVALID';end;
 insert into public.doctor_saas_periods(subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 values(actor,terms.id,'trial',started,ends,terms.terms_document_ref)returning id into period;
 insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,revision,state,reason_code)values(actor,period,1,'enabled','trial_started');
 insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values(actor,1,period,'trial_started','enabled');
 result:=jsonb_build_object('period_id',period,'terms_id',terms.id,'started_at',started,'ends_at',ends,'revision',1);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;
create function public.doctor_saas_status()returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.saas_status()$$;
create function public.doctor_start_saas_trial(p_terms uuid,p_configuration_revision integer,p_document_ref text,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.start_saas_trial(p_terms,p_configuration_revision,p_document_ref,p_key)$$;
revoke all on function doctor_private.saas_history_immutable(),doctor_private.saas_period_validate(),doctor_private.saas_account_change(),doctor_private.saas_lock_subscriber(uuid),doctor_private.saas_terms_projection(public.doctor_saas_terms_versions),doctor_private.saas_account_state(uuid),doctor_private.saas_status(),doctor_private.start_saas_trial(uuid,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.saas_status(),doctor_private.start_saas_trial(uuid,integer,text,uuid)to authenticated;
revoke all on function public.doctor_saas_status(),public.doctor_start_saas_trial(uuid,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_saas_status(),public.doctor_start_saas_trial(uuid,integer,text,uuid)to authenticated;
