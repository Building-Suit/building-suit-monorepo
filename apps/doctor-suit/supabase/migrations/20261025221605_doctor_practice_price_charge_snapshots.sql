-- Administrative synthetic billing records, separate from SaaS/clinical signing/live collection/tax authority.
create table public.doctor_service_price_versions(
 id uuid primary key default gen_random_uuid(),service_id uuid not null,revision integer not null check(revision>0),
 practice_id uuid not null,location_id uuid not null,doctor_user_id uuid not null,
 label text not null check(length(btrim(label))between 1 and 160 and label!~'[[:cntrl:]<>]'),
 unit_minor bigint not null check(unit_minor between 0 and 9007199254740991),
 currency text not null check(currency~'^[A-Z]{3}$'),currency_exponent integer not null check(currency_exponent between 0 and 4),
 effective_at timestamptz not null default clock_timestamp(),actor_user_id uuid not null references auth.users(id),
 unique(service_id,revision),unique(practice_id,location_id,id),
 foreign key(practice_id,doctor_user_id)references public.practices(id,owner_user_id),
 foreign key(practice_id,location_id)references public.locations(practice_id,id)
);
create table public.doctor_visit_charge_versions(
 id uuid primary key default gen_random_uuid(),charge_id uuid not null,revision integer not null check(revision>0),
 previous_id uuid references public.doctor_visit_charge_versions(id),
 practice_id uuid not null,location_id uuid not null,doctor_user_id uuid not null,visit_id uuid not null,patient_id uuid not null,
 price_id uuid not null,service_id uuid not null,label text not null,
 unit_minor bigint not null check(unit_minor between 0 and 9007199254740991),
 quantity integer not null check(quantity between 1 and 1000),amount_minor bigint not null check(amount_minor between 0 and 9007199254740991),
 currency text not null check(currency~'^[A-Z]{3}$'),currency_exponent integer not null check(currency_exponent between 0 and 4),
 reason text not null check(length(btrim(reason))between 2 and 500 and reason!~'[[:cntrl:]<>]'),
 created_at timestamptz not null default clock_timestamp(),actor_user_id uuid not null references auth.users(id),
 unique(charge_id,revision),check(amount_minor=unit_minor*quantity),check((revision=1)=(previous_id is null)),
 foreign key(practice_id,doctor_user_id)references public.practices(id,owner_user_id),
 foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,visit_id)references public.appointments(practice_id,id),
 foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),
 foreign key(practice_id,location_id,price_id)references public.doctor_service_price_versions(practice_id,location_id,id)
);
alter table public.doctor_service_price_versions enable row level security;
alter table public.doctor_service_price_versions force row level security;
alter table public.doctor_visit_charge_versions enable row level security;
alter table public.doctor_visit_charge_versions force row level security;
create policy doctor_service_price_versions_owner on public.doctor_service_price_versions for all to postgres using(true)with check(true);
create policy doctor_visit_charge_versions_owner on public.doctor_visit_charge_versions for all to postgres using(true)with check(true);
revoke all on public.doctor_service_price_versions,public.doctor_visit_charge_versions from public,anon,authenticated,service_role;
create trigger doctor_service_prices_immutable before update or delete on public.doctor_service_price_versions for each row execute function doctor_private.saas_history_immutable();
create trigger doctor_service_prices_no_truncate before truncate on public.doctor_service_price_versions for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_visit_charges_immutable before update or delete on public.doctor_visit_charge_versions for each row execute function doctor_private.saas_history_immutable();
create trigger doctor_visit_charges_no_truncate before truncate on public.doctor_visit_charge_versions for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.practice_billing_owner(p_practice uuid,p_location uuid,p_write boolean)returns uuid
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();place public.locations;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 if not exists(select 1 from public.practices where id=p_practice and owner_user_id=actor)then raise exception using errcode='42501',message='DOCTOR_BILLING_OWNER_REQUIRED';end if;
 -- Match administrative location/appointment commands: practice before subscriber before row locks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_practice::text,1));
 perform doctor_private.saas_lock_subscriber(actor);perform doctor_private.current_actor();
 if not exists(select 1 from public.practices where id=p_practice and owner_user_id=actor)then raise exception using errcode='42501',message='DOCTOR_BILLING_OWNER_REQUIRED';end if;
 select * into place from public.locations where practice_id=p_practice and id=p_location for share;
 if not found then raise exception using errcode='42501',message='DOCTOR_BILLING_OWNER_REQUIRED';end if;
 if p_write then
  if place.archived_at is not null then raise exception using errcode='42501',message='DOCTOR_BILLING_ACTIVE_LOCATION_REQUIRED';end if;
  if doctor_private.edition_mode()='administrative_candidate'then perform doctor_private.saas_owner_business_state(actor,true,false);end if;
 end if;
 return actor;
end $$;
create function doctor_private.billing_price_projection(r public.doctor_service_price_versions)returns jsonb
language sql immutable security invoker set search_path=''as $$
 select to_jsonb(r)-'unit_minor'||jsonb_build_object('kind','service_price','unit_minor',r.unit_minor::text,'data_mode','synthetic','tax_applicability','unreviewed','tax_minor',null,'discount_available',false,'live_collection',false)
$$;
create function doctor_private.billing_charge_projection(r public.doctor_visit_charge_versions)returns jsonb
language sql immutable security invoker set search_path=''as $$
 select to_jsonb(r)-'unit_minor'-'amount_minor'||jsonb_build_object('kind','visit_charge','unit_minor',r.unit_minor::text,'amount_minor',r.amount_minor::text,'data_mode','synthetic','tax_applicability','unreviewed','tax_minor',null,'tax_invoice_available',false,'live_collection',false)
$$;
create function doctor_private.write_service_price(p_practice uuid,p_location uuid,p_service uuid,p_revision integer,p_label text,p_minor text,p_currency text,p_exponent integer,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;previous public.doctor_service_price_versions;item public.doctor_service_price_versions;prior doctor_private.command_receipts;result jsonb;service uuid:=coalesce(p_service,gen_random_uuid());
 request jsonb:=jsonb_build_object('command','billing.price.write','practice',p_practice,'location',p_location,'service',p_service,'revision',p_revision,'label',p_label,'minor',p_minor,'currency',p_currency,'exponent',p_exponent);
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_key is null or p_revision is null or p_revision<0 or p_label is null or length(btrim(p_label))not between 1 and 160 or p_label~'[[:cntrl:]<>]'
  or p_minor is null or p_minor!~'^(0|[1-9][0-9]{0,15})$'or p_minor::numeric>9007199254740991 or p_currency is null or p_currency!~'^[A-Z]{3}$'
  or p_exponent is null or p_exponent not between 0 and 4 or(p_service is null)<>(p_revision=0)then raise exception using errcode='22023',message='DOCTOR_BILLING_PRICE_INVALID';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform doctor_private.practice_billing_owner(p_practice,p_location,true);
 if p_service is not null then
  select * into previous from public.doctor_service_price_versions where service_id=p_service order by revision desc limit 1;
  if previous.practice_id is distinct from p_practice or previous.location_id is distinct from p_location then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  if previous.revision<>p_revision then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 end if;
 insert into public.doctor_service_price_versions(service_id,revision,practice_id,location_id,doctor_user_id,label,unit_minor,currency,currency_exponent,actor_user_id)
 values(service,p_revision+1,p_practice,p_location,actor,btrim(p_label),p_minor::bigint,p_currency,p_exponent,actor)returning * into item;
 result:=doctor_private.billing_price_projection(item);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
create function doctor_private.write_visit_charge(p_practice uuid,p_location uuid,p_visit uuid,p_price uuid,p_quantity integer,p_charge uuid,p_revision integer,p_reason text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;visit public.appointments;price public.doctor_service_price_versions;previous public.doctor_visit_charge_versions;item public.doctor_visit_charge_versions;prior doctor_private.command_receipts;result jsonb;charge uuid:=coalesce(p_charge,gen_random_uuid());amount numeric;
 request jsonb:=jsonb_build_object('command','billing.charge.write','practice',p_practice,'location',p_location,'visit',p_visit,'price',p_price,'quantity',p_quantity,'charge',p_charge,'revision',p_revision,'reason',p_reason);
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_key is null or p_visit is null or p_price is null or p_revision is null or p_revision<0 or(p_charge is null)<>(p_revision=0)
  or p_quantity is null or p_quantity not between 1 and 1000 or p_reason is null or length(btrim(p_reason))not between 2 and 500 or p_reason~'[[:cntrl:]<>]'then raise exception using errcode='22023',message='DOCTOR_BILLING_CHARGE_INVALID';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform doctor_private.practice_billing_owner(p_practice,p_location,true);
 select * into visit from public.appointments where practice_id=p_practice and location_id=p_location and id=p_visit and doctor_user_id=actor for share;
 select * into price from public.doctor_service_price_versions where practice_id=p_practice and location_id=p_location and id=p_price;
 if visit.id is null or price.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 if price.revision<>(select max(revision)from public.doctor_service_price_versions where service_id=price.service_id)then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 if p_charge is not null then
  select * into previous from public.doctor_visit_charge_versions where charge_id=p_charge order by revision desc limit 1;
  if previous.practice_id is distinct from p_practice or previous.location_id is distinct from p_location or previous.visit_id is distinct from p_visit or previous.patient_id is distinct from visit.patient_id or previous.service_id is distinct from price.service_id
   or previous.currency is distinct from price.currency or previous.currency_exponent is distinct from price.currency_exponent then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  if previous.revision<>p_revision then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 end if;
 amount:=price.unit_minor::numeric*p_quantity;
 if amount>9007199254740991 then raise exception using errcode='22023',message='DOCTOR_BILLING_CHARGE_INVALID';end if;
 insert into public.doctor_visit_charge_versions(charge_id,revision,previous_id,practice_id,location_id,doctor_user_id,visit_id,patient_id,price_id,service_id,label,unit_minor,quantity,amount_minor,currency,currency_exponent,reason,actor_user_id)
 values(charge,p_revision+1,previous.id,p_practice,p_location,actor,p_visit,visit.patient_id,price.id,price.service_id,price.label,price.unit_minor,p_quantity,amount::bigint,price.currency,price.currency_exponent,btrim(p_reason),actor)returning * into item;
 result:=doctor_private.billing_charge_projection(item);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
create function doctor_private.practice_billing_record(p_practice uuid,p_location uuid,p_kind text,p_id uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare result jsonb;begin
 perform doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_kind='price'then select doctor_private.billing_price_projection(r)into result from public.doctor_service_price_versions r where r.practice_id=p_practice and r.location_id=p_location and r.id=p_id;
 elsif p_kind='charge'then select doctor_private.billing_charge_projection(r)into result from public.doctor_visit_charge_versions r where r.practice_id=p_practice and r.location_id=p_location and r.id=p_id;
 else raise exception using errcode='22023',message='DOCTOR_BILLING_QUERY_INVALID';end if;
 if result is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;return result;
end $$;
create function public.doctor_write_service_price(p_practice uuid,p_location uuid,p_service uuid,p_revision integer,p_label text,p_minor text,p_currency text,p_exponent integer,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.write_service_price(p_practice,p_location,p_service,p_revision,p_label,p_minor,p_currency,p_exponent,p_key)$$;
create function public.doctor_write_visit_charge(p_practice uuid,p_location uuid,p_visit uuid,p_price uuid,p_quantity integer,p_charge uuid,p_revision integer,p_reason text,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.write_visit_charge(p_practice,p_location,p_visit,p_price,p_quantity,p_charge,p_revision,p_reason,p_key)$$;
create function public.doctor_practice_billing_record(p_practice uuid,p_location uuid,p_kind text,p_id uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.practice_billing_record(p_practice,p_location,p_kind,p_id)$$;
revoke all on function doctor_private.practice_billing_owner(uuid,uuid,boolean),doctor_private.billing_price_projection(public.doctor_service_price_versions),doctor_private.billing_charge_projection(public.doctor_visit_charge_versions),doctor_private.write_service_price(uuid,uuid,uuid,integer,text,text,text,integer,uuid),doctor_private.write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid),doctor_private.practice_billing_record(uuid,uuid,text,uuid),public.doctor_write_service_price(uuid,uuid,uuid,integer,text,text,text,integer,uuid),public.doctor_write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid),public.doctor_practice_billing_record(uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.write_service_price(uuid,uuid,uuid,integer,text,text,text,integer,uuid),doctor_private.write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid),doctor_private.practice_billing_record(uuid,uuid,text,uuid),public.doctor_write_service_price(uuid,uuid,uuid,integer,text,text,text,integer,uuid),public.doctor_write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid),public.doctor_practice_billing_record(uuid,uuid,text,uuid)to authenticated;
