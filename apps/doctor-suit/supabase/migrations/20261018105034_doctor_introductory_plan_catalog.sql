-- Provisional introductory commercial proposal, 2026-10-18.
-- Publishing these prices does not approve trial, legal/tax, merchant or live use.
create table public.doctor_introductory_plans(
 plan_key text primary key,name_en text not null,name_ar text not null,
 monthly_minor bigint not null check(monthly_minor>0),yearly_minor bigint not null check(yearly_minor=monthly_minor*10),
 clinic_limit integer not null check(clinic_limit>0),total_named_users integer not null check(total_named_users>1),
 staff_limit_excluding_owner integer not null check(staff_limit_excluding_owner=total_named_users-1),
 decision_ref text not null default 'provisional-competitive-research-2026-10-18',
 created_at timestamptz not null default clock_timestamp()
);
insert into public.doctor_introductory_plans(plan_key,name_en,name_ar,monthly_minor,yearly_minor,clinic_limit,total_named_users,staff_limit_excluding_owner)values
 ('starter','Starter','البداية',19900,199000,1,5,4),
 ('clinic','Clinic','العيادة',39900,399000,3,10,9),
 ('group','Group','المجموعة',69900,699000,5,25,24);
create table public.doctor_manual_plan_bindings(
 plan_key text primary key references public.doctor_introductory_plans(plan_key),
 terms_version_id uuid references public.doctor_saas_terms_versions(id),
 price_approval_ref text check(length(btrim(price_approval_ref)) between 1 and 200),
 enabled boolean not null default false,revision integer not null default 1 check(revision>0),
 change_reason text not null check(length(btrim(change_reason)) between 1 and 200),changed_at timestamptz not null default clock_timestamp(),
 check(not enabled or(terms_version_id is not null and price_approval_ref is not null)),unique(terms_version_id)
);
insert into public.doctor_manual_plan_bindings(plan_key,change_reason)
 select plan_key,'Trial, lifecycle and qualified legal terms remain unconfigured'from public.doctor_introductory_plans;
alter table public.doctor_introductory_plans enable row level security;
alter table public.doctor_introductory_plans force row level security;
alter table public.doctor_manual_plan_bindings enable row level security;
alter table public.doctor_manual_plan_bindings force row level security;
create policy doctor_introductory_plans_owner on public.doctor_introductory_plans for all to postgres using(true)with check(true);
create policy doctor_manual_plan_bindings_owner on public.doctor_manual_plan_bindings for all to postgres using(true)with check(true);
revoke all on public.doctor_introductory_plans,public.doctor_manual_plan_bindings from public,anon,authenticated,service_role;
create trigger doctor_introductory_plans_immutable before update or delete or truncate on public.doctor_introductory_plans
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_manual_plan_bindings_no_truncate before truncate on public.doctor_manual_plan_bindings
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.manual_plan_binding_change()returns trigger
language plpgsql security definer set search_path=''as $$
declare terms public.doctor_saas_terms_versions;plan public.doctor_introductory_plans;begin
 if tg_op='DELETE'or(tg_op='UPDATE'and(new.plan_key is distinct from old.plan_key or new.revision<>old.revision+1))then
  raise exception using errcode='40001',message='DOCTOR_MANUAL_PLAN_CONFLICT';end if;
 if new.enabled then
  if new.price_approval_ref is null then raise exception using errcode='22023',message='DOCTOR_MANUAL_PRICE_DECISION_PENDING';end if;
  select * into terms from public.doctor_saas_terms_versions where id=new.terms_version_id and status='approved';
  select * into plan from public.doctor_introductory_plans where plan_key=new.plan_key;
  if terms.id is null or terms.plan_key<>plan.plan_key or terms.currency<>'EGP'or terms.currency_exponent<>2
   or terms.monthly_minor is distinct from plan.monthly_minor or terms.yearly_minor is distinct from plan.yearly_minor
   or terms.staff_unlimited or terms.clinic_unlimited or terms.staff_limit is distinct from plan.staff_limit_excluding_owner
   or terms.clinic_limit is distinct from plan.clinic_limit or terms.renewal_policy<>'manual'
  then raise exception using errcode='22023',message='DOCTOR_MANUAL_PLAN_TERMS_MISMATCH';end if;
 end if;
 new.changed_at:=clock_timestamp();
 -- Serialize catalog changes with quote preparation and retain the existing
 -- immutable global configuration-event history. No price changes in-browser.
 update public.doctor_saas_configuration set revision=revision+1,change_reason='Manual plan binding: '||new.plan_key||' / '||new.change_reason where singleton;
 return new;
end $$;
create trigger doctor_manual_plan_binding_change before insert or update or delete on public.doctor_manual_plan_bindings
 for each row execute function doctor_private.manual_plan_binding_change();
create or replace function doctor_private.saas_offer_selected(p_terms uuid,p_revision integer)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.doctor_saas_configuration c where c.revision=p_revision
  and(c.terms_version_id=p_terms or exists(select 1 from public.doctor_manual_plan_bindings b where b.terms_version_id=p_terms and b.enabled)))
$$;
create function doctor_private.saas_plan_catalog()returns jsonb
language sql stable security definer set search_path=''as $$
 select jsonb_build_object('version',1,'publication_state','provisional','currency','EGP','currency_exponent',2,'annual_calendar_months',12,'annual_monthly_payments',10,
  'self_service_setup_fee_minor','0','tax_status','not_determined','live_acceptance_enabled',false,'configuration_revision',c.revision,
  'plans',coalesce((select jsonb_agg(jsonb_build_object('key',p.plan_key,'name_en',p.name_en,'name_ar',p.name_ar,'monthly_minor',p.monthly_minor::text,
   'yearly_minor',p.yearly_minor::text,'clinic_limit',p.clinic_limit,'total_named_users',p.total_named_users,'staff_limit_excluding_owner',p.staff_limit_excluding_owner,
   'configured',b.enabled and t.status='approved','terms',case when b.enabled and t.status='approved'then doctor_private.saas_terms_projection(t)else null end)
   order by p.monthly_minor,p.plan_key)from public.doctor_introductory_plans p join public.doctor_manual_plan_bindings b using(plan_key)
   left join public.doctor_saas_terms_versions t on t.id=b.terms_version_id),'[]'::jsonb))from public.doctor_saas_configuration c where c.singleton
$$;
revoke all on function doctor_private.manual_plan_binding_change()from public,anon,authenticated,service_role;
create function public.doctor_saas_plan_catalog()returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.saas_plan_catalog()$$;
revoke all on function doctor_private.saas_plan_catalog(),public.doctor_saas_plan_catalog()from public,anon,authenticated,service_role;
grant execute on function doctor_private.saas_plan_catalog(),public.doctor_saas_plan_catalog()to authenticated;

create or replace function doctor_private.create_saas_quote(p_terms uuid,p_configuration_revision integer,p_account_revision integer,p_interval text,p_document_ref text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();configuration public.doctor_saas_configuration;terms public.doctor_saas_terms_versions;
 prior doctor_private.command_receipts;item public.doctor_saas_quotes;state jsonb;practice uuid;price bigint;result jsonb;
 request jsonb:=jsonb_build_object('command','saas.quote.create','terms',p_terms,'configuration_revision',p_configuration_revision,'account_revision',p_account_revision,'interval',p_interval,'document_ref',p_document_ref);
begin
 if p_key is null or p_terms is null or p_configuration_revision is null or p_configuration_revision<1 or p_account_revision is null or p_account_revision<0
  or p_interval is null or p_interval not in('monthly','yearly')or p_document_ref is null then
  raise exception using errcode='22023',message='DOCTOR_SAAS_QUOTE_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then
  raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 -- Same actor lock order as onboarding, then the subscription transaction lock.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 select * into configuration from public.doctor_saas_configuration where singleton for share;
 if not found or(configuration.terms_version_id is null and not exists(select 1 from public.doctor_manual_plan_bindings where enabled))then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 if not doctor_private.saas_offer_selected(p_terms,p_configuration_revision)then
  raise exception using errcode='40001',message='DOCTOR_SAAS_TERMS_CONFLICT';end if;
 -- Configuration waits can outlast a session/admission; recheck fresh authority.
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 state:=doctor_private.saas_account_state(actor);
 if(state->>'revision')::integer<>p_account_revision then raise exception using errcode='40001',message='DOCTOR_SAAS_ACCOUNT_CONFLICT';end if;
 select * into terms from public.doctor_saas_terms_versions where id=p_terms and status='approved';
 if not found or p_document_ref<>terms.terms_document_ref then raise exception using errcode='40001',message='DOCTOR_SAAS_TERMS_CONFLICT';end if;
 price:=case p_interval when 'monthly'then terms.monthly_minor else terms.yearly_minor end;
 if price is null then raise exception using errcode='22023',message='DOCTOR_SAAS_INTERVAL_UNAVAILABLE';end if;
 if not exists(select 1 from public.doctor_saas_terms_documents where terms_version_id=terms.id and document_ref=p_document_ref)then
  raise exception using errcode='42501',message='DOCTOR_SAAS_DOCUMENT_UNAVAILABLE';end if;
 select id into practice from public.practices where owner_user_id=actor;
 insert into public.doctor_saas_quotes(subscriber_user_id,practice_id,terms_version_id,configuration_revision,account_revision,account_state,current_period_id,billing_interval,currency,currency_exponent,amount_minor,accepted_document_ref)
 values(actor,practice,terms.id,configuration.revision,p_account_revision,state->>'state',(state#>>'{period,id}')::uuid,p_interval,terms.currency,terms.currency_exponent,price,p_document_ref)returning * into item;
 result:=doctor_private.saas_quote_projection(item);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;

create or replace function doctor_private.prepare_saas_payment(p_quote uuid,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();item public.doctor_saas_quotes;intent public.doctor_saas_payment_intents;
 configuration public.doctor_saas_configuration;prior doctor_private.command_receipts;state jsonb;practice uuid;result jsonb;
 request jsonb:=jsonb_build_object('command','saas.payment.prepare','quote',p_quote);
begin
 if p_quote is null or p_key is null then raise exception using errcode='22023',message='DOCTOR_SAAS_INTENT_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then
  raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text,0));
 perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 select * into item from public.doctor_saas_quotes where id=p_quote and subscriber_user_id=actor;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 select * into configuration from public.doctor_saas_configuration where singleton for share;
 perform doctor_private.current_actor();perform doctor_private.require_owner_enrollment();
 state:=doctor_private.saas_account_state(actor);
 select id into practice from public.practices where owner_user_id=actor;
 if not doctor_private.saas_offer_selected(item.terms_version_id,item.configuration_revision)
  or(state->>'revision')::integer is distinct from item.account_revision or state->>'state'is distinct from item.account_state
  or(state#>>'{period,id}')::uuid is distinct from item.current_period_id or practice is distinct from item.practice_id then
  raise exception using errcode='40001',message='DOCTOR_SAAS_QUOTE_STALE';end if;
 insert into public.doctor_saas_payment_intents(subscriber_user_id,quote_id)values(actor,item.id)
 on conflict(quote_id)do nothing;
 select * into intent from public.doctor_saas_payment_intents where quote_id=item.id and subscriber_user_id=actor;
 result:=jsonb_build_object('intent_id',intent.id,'quote',doctor_private.saas_quote_projection(item),'state',intent.state,
 'created_at',intent.created_at,'payment_route',doctor_private.saas_payment_route());
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;
