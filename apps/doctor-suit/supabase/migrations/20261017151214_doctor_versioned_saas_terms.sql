-- DOS-AE-003 terms foundation only. No approved offer or subscription is seeded.
create table public.doctor_saas_terms_versions(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 plan_key text not null check(plan_key~'^[a-z][a-z0-9_-]{2,63}$'),
 version integer not null check(version>0),
 status text not null check(status in('draft','approved')),
 currency text check(currency~'^[A-Z]{3}$'),
 currency_exponent integer check(currency_exponent between 0 and 4),
 monthly_minor bigint check(monthly_minor between 0 and 9007199254740991),
 yearly_minor bigint check(yearly_minor between 0 and 9007199254740991),
 trial_days integer check(trial_days>=0),
 staff_limit integer check(staff_limit>=0),staff_unlimited boolean,
 clinic_limit integer check(clinic_limit>=0),clinic_unlimited boolean,
 over_limit_policy text check(over_limit_policy in('block_new_allocation','read_only_until_within_limit')),
 renewal_policy text check(renewal_policy in('manual','automatic_opt_in')),
 grace_days integer check(grace_days>=0),
 expiry_policy text check(expiry_policy='historical_read_only'),
 cancellation_policy text check(cancellation_policy in('period_end','immediate_read_only')),
 refund_policy text check(refund_policy in('manual_review','none_where_permitted')),
 terms_document_ref text check(terms_document_ref~'^[a-z0-9][a-z0-9._/-]{0,199}$'),
 commercial_approval_ref text check(length(btrim(commercial_approval_ref))between 1 and 200),
 legal_approval_ref text check(length(btrim(legal_approval_ref))between 1 and 200),
 created_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user,
 unique(plan_key,version),
 check(staff_unlimited is not true or staff_limit is null),
 check(clinic_unlimited is not true or clinic_limit is null),
 check(status='draft'or(
  currency is not null and currency_exponent is not null and(monthly_minor is not null or yearly_minor is not null)
  and trial_days is not null and grace_days is not null
  and staff_unlimited is not null and(staff_unlimited or staff_limit is not null)
  and clinic_unlimited is not null and(clinic_unlimited or clinic_limit is not null)
  and over_limit_policy is not null and renewal_policy is not null and expiry_policy is not null and cancellation_policy is not null and refund_policy is not null
  and terms_document_ref is not null and commercial_approval_ref is not null and legal_approval_ref is not null
 )is true)
);
create table public.doctor_saas_configuration(
 singleton boolean primary key default true check(singleton),
 revision integer not null check(revision>0),
 terms_version_id uuid references public.doctor_saas_terms_versions(id),
 change_reason text not null check(length(btrim(change_reason))between 1 and 200),
 changed_at timestamptz not null default clock_timestamp()
);
create table public.doctor_saas_configuration_events(
 revision integer primary key,previous_terms_id uuid references public.doctor_saas_terms_versions(id),
 next_terms_id uuid references public.doctor_saas_terms_versions(id),
 change_reason text not null,database_actor text not null,happened_at timestamptz not null default clock_timestamp()
);
insert into public.doctor_saas_configuration(singleton,revision,terms_version_id,change_reason)
 values(true,1,null,'Doctor-specific commercial and legal terms remain unconfigured');
insert into public.doctor_saas_configuration_events(revision,next_terms_id,change_reason,database_actor)
 select revision,terms_version_id,change_reason,session_user from public.doctor_saas_configuration;
alter table public.doctor_saas_terms_versions enable row level security;
alter table public.doctor_saas_terms_versions force row level security;
alter table public.doctor_saas_configuration enable row level security;
alter table public.doctor_saas_configuration force row level security;
alter table public.doctor_saas_configuration_events enable row level security;
alter table public.doctor_saas_configuration_events force row level security;
create policy doctor_saas_terms_owner on public.doctor_saas_terms_versions for all to postgres using(true)with check(true);
create policy doctor_saas_configuration_owner on public.doctor_saas_configuration for all to postgres using(true)with check(true);
create policy doctor_saas_configuration_events_owner on public.doctor_saas_configuration_events for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_terms_versions,public.doctor_saas_configuration,public.doctor_saas_configuration_events from public,anon,authenticated,service_role;
create function doctor_private.saas_terms_immutable()returns trigger
language plpgsql security invoker set search_path=''as $$
begin raise exception using errcode='42501',message='DOCTOR_SAAS_TERMS_IMMUTABLE';end $$;
create trigger doctor_saas_terms_immutable before update or delete or truncate on public.doctor_saas_terms_versions
 for each statement execute function doctor_private.saas_terms_immutable();
create trigger doctor_saas_configuration_events_immutable before update or delete or truncate on public.doctor_saas_configuration_events
 for each statement execute function doctor_private.saas_terms_immutable();
create trigger doctor_saas_configuration_no_truncate before truncate on public.doctor_saas_configuration
 for each statement execute function doctor_private.saas_terms_immutable();
create function doctor_private.saas_configuration_change()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if tg_op='DELETE'then raise exception using errcode='42501',message='DOCTOR_SAAS_CONFIGURATION_REQUIRED';end if;
 if new.singleton is distinct from old.singleton or new.revision<>old.revision+1 then
  raise exception using errcode='40001',message='DOCTOR_SAAS_CONFIGURATION_CONFLICT';end if;
 if new.terms_version_id is not null and not exists(select 1 from public.doctor_saas_terms_versions t where t.id=new.terms_version_id and t.status='approved')then
  raise exception using errcode='22023',message='DOCTOR_SAAS_APPROVED_TERMS_REQUIRED';end if;
 new.changed_at:=clock_timestamp();
 insert into public.doctor_saas_configuration_events(revision,previous_terms_id,next_terms_id,change_reason,database_actor)
 values(new.revision,old.terms_version_id,new.terms_version_id,new.change_reason,session_user);
 return new;
end $$;
create trigger doctor_saas_configuration_change before update or delete on public.doctor_saas_configuration
 for each row execute function doctor_private.saas_configuration_change();
create function doctor_private.saas_terms()returns jsonb
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
  offer:=jsonb_build_object('terms_id',terms.id,'plan_key',terms.plan_key,'version',terms.version,
   'currency',terms.currency,'currency_exponent',terms.currency_exponent,'monthly_minor',terms.monthly_minor,'yearly_minor',terms.yearly_minor,
   'trial_days',terms.trial_days,'grace_days',terms.grace_days,
   'staff',case when terms.staff_unlimited then jsonb_build_object('kind','unlimited')else jsonb_build_object('kind','limited','limit',terms.staff_limit)end,
   'clinics',case when terms.clinic_unlimited then jsonb_build_object('kind','unlimited')else jsonb_build_object('kind','limited','limit',terms.clinic_limit)end,
   'over_limit_policy',terms.over_limit_policy,'renewal_policy',terms.renewal_policy,'expiry_policy',terms.expiry_policy,'cancellation_policy',terms.cancellation_policy,'refund_policy',terms.refund_policy,
   'terms_document_ref',terms.terms_document_ref);
 end if;
 return jsonb_build_object('subscriber_user_id',actor,'practice_id',practice,'configuration_revision',configuration.revision,
  'configured',offer is not null,'terms',offer,'data_mode','synthetic','payment_route','unconfigured','purchase_available',false,'live_activation',false);
end $$;
create function public.doctor_saas_terms()returns jsonb
language sql stable security invoker set search_path=''as $$select doctor_private.saas_terms()$$;
revoke all on function doctor_private.saas_terms_immutable(),doctor_private.saas_configuration_change(),doctor_private.saas_terms()from public,anon,authenticated,service_role;
grant execute on function doctor_private.saas_terms()to authenticated;
revoke all on function public.doctor_saas_terms()from public,anon,authenticated,service_role;
grant execute on function public.doctor_saas_terms()to authenticated;
