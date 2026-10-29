-- Owner-only administrative directory/history; no clinical payload, collection, discount or tax activation.
-- Legacy records retain unknown visit-version evidence; never fabricate it from the current appointment.
alter table public.doctor_visit_charge_versions add column visit_version integer check(visit_version>0);
-- Preserve the same predicates in a flat AND form. pg_dump/restore otherwise flattens
-- BETWEEN's nested AND during reparse, breaking exact schema equality despite unchanged rows/policy.
alter table public.doctor_service_price_versions drop constraint doctor_service_price_versions_label_check;
alter table public.doctor_service_price_versions add constraint doctor_service_price_versions_label_check check(length(btrim(label))>=1 and length(btrim(label))<=160 and label!~'[[:cntrl:]<>]');
alter table public.doctor_visit_charge_versions drop constraint doctor_visit_charge_versions_reason_check;
alter table public.doctor_visit_charge_versions add constraint doctor_visit_charge_versions_reason_check check(length(btrim(reason))>=2 and length(btrim(reason))<=500 and reason!~'[[:cntrl:]<>]');
create index doctor_service_prices_scope_latest on public.doctor_service_price_versions(practice_id,location_id,service_id,revision desc);
create index doctor_visit_charges_scope_latest on public.doctor_visit_charge_versions(practice_id,location_id,charge_id,revision desc);
create function doctor_private.practice_billing_board(p_practice uuid,p_location uuid,p_price_page integer,p_charge_page integer,p_visit_page integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;result jsonb;entitlement jsonb;place public.locations;
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_price_page is null or p_charge_page is null or p_visit_page is null or least(p_price_page,p_charge_page,p_visit_page)<1 or greatest(p_price_page,p_charge_page,p_visit_page)>1000000 then
  raise exception using errcode='22023',message='DOCTOR_BILLING_QUERY_INVALID';end if;
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 entitlement:=doctor_private.saas_entitlement_context(p_practice);
 with prices as materialized(select distinct on(service_id)p.* from public.doctor_service_price_versions p where practice_id=p_practice and location_id=p_location order by service_id,revision desc),
 price_page as(select * from prices order by label,service_id limit 25 offset(p_price_page-1)*25),
 charges as materialized(select distinct on(charge_id)c.* from public.doctor_visit_charge_versions c where practice_id=p_practice and location_id=p_location order by charge_id,revision desc),
 charge_page as(select * from charges order by created_at desc,charge_id limit 25 offset(p_charge_page-1)*25),
 visits as materialized(select a.* from public.appointments a where practice_id=p_practice and location_id=p_location and doctor_user_id=actor),
 visit_page as(select * from visits order by starts_at desc,id limit 25 offset(p_visit_page-1)*25)
 select jsonb_build_object('actor_user_id',actor,'practice_id',p_practice,'location_id',p_location,'edition',doctor_private.edition_mode(),'entitlement',entitlement,
 'location_archived',place.archived_at is not null,'can_write',place.archived_at is null and coalesce((entitlement->>'writes_allowed')::boolean,false),
 'price_page',p_price_page,'price_total',(select count(*)from prices),'prices',coalesce((select jsonb_agg(doctor_private.billing_price_projection(p::public.doctor_service_price_versions)order by p.label,p.service_id)from price_page p),'[]'::jsonb),
 'charge_page',p_charge_page,'charge_total',(select count(*)from charges),'charges',coalesce((select jsonb_agg(jsonb_build_object('source_matches',a.patient_id=c.patient_id,'charge',doctor_private.billing_charge_projection(c::public.doctor_visit_charge_versions),'price',doctor_private.billing_price_projection(p),'visit',jsonb_build_object('id',a.id,'patient_id',c.patient_id,'patient_name',patient.display_name,'starts_at',a.starts_at,'state',a.state,'version',a.version))order by c.created_at desc,c.charge_id)
 from charge_page c join public.doctor_service_price_versions p on p.id=c.price_id and p.practice_id=c.practice_id and p.location_id=c.location_id
 join public.appointments a on a.id=c.visit_id and a.practice_id=c.practice_id
 join public.practice_patients patient on patient.id=c.patient_id and patient.practice_id=c.practice_id),'[]'::jsonb),
 'visit_page',p_visit_page,'visit_total',(select count(*)from visits),'visits',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'patient_id',v.patient_id,'patient_name',p.display_name,'starts_at',v.starts_at,'state',v.state,'version',v.version)order by v.starts_at desc,v.id)from visit_page v join public.practice_patients p on p.id=v.patient_id and p.practice_id=v.practice_id),'[]'::jsonb),
 'data_mode','synthetic','tax_applicability','unreviewed','live_collection',false)into result;
 return result;
end $$;
create function doctor_private.visit_charge_history(p_practice uuid,p_location uuid,p_charge uuid,p_before_revision integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$declare actor uuid;result jsonb;begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_charge is null or(p_before_revision is not null and p_before_revision<1)then raise exception using errcode='22023',message='DOCTOR_BILLING_QUERY_INVALID';end if;
 if not exists(select 1 from public.doctor_visit_charge_versions where practice_id=p_practice and location_id=p_location and charge_id=p_charge)then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 with population as materialized(select * from public.doctor_visit_charge_versions where practice_id=p_practice and location_id=p_location and charge_id=p_charge),
 page as(select * from population where p_before_revision is null or revision<p_before_revision order by revision desc limit 20)
 select jsonb_build_object('actor_user_id',actor,'practice_id',p_practice,'location_id',p_location,'charge_id',p_charge,'before_revision',p_before_revision,'next_before_revision',(select case when min(revision)>1 then min(revision)else null end from page),'total',(select count(*)from population),
 'items',coalesce((select jsonb_agg(jsonb_build_object('charge',doctor_private.billing_charge_projection(c::public.doctor_visit_charge_versions),'price',doctor_private.billing_price_projection(p))order by c.revision desc)from page c join public.doctor_service_price_versions p on p.id=c.price_id and p.practice_id=c.practice_id and p.location_id=c.location_id),'[]'::jsonb),'data_mode','synthetic','tax_applicability','unreviewed','live_collection',false)into result;
 return result;
end $$;
create function public.doctor_practice_billing_board(p_practice uuid,p_location uuid,p_price_page integer default 1,p_charge_page integer default 1,p_visit_page integer default 1)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.practice_billing_board(p_practice,p_location,p_price_page,p_charge_page,p_visit_page)$$;
create function public.doctor_visit_charge_history(p_practice uuid,p_location uuid,p_charge uuid,p_before_revision integer default null)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.visit_charge_history(p_practice,p_location,p_charge,p_before_revision)$$;
revoke all on function doctor_private.practice_billing_board(uuid,uuid,integer,integer,integer),doctor_private.visit_charge_history(uuid,uuid,uuid,integer),public.doctor_practice_billing_board(uuid,uuid,integer,integer,integer),public.doctor_visit_charge_history(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.practice_billing_board(uuid,uuid,integer,integer,integer),doctor_private.visit_charge_history(uuid,uuid,uuid,integer),public.doctor_practice_billing_board(uuid,uuid,integer,integer,integer),public.doctor_visit_charge_history(uuid,uuid,uuid,integer)to authenticated;

-- An administrative reschedule never relocates an already issued financial snapshot.
-- Corrections retain the original billing scope and verify the same owned visit/patient, even after a move.
create function doctor_private.write_visit_charge(p_practice uuid,p_location uuid,p_visit uuid,p_visit_version integer,p_patient uuid,p_price uuid,p_quantity integer,p_charge uuid,p_revision integer,p_reason text,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;visit public.appointments;price public.doctor_service_price_versions;previous public.doctor_visit_charge_versions;item public.doctor_visit_charge_versions;prior doctor_private.command_receipts;result jsonb;charge uuid:=coalesce(p_charge,gen_random_uuid());amount numeric;
 request jsonb:=jsonb_build_object('command','billing.charge.write','practice',p_practice,'location',p_location,'visit',p_visit,'visit_version',p_visit_version,'patient',p_patient,'price',p_price,'quantity',p_quantity,'charge',p_charge,'revision',p_revision,'reason',p_reason);
begin
 actor:=doctor_private.practice_billing_owner(p_practice,p_location,false);
 if p_key is null or p_visit is null or p_visit_version is null or p_visit_version<1 or p_patient is null or p_price is null or p_revision is null or p_revision<0 or(p_charge is null)<>(p_revision=0)
  or p_quantity is null or p_quantity not between 1 and 1000 or p_reason is null or length(btrim(p_reason))not between 2 and 500 or p_reason~'[[:cntrl:]<>]'then raise exception using errcode='22023',message='DOCTOR_BILLING_CHARGE_INVALID';end if;
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 perform doctor_private.practice_billing_owner(p_practice,p_location,true);
 select * into visit from public.appointments where practice_id=p_practice and(p_charge is not null or location_id=p_location)and id=p_visit and doctor_user_id=actor for share;
 select * into price from public.doctor_service_price_versions where practice_id=p_practice and location_id=p_location and id=p_price;
 if visit.id is null or price.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
 if visit.version<>p_visit_version or visit.patient_id is distinct from p_patient then raise exception using errcode='40001',message='DOCTOR_BILLING_VISIT_CONFLICT';end if;
 if price.revision<>(select max(revision)from public.doctor_service_price_versions where service_id=price.service_id)then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 if p_charge is not null then
  select * into previous from public.doctor_visit_charge_versions where charge_id=p_charge order by revision desc limit 1;
  if previous.practice_id is distinct from p_practice or previous.location_id is distinct from p_location or previous.visit_id is distinct from p_visit or previous.patient_id is distinct from visit.patient_id or previous.service_id is distinct from price.service_id
   or previous.currency is distinct from price.currency or previous.currency_exponent is distinct from price.currency_exponent then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  if previous.revision<>p_revision then raise exception using errcode='40001',message='DOCTOR_BILLING_VERSION_CONFLICT';end if;
 end if;
 amount:=price.unit_minor::numeric*p_quantity;
 if amount>9007199254740991 then raise exception using errcode='22023',message='DOCTOR_BILLING_CHARGE_INVALID';end if;
 insert into public.doctor_visit_charge_versions(charge_id,revision,previous_id,practice_id,location_id,doctor_user_id,visit_id,patient_id,price_id,service_id,label,unit_minor,quantity,amount_minor,currency,currency_exponent,reason,actor_user_id,visit_version)
 values(charge,p_revision+1,previous.id,p_practice,p_location,actor,p_visit,visit.patient_id,price.id,price.service_id,price.label,price.unit_minor,p_quantity,amount::bigint,price.currency,price.currency_exponent,btrim(p_reason),actor,visit.version)returning * into item;
 result:=doctor_private.billing_charge_projection(item);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;

-- Close unbound client writes; immutable legacy records/receipts remain retained for review.
revoke all on function public.doctor_write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid),doctor_private.write_visit_charge(uuid,uuid,uuid,uuid,integer,uuid,integer,text,uuid)from public,anon,authenticated,service_role;
create function public.doctor_write_visit_charge(p_practice uuid,p_location uuid,p_visit uuid,p_visit_version integer,p_patient uuid,p_price uuid,p_quantity integer,p_charge uuid,p_revision integer,p_reason text,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.write_visit_charge(p_practice,p_location,p_visit,p_visit_version,p_patient,p_price,p_quantity,p_charge,p_revision,p_reason,p_key)$$;
revoke all on function public.doctor_write_visit_charge(uuid,uuid,uuid,integer,uuid,uuid,integer,uuid,integer,text,uuid),doctor_private.write_visit_charge(uuid,uuid,uuid,integer,uuid,uuid,integer,uuid,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.doctor_write_visit_charge(uuid,uuid,uuid,integer,uuid,uuid,integer,uuid,integer,text,uuid),doctor_private.write_visit_charge(uuid,uuid,uuid,integer,uuid,uuid,integer,uuid,integer,text,uuid)to authenticated;
