-- DOS-AE-004: synthetic quote and intent preparation only. No provider, URL,
-- tax calculation, charge, paid period, callback or merchant approval is enabled.
create table public.doctor_saas_quotes(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 subscriber_user_id uuid not null references auth.users(id),
 practice_id uuid references public.practices(id),
 terms_version_id uuid not null references public.doctor_saas_terms_versions(id),
 configuration_revision integer not null check(configuration_revision>0),
 account_revision integer not null check(account_revision>=0),
 account_state text not null check(account_state in('unconfigured','trial','scheduled','expired','suspended')),
 current_period_id uuid,
 billing_interval text not null check(billing_interval in('monthly','yearly')),
 currency text not null check(currency~'^[A-Z]{3}$'),
 currency_exponent integer not null check(currency_exponent between 0 and 4),
 amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),
 accepted_document_ref text not null,
 created_at timestamptz not null default clock_timestamp(),
 unique(subscriber_user_id,id),
 foreign key(subscriber_user_id,current_period_id)references public.doctor_saas_periods(subscriber_user_id,id),
 check((account_revision=0 and current_period_id is null and account_state='unconfigured')or(account_revision>0 and current_period_id is not null and account_state<>'unconfigured'))
);
create table public.doctor_saas_payment_intents(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 subscriber_user_id uuid not null references auth.users(id),
 quote_id uuid not null unique,
 state text not null default 'awaiting_route_approval' check(state='awaiting_route_approval'),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(subscriber_user_id,quote_id)references public.doctor_saas_quotes(subscriber_user_id,id)
);
alter table public.doctor_saas_quotes enable row level security;
alter table public.doctor_saas_quotes force row level security;
alter table public.doctor_saas_payment_intents enable row level security;
alter table public.doctor_saas_payment_intents force row level security;
create policy doctor_saas_quotes_database on public.doctor_saas_quotes for all to postgres using(true)with check(true);
create policy doctor_saas_intents_database on public.doctor_saas_payment_intents for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_quotes,public.doctor_saas_payment_intents from public,anon,authenticated,service_role;
create trigger doctor_saas_quotes_immutable before update or delete or truncate on public.doctor_saas_quotes
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_saas_intents_immutable before update or delete or truncate on public.doctor_saas_payment_intents
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.saas_quote_binding()returns trigger
language plpgsql security definer set search_path=''as $$
declare terms public.doctor_saas_terms_versions;price bigint;
begin
 select * into terms from public.doctor_saas_terms_versions where id=new.terms_version_id and status='approved';
 price:=case new.billing_interval when 'monthly'then terms.monthly_minor when 'yearly'then terms.yearly_minor end;
 if price is null or new.amount_minor is distinct from price or new.currency is distinct from terms.currency
  or new.currency_exponent is distinct from terms.currency_exponent or new.accepted_document_ref is distinct from terms.terms_document_ref
  or not exists(select 1 from public.doctor_saas_terms_documents d where d.terms_version_id=terms.id and d.document_ref=new.accepted_document_ref)
  or(new.practice_id is not null and not exists(select 1 from public.practices p where p.id=new.practice_id and p.owner_user_id=new.subscriber_user_id))then
  raise exception using errcode='22023',message='DOCTOR_SAAS_QUOTE_BINDING_INVALID';end if;
 return new;
end $$;
create trigger doctor_saas_quote_binding before insert on public.doctor_saas_quotes
 for each row execute function doctor_private.saas_quote_binding();

-- This closed interface has no configuration setter. Approval and separately
-- reviewed provider implementation are prerequisites for ever changing it.
create function doctor_private.saas_payment_route()returns jsonb
language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('state','unconfigured','merchant_eligibility','pending','route_approval','pending',
 'credentials_custody','pending','tax_document_applicability','pending','provider_acceptance','unrun',
 'checkout_url',null,'purchase_available',false,'paid_activation_available',false,'live_activation',false)
$$;
create function doctor_private.saas_quote_projection(p_quote public.doctor_saas_quotes)returns jsonb
language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('quote_id',p_quote.id,'subscriber_user_id',p_quote.subscriber_user_id,'practice_id',p_quote.practice_id,
 'terms_id',p_quote.terms_version_id,'configuration_revision',p_quote.configuration_revision,
 'account_revision',p_quote.account_revision,'account_state',p_quote.account_state,'current_period_id',p_quote.current_period_id,
 'billing_interval',p_quote.billing_interval,'currency',p_quote.currency,'currency_exponent',p_quote.currency_exponent,
 'amount_minor',p_quote.amount_minor::text,'document_ref',p_quote.accepted_document_ref,'created_at',p_quote.created_at,
 'kind','configured_saas_offer','data_mode','synthetic','payment_route',doctor_private.saas_payment_route())
$$;
create function doctor_private.create_saas_quote(p_terms uuid,p_configuration_revision integer,p_account_revision integer,p_interval text,p_document_ref text,p_key uuid)returns jsonb
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
 if not found or configuration.terms_version_id is null then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 if configuration.revision<>p_configuration_revision or configuration.terms_version_id<>p_terms then
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
create function doctor_private.saas_quote(p_quote uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();item public.doctor_saas_quotes;
begin
 select * into item from public.doctor_saas_quotes where id=p_quote and subscriber_user_id=actor;
 if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 return doctor_private.saas_quote_projection(item);
end $$;
create function doctor_private.prepare_saas_payment(p_quote uuid,p_key uuid)returns jsonb
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
 if configuration.revision is distinct from item.configuration_revision or configuration.terms_version_id is distinct from item.terms_version_id
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
create function public.doctor_create_saas_quote(p_terms uuid,p_configuration_revision integer,p_account_revision integer,p_interval text,p_document_ref text,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.create_saas_quote(p_terms,p_configuration_revision,p_account_revision,p_interval,p_document_ref,p_key)$$;
create function public.doctor_saas_quote(p_quote uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.saas_quote(p_quote)$$;
create function public.doctor_prepare_saas_payment(p_quote uuid,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.prepare_saas_payment(p_quote,p_key)$$;
revoke all on function doctor_private.saas_quote_binding(),doctor_private.saas_payment_route(),doctor_private.saas_quote_projection(public.doctor_saas_quotes),
 doctor_private.create_saas_quote(uuid,integer,integer,text,text,uuid),doctor_private.saas_quote(uuid),doctor_private.prepare_saas_payment(uuid,uuid),
 public.doctor_create_saas_quote(uuid,integer,integer,text,text,uuid),public.doctor_saas_quote(uuid),public.doctor_prepare_saas_payment(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.create_saas_quote(uuid,integer,integer,text,text,uuid),doctor_private.saas_quote(uuid),doctor_private.prepare_saas_payment(uuid,uuid),
 public.doctor_create_saas_quote(uuid,integer,integer,text,text,uuid),public.doctor_saas_quote(uuid),public.doctor_prepare_saas_payment(uuid,uuid)to authenticated;
