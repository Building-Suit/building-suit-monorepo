-- SS-SERV-002. Optional recipes; explicit performance, never inferred from payment.
-- Stock retains its existing 0.01 base-unit precision. No unit conversions.
create table public.service_material_units (
 product_id uuid primary key, shop_id uuid not null, unit text not null check(unit in('each','mL','g')),
 dimension text generated always as (case unit when 'each' then 'count' when 'mL' then 'volume' else 'mass' end) stored,
 actor_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id), unique(product_id,shop_id,unit)
);
create table public.service_recipe_versions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null, service_id uuid not null,
 request_id uuid not null, requested_effective_at timestamptz, effective_at timestamptz not null, materials jsonb not null check(jsonb_typeof(materials)='array'),
 reason text not null check(length(btrim(reason)) between 2 and 1000),
 actor_profile_id uuid not null references public.profiles(id), created_at timestamptz not null default clock_timestamp(),
 foreign key(service_id,shop_id) references public.services(id,shop_id), unique(shop_id,request_id),unique(id,shop_id)
);
create index service_recipe_effective on public.service_recipe_versions(shop_id,service_id,effective_at desc,created_at desc,id desc);
create table public.service_fulfillments (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id),
 location_id uuid not null, service_id uuid not null, line_id uuid, appointment_id uuid,
 request_id uuid not null, payload jsonb not null, quantity numeric(12,2) not null check(quantity>0),
 recipe_version_id uuid, materials jsonb not null, reason text not null,
 actor_profile_id uuid not null references public.profiles(id), completed_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),
 foreign key(service_id,shop_id) references public.services(id,shop_id),
 foreign key(line_id,shop_id) references public.invoice_items(id,shop_id),
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id),
 foreign key(recipe_version_id,shop_id) references public.service_recipe_versions(id,shop_id),
 check(line_id is not null or appointment_id is not null),unique(shop_id,request_id),unique(appointment_id),unique(id,shop_id)
);
create index service_fulfillment_line on public.service_fulfillments(line_id) where line_id is not null;
-- A completed appointment may be sold later. Linking is explicit and append-only.
create table public.service_fulfillment_sale_links (
 fulfillment_id uuid primary key,shop_id uuid not null,line_id uuid not null,
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(fulfillment_id,shop_id) references public.service_fulfillments(id,shop_id),
 foreign key(line_id,shop_id) references public.invoice_items(id,shop_id)
);
create index service_fulfillment_sale_line on public.service_fulfillment_sale_links(line_id);
create table public.service_material_consumptions (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,fulfillment_id uuid not null,
 product_id uuid not null,batch_id uuid not null,unit text not null,quantity numeric(12,2) not null check(quantity>0),
 unit_cost numeric(12,2) not null, movement_id uuid not null unique references public.inventory_movements(id),
 foreign key(fulfillment_id,shop_id) references public.service_fulfillments(id,shop_id),
 foreign key(batch_id,shop_id,product_id) references public.inventory_batches(id,shop_id,product_id),
 foreign key(product_id,shop_id,unit) references public.service_material_units(product_id,shop_id,unit)
);
create index service_material_consumption_fulfillment on public.service_material_consumptions(fulfillment_id);

do $$declare t text;begin
 foreach t in array array['service_material_units','service_recipe_versions','service_fulfillments','service_fulfillment_sale_links','service_material_consumptions'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert on public.%I to service_role',t);
  execute format('create trigger service_history_immutable before update or delete on public.%I for each row execute function shop_private.commission_immutable()',t);
 end loop;
end;$$;

create function public.define_service_material_unit(p_shop_id uuid,p_product_id uuid,p_unit text) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid; existing text;
begin
 actor:=shop_private.commission_manager(p_shop_id);
 perform 1 from public.products where id=p_product_id and shop_id=p_shop_id and is_active for update;
 if not found then raise exception 'MATERIAL_NOT_FOUND' using errcode='P0002';end if;
 select unit into existing from public.service_material_units where product_id=p_product_id and shop_id=p_shop_id;
 if found then
  if existing is distinct from p_unit then raise exception 'MATERIAL_UNIT_IMMUTABLE' using errcode='55000';end if;
  return;
 end if;
 -- Stock numbers with no unit cannot safely be relabelled as grams/millilitres.
 if exists(select 1 from public.inventory_batches where product_id=p_product_id) then
  raise exception 'MATERIAL_UNIT_REQUIRES_UNUSED_PRODUCT' using errcode='55000';end if;
 insert into public.service_material_units(product_id,shop_id,unit,actor_profile_id) values(p_product_id,p_shop_id,p_unit,actor);
end;$$;
revoke all on function public.define_service_material_unit(uuid,uuid,text) from public,anon;
grant execute on function public.define_service_material_unit(uuid,uuid,text) to authenticated;

create function shop_private.validate_service_materials(p_shop_id uuid,p_materials jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m jsonb; result jsonb:='[]'; prod public.products%rowtype; unit_name text; qty numeric;
begin
 if p_materials is null or jsonb_typeof(p_materials)<>'array' or jsonb_array_length(p_materials)>100 then
  raise exception 'INVALID_SERVICE_MATERIALS' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(p_materials) e group by e->>'productId' having count(*)>1) then
  raise exception 'DUPLICATE_SERVICE_MATERIAL' using errcode='22023';end if;
 for m in select value from jsonb_array_elements(p_materials) order by value->>'productId' loop
  qty:=(m->>'quantity')::numeric;
  if jsonb_typeof(m->'quantity') is distinct from 'number' or qty is null or qty<=0 or qty>1000000 or round(qty,2)<>qty then
   raise exception 'INVALID_MATERIAL_QUANTITY_PRECISION' using errcode='22023';end if;
  select * into prod from public.products where id=(m->>'productId')::uuid and shop_id=p_shop_id and is_active;
  if not found then raise exception 'MATERIAL_NOT_FOUND' using errcode='23503';end if;
  select unit into unit_name from public.service_material_units where product_id=prod.id and shop_id=p_shop_id;
  if unit_name is null or unit_name is distinct from m->>'unit' then
   raise exception 'INCOMPATIBLE_MATERIAL_UNIT' using errcode='23514';end if;
  result:=result||jsonb_build_array(jsonb_build_object('productId',prod.id,'name',prod.name,'unit',unit_name,'quantity',qty));
 end loop;
 return result;
end;$$;
revoke all on function shop_private.validate_service_materials(uuid,jsonb) from public,anon,authenticated,service_role;

create function public.save_service_recipe(p_request_id uuid,p_shop_id uuid,p_service_id uuid,p_effective_at timestamptz,p_materials jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; old public.service_recipe_versions%rowtype; result uuid; normalized jsonb;
begin
 actor:=shop_private.commission_manager(p_shop_id);
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then
  raise exception 'INVALID_SERVICE_RECIPE' using errcode='22023';end if;
 perform 1 from public.services where id=p_service_id and shop_id=p_shop_id and is_active for update;
 if not found then raise exception 'SERVICE_NOT_FOUND' using errcode='P0002';end if;
 select * into old from public.service_recipe_versions where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if old.service_id<>p_service_id or old.requested_effective_at is distinct from p_effective_at or old.reason<>btrim(p_reason) or old.actor_profile_id<>actor
   or (select jsonb_agg(e-'name' order by e->>'productId') from jsonb_array_elements(old.materials)e)
    is distinct from (select jsonb_agg(e-'name' order by e->>'productId') from jsonb_array_elements(p_materials)e) then
   raise exception 'SERVICE_REQUEST_CONFLICT' using errcode='23505';end if;
  return old.id;
 end if;
 -- No retroactive effective dates. Empty materials is an explicit recipe disable.
 if p_effective_at is not null and (not isfinite(p_effective_at) or p_effective_at<statement_timestamp()) then raise exception 'RECIPE_EFFECTIVE_TIME_IN_PAST' using errcode='22023';end if;
 normalized:=shop_private.validate_service_materials(p_shop_id,p_materials);
 insert into public.service_recipe_versions(shop_id,service_id,request_id,requested_effective_at,effective_at,materials,reason,actor_profile_id)
 values(p_shop_id,p_service_id,p_request_id,p_effective_at,coalesce(p_effective_at,clock_timestamp()),normalized,btrim(p_reason),actor) returning id into result;
 return result;
end;$$;
revoke all on function public.save_service_recipe(uuid,uuid,uuid,timestamptz,jsonb,text) from public,anon;
grant execute on function public.save_service_recipe(uuid,uuid,uuid,timestamptz,jsonb,text) to authenticated;

create function shop_private.service_completed_quantity(p_line_id uuid) returns numeric
language sql stable security definer set search_path='' as $$
 select coalesce(sum(f.quantity),0) from public.service_fulfillments f
 left join public.service_fulfillment_sale_links l on l.fulfillment_id=f.id
 where coalesce(f.line_id,l.line_id)=p_line_id
$$;
revoke all on function shop_private.service_completed_quantity(uuid) from public,anon,authenticated,service_role;

create function shop_private.complete_service(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_line_id uuid,p_quantity numeric,
 p_appointment_id uuid default null,p_materials jsonb default null,p_reason text default 'Service performed',p_from_transition boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; line public.invoice_items%rowtype; sale public.invoices%rowtype; ap public.appointments%rowtype;
 recipe public.service_recipe_versions%rowtype; previous public.service_fulfillments%rowtype;
 payload jsonb; material jsonb; usage jsonb:='[]'; batch record; needed numeric; take_qty numeric;
 result uuid:=gen_random_uuid(); movement uuid; service uuid; available numeric;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 perform shop_private.assert_period_is_open(p_shop_id,clock_timestamp());
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_quantity is null or p_quantity<=0 or p_quantity>1000000 or round(p_quantity,2)<>p_quantity
  or (p_line_id is null and p_appointment_id is null) or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then
  raise exception 'INVALID_SERVICE_COMPLETION' using errcode='22023';end if;
 payload:=jsonb_build_array(p_line_id,p_location_id,p_quantity,p_appointment_id,p_materials,btrim(p_reason));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('service:'||p_shop_id::text||':'||p_request_id::text,0));
 select * into previous from public.service_fulfillments where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if previous.payload<>payload or previous.actor_profile_id<>actor then raise exception 'SERVICE_REQUEST_CONFLICT' using errcode='23505';end if;
  return previous.id;
 end if;
 if exists(select 1 from public.service_completion_cancellations where shop_id=p_shop_id and request_id=p_request_id) then
  raise exception 'SERVICE_REQUEST_CANCELLED' using errcode='55000';end if;
 if p_line_id is not null then
  select * into line from public.invoice_items where id=p_line_id and shop_id=p_shop_id and item_type='service';
  if not found then raise exception 'SERVICE_LINE_NOT_FOUND' using errcode='P0002';end if;
  select * into sale from public.invoices where id=line.invoice_id and shop_id=p_shop_id for update;
  if sale.location_id<>p_location_id or sale.status<>'issued' or exists(select 1 from public.sale_corrections where invoice_id=sale.id) then
   raise exception 'SERVICE_SALE_NOT_FULFILLABLE' using errcode='23514';end if;
  if shop_private.service_completed_quantity(line.id)+p_quantity>line.quantity then
   raise exception 'SERVICE_QUANTITY_EXCEEDED' using errcode='23514';end if;
  service:=line.service_id;
 end if;
 if p_appointment_id is not null then
  perform shop_private.appointment_actor_profile(p_shop_id,'appointments.manage');
  select * into ap from public.appointments where id=p_appointment_id and shop_id=p_shop_id for update;
  if not found or ap.location_id<>p_location_id or not (ap.status='in_service' or (p_from_transition and ap.status='completed')) or p_quantity<>1
   or (p_line_id is not null and (ap.service_id<>service or ap.sale_id is distinct from sale.id))
   or (p_line_id is null and ap.sale_id is not null) then
   raise exception 'INVALID_SERVICE_APPOINTMENT' using errcode='23514';end if;
  if exists(select 1 from public.service_fulfillments where appointment_id=ap.id) then
   raise exception 'APPOINTMENT_ALREADY_FULFILLED' using errcode='23505';end if;
  service:=ap.service_id;
 end if;
 select * into recipe from public.service_recipe_versions where shop_id=p_shop_id and service_id=service
  and effective_at<=clock_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 if p_materials is not null then
  perform shop_private.commission_manager(p_shop_id);
  usage:=shop_private.validate_service_materials(p_shop_id,p_materials);
 else
  for material in select value from jsonb_array_elements(coalesce(recipe.materials,'[]')) loop
   needed:=(material->>'quantity')::numeric*p_quantity;
   if round(needed,2)<>needed or needed>1000000 then raise exception 'INVALID_MATERIAL_QUANTITY_PRECISION' using errcode='22023';end if;
   usage:=usage||jsonb_build_array(jsonb_set(material,'{quantity}',to_jsonb(needed)));
  end loop;
 end if;
 usage:=shop_private.validate_service_materials(p_shop_id,usage);
 -- Same product lock and stable order as the existing inventory writers.
 perform p.id from public.products p join jsonb_array_elements(usage)m on p.id=(m->>'productId')::uuid
  where p.shop_id=p_shop_id order by p.id for update of p;
 insert into public.service_fulfillments(id,shop_id,location_id,service_id,line_id,appointment_id,request_id,payload,quantity,
  recipe_version_id,materials,reason,actor_profile_id)
 values(result,p_shop_id,p_location_id,service,p_line_id,p_appointment_id,p_request_id,payload,p_quantity,recipe.id,usage,btrim(p_reason),actor);
 for material in select value from jsonb_array_elements(usage) order by value->>'productId' loop
  needed:=(material->>'quantity')::numeric;
  for batch in select * from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id
   and product_id=(material->>'productId')::uuid and remaining_quantity>0 order by received_at,id for update loop
   exit when needed=0;
   take_qty:=least(needed,batch.remaining_quantity);
   update public.inventory_batches set remaining_quantity=remaining_quantity-take_qty where id=batch.id;
   -- reference is fulfillment, NOT sale: sale refunds must never resurrect cream/dye.
   insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,
    created_by_profile_id,unit_cost_snapshot)
   values(p_shop_id,p_location_id,batch.product_id,batch.id,-take_qty,'out',result,actor,batch.unit_cost) returning id into movement;
   insert into public.service_material_consumptions(shop_id,fulfillment_id,product_id,batch_id,unit,quantity,unit_cost,movement_id)
   values(p_shop_id,result,batch.product_id,batch.id,material->>'unit',take_qty,batch.unit_cost,movement);
   needed:=needed-take_qty;
  end loop;
  if needed>0 then raise exception 'INSUFFICIENT_SERVICE_MATERIAL_STOCK' using errcode='23514';end if;
 end loop;
 if ap.id is not null and ap.status='in_service' then
  perform shop_private.transition_appointment(p_request_id,p_shop_id,ap.id,'completed',p_reason);
 end if;
 if sale.id is not null then perform shop_private.reconcile_commission(sale.id);end if;
 return result;
end;$$;
revoke all on function shop_private.complete_service(uuid,uuid,uuid,uuid,numeric,uuid,jsonb,text,boolean) from public,anon,authenticated,service_role;
create function public.complete_service(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_line_id uuid,p_quantity numeric,
 p_appointment_id uuid default null,p_materials jsonb default null,p_reason text default 'Service performed') returns uuid
language sql security definer set search_path='' as $$
 select shop_private.complete_service(p_request_id,p_shop_id,p_location_id,p_line_id,p_quantity,p_appointment_id,p_materials,p_reason,false)
$$;
revoke all on function public.complete_service(uuid,uuid,uuid,uuid,numeric,uuid,jsonb,text) from public,anon;
grant execute on function public.complete_service(uuid,uuid,uuid,uuid,numeric,uuid,jsonb,text) to authenticated;

-- Forward commission fulfillment integration; tax owner retains capture arithmetic.
create or replace function public.assign_sale_commission(p_shop_id uuid,p_line_id uuid,p_membership_id uuid,p_appointment_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; line public.invoice_items%rowtype; sale public.invoices%rowtype;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 select * into line from public.invoice_items where id=p_line_id and shop_id=p_shop_id;
 if not found then raise exception 'COMMISSION_LINE_NOT_FOUND' using errcode='P0002'; end if;
 select * into sale from public.invoices where id=line.invoice_id and shop_id=p_shop_id for update;
 if not found then raise exception 'COMMISSION_LINE_NOT_FOUND' using errcode='P0002'; end if;
 perform shop_private.assert_location_access(p_shop_id,sale.location_id,true);
 if sale.status<>'draft' then raise exception 'COMMISSION_ASSIGNMENT_FINALIZED' using errcode='55000'; end if;
 if p_membership_id is null then delete from public.commission_line_assignments where line_id=p_line_id; return; end if;
 if not exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id
  where m.id=p_membership_id and m.shop_id=p_shop_id and m.status='active' and p.status='active'
   and (m.role='owner' or exists(select 1 from public.membership_location_assignments a where a.membership_id=m.id and a.location_id=sale.location_id))) then
  raise exception 'INVALID_COMMISSION_EMPLOYEE' using errcode='23503'; end if;
 if line.item_type='service' then
  if p_appointment_id is not null and (line.quantity<>1 or not exists(select 1 from public.appointments a where a.id=p_appointment_id and a.shop_id=p_shop_id
   and a.sale_id=sale.id and a.location_id=sale.location_id and a.assigned_membership_id=p_membership_id
   and a.service_id=line.service_id and a.status not in('cancelled','no_show'))) then
   raise exception 'COMMISSION_FULFILLMENT_REQUIRED' using errcode='23514'; end if;
 elsif line.item_type<>'product' or p_appointment_id is not null then
  raise exception 'INVALID_COMMISSION_LINE' using errcode='22023'; end if;
 insert into public.commission_line_assignments(line_id,shop_id,membership_id,appointment_id,actor_profile_id)
 values(p_line_id,p_shop_id,p_membership_id,p_appointment_id,actor)
 on conflict(line_id) do update set membership_id=excluded.membership_id,appointment_id=excluded.appointment_id,
 actor_profile_id=excluded.actor_profile_id,created_at=clock_timestamp();
end; $$;
revoke all on function public.assign_sale_commission(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_sale_commission(uuid,uuid,uuid,uuid) to authenticated;


create or replace function shop_private.capture_commission() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.commission_policy_versions%rowtype; line record; employee jsonb; rate jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 select * into policy from public.commission_policy_versions where shop_id=new.shop_id order by created_at desc,id desc limit 1;
 if not found or not (policy.policy->>'enabled')::boolean or policy.policy->>'currency'<>new.currency then return new; end if;
 for line in select i.*,coalesce((select (t->>'net')::numeric from public.sale_tax_snapshots ts cross join lateral jsonb_array_elements(ts.snapshot->'lines') t where ts.invoice_id=new.id and t->>'id'=i.id::text),i.total_amount) commission_net_amount,a.membership_id,a.appointment_id,m.profile_id,coalesce(m.team_full_name,p.display_name,p.email_snapshot) employee_name
  from public.invoice_items i join public.commission_line_assignments a on a.line_id=i.id and a.shop_id=i.shop_id
  join public.shop_memberships m on m.id=a.membership_id and m.shop_id=i.shop_id
  join public.profiles p on p.id=m.profile_id where i.invoice_id=new.id and m.status='active' and p.status='active' order by i.id loop
  select value into employee from jsonb_array_elements(policy.policy->'employees') where value->>'membershipId'=line.membership_id::text;
  if employee is null or not (employee->>'enabled')::boolean then continue; end if;
  rate:=coalesce(nullif(employee->line.item_type::text,'null'::jsonb),nullif(policy.policy->line.item_type::text,'null'::jsonb));
  if rate is null then continue; end if;
  -- Recheck the live fulfillment identity at finalization. Stale attribution
  -- yields no earning and must never fail ordinary checkout.
  if line.item_type='service' and line.appointment_id is not null and not exists(select 1 from public.appointments a where a.id=line.appointment_id
   and a.shop_id=new.shop_id and a.sale_id=new.id and a.service_id=line.service_id and a.location_id=new.location_id
   and a.assigned_membership_id=line.membership_id and a.status not in('cancelled','no_show') and line.quantity=1) then continue; end if;
  insert into public.commission_snapshots(shop_id,invoice_id,line_id,membership_id,employee_profile_id,employee_name,
   appointment_id,item_type,policy_version_id,rate_type,rate,currency,quantity,net_line_amount,original_commission)
  values(new.shop_id,new.id,line.id,line.membership_id,line.profile_id,line.employee_name,line.appointment_id,line.item_type::text,
   policy.id,rate->>'type',(rate->>'rate')::numeric,new.currency,line.quantity,line.commission_net_amount,
   round(case rate->>'type' when 'percentage' then line.commission_net_amount*(rate->>'rate')::numeric/100 else line.quantity*(rate->>'rate')::numeric end,2));
 end loop;
 perform shop_private.reconcile_commission(new.id);
 return new;
end; $$;

create or replace function shop_private.reconcile_commission(p_invoice_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.commission_snapshots%rowtype; paid boolean; refunded numeric; payable numeric;
 correction public.sale_corrections%rowtype;
begin
 perform 1 from public.invoices where id=p_invoice_id for update;
 select * into correction from public.sale_corrections c where c.invoice_id=p_invoice_id;
 -- invoice_outstanding also returns zero for a void/return. Closure is not
 -- proof of payment, and a corrected sale can never create a new earning.
 select correction.id is null and shop_private.invoice_outstanding(p_invoice_id)=0,total_amount
 into paid,payable from public.invoices where id=p_invoice_id and status='issued';
 for s in select * from public.commission_snapshots where invoice_id=p_invoice_id order by id loop
  if paid and not exists(select 1 from public.appointments a where a.id=s.appointment_id and a.status in('cancelled','no_show')) and (s.item_type='product' or (shop_private.service_completed_quantity(s.line_id)>=s.quantity
   and (s.appointment_id is null or exists(select 1 from public.appointments a where a.id=s.appointment_id
    and a.shop_id=s.shop_id and a.sale_id=s.invoice_id and a.assigned_membership_id=s.membership_id and a.status='completed')))) then
   insert into public.commission_events(snapshot_id,kind,event_key,amount,reason)
   values(s.id,'earned','earned',s.original_commission,'Fully paid and fulfilled') on conflict do nothing;
  end if;
  select coalesce(sum(a.amount),0) into refunded from public.customer_payment_adjustments a
   join public.customer_payment_allocations alloc on alloc.id=a.original_allocation_id where alloc.invoice_id=p_invoice_id;
  if exists(select 1 from public.appointments a where a.id=s.appointment_id and a.status in('cancelled','no_show')) then
   perform shop_private.adjust_commission_return(s.id,'appointment-cancellation',s.net_line_amount,s.quantity,'Appointment cancelled');
  elsif correction.id is not null then
   perform shop_private.adjust_commission_return(s.id,'sale-correction:'||correction.id::text,
    s.net_line_amount,s.quantity,correction.reason);
  elsif refunded>0 then
   -- The helper also considers payment adjustments; zero inputs here preserve
   -- the common cumulative money/quantity contract without changing refunds.
   perform shop_private.adjust_commission_return(s.id,'financial:'||refunded::text,0,0,'Customer payment refund or reversal');
  end if;
 end loop;
end; $$;

create function shop_private.service_appointment_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare line uuid; matches integer; f public.service_fulfillments%rowtype; req uuid;
begin
 if new.status='completed' and old.status<>'completed' then
  select * into f from public.service_fulfillments where appointment_id=new.id;
  if not found then
   if new.sale_id is not null then
    select count(*),(array_agg(id order by id))[1] into matches,line from public.invoice_items
     where invoice_id=new.sale_id and shop_id=new.shop_id and item_type='service' and service_id=new.service_id;
    if matches<>1 then raise exception 'APPOINTMENT_SERVICE_LINE_AMBIGUOUS' using errcode='23514';end if;
   end if;
   req:=nullif(current_setting('shop.appointment_request_id',true),'')::uuid;
   perform shop_private.complete_service(req,new.shop_id,new.location_id,line,1,new.id,null,'Appointment performed',true);
  end if;
 elsif new.sale_id is not null and old.sale_id is null then
  select * into f from public.service_fulfillments where appointment_id=new.id and line_id is null;
  if found then
   select count(*),(array_agg(id order by id))[1] into matches,line from public.invoice_items
    where invoice_id=new.sale_id and shop_id=new.shop_id and item_type='service' and service_id=new.service_id;
   if matches<>1 or shop_private.service_completed_quantity(line)+f.quantity>(select quantity from public.invoice_items where id=line) then
    raise exception 'APPOINTMENT_SERVICE_LINE_AMBIGUOUS' using errcode='23514';end if;
   insert into public.service_fulfillment_sale_links(fulfillment_id,shop_id,line_id,actor_profile_id)
   values(f.id,new.shop_id,line,shop_private.assert_shop_write_access(new.shop_id,'sales.manage'));
   perform shop_private.reconcile_commission(new.sale_id);
  end if;
 end if;
 return new;
end;$$;
revoke all on function shop_private.service_appointment_completion() from public,anon,authenticated,service_role;
-- Runs before commission notification. Failure rolls back status and all consumption.
create trigger aa_service_appointment_completion after update of status,sale_id on public.appointments
 for each row execute function shop_private.service_appointment_completion();

-- Invoice precedes appointment locks, matching complete_service and payment paths.
create or replace function public.transition_appointment(p_request_id uuid,p_shop_id uuid,p_appointment_id uuid,p_status text,p_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform shop_private.appointment_actor_profile(p_shop_id,'appointments.manage');
 perform 1 from public.invoices i join public.appointments a on a.sale_id=i.id and a.shop_id=i.shop_id
  where a.id=p_appointment_id and a.shop_id=p_shop_id for update of i;
 return shop_private.transition_appointment(p_request_id,p_shop_id,p_appointment_id,p_status,p_reason);
end;$$;
create or replace function public.link_appointment_sale(p_request_id uuid,p_shop_id uuid,p_appointment_id uuid,p_sale_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform shop_private.appointment_actor_profile(p_shop_id,'appointments.manage');
 perform 1 from public.invoices where id=p_sale_id and shop_id=p_shop_id for update;
 return shop_private.link_appointment_sale(p_request_id,p_shop_id,p_appointment_id,p_sale_id);
end;$$;

create function public.service_fulfillment_context(p_shop_id uuid,p_location_id uuid,p_invoice_id uuid default null,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare page_ids uuid[]; total bigint;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_invoice_id is not null and not exists(select 1 from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id) then
  raise exception 'SERVICE_SALE_NOT_FOUND' using errcode='P0002';end if;
 select count(*) into total from public.service_fulfillments f left join public.service_fulfillment_sale_links l on l.fulfillment_id=f.id
  join public.invoice_items i on i.id=coalesce(f.line_id,l.line_id) where i.invoice_id=p_invoice_id and f.shop_id=p_shop_id;
 select array_agg(id) into page_ids from (select f.id from public.service_fulfillments f
  left join public.service_fulfillment_sale_links l on l.fulfillment_id=f.id join public.invoice_items i on i.id=coalesce(f.line_id,l.line_id)
  where i.invoice_id=p_invoice_id and f.shop_id=p_shop_id order by f.completed_at desc,f.id desc limit 50 offset greatest(0,coalesce(p_offset,0)))paged;
 return jsonb_build_object('totalCount',total,'lines',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.item_name,'quantity',i.quantity,
  'completedQuantity',shop_private.service_completed_quantity(i.id),
  'history',coalesce((select jsonb_agg(to_jsonb(f) || jsonb_build_object('allocations',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('corrections',(select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at,x.id),'[]') from public.service_material_corrections x where x.consumption_id=c.id))),'[]')
    from public.service_material_consumptions c where c.fulfillment_id=f.id)) order by f.completed_at,f.id)
   from public.service_fulfillments f left join public.service_fulfillment_sale_links l on l.fulfillment_id=f.id
   where coalesce(f.line_id,l.line_id)=i.id and f.id=any(page_ids)),'[]')) order by i.line_order,i.id)
  from public.invoice_items i join public.invoices sale on sale.id=i.invoice_id
  where i.shop_id=p_shop_id and sale.location_id=p_location_id and sale.id=p_invoice_id and i.item_type='service'),'[]'));
end;$$;
revoke all on function public.service_fulfillment_context(uuid,uuid,uuid,integer) from public,anon;
grant execute on function public.service_fulfillment_context(uuid,uuid,uuid,integer) to authenticated;

create function public.service_recipe_context(p_shop_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform shop_private.commission_manager(p_shop_id);
 return jsonb_build_object('services',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id)
  from public.services where shop_id=p_shop_id and is_active),'[]'),
  'materials',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'unit',u.unit,
   'canDefineUnit',not exists(select 1 from public.inventory_batches b where b.product_id=p.id)) order by p.name,p.id)
   from public.products p left join public.service_material_units u on u.product_id=p.id where p.shop_id=p_shop_id and p.is_active),'[]'),
  'totalCount',(select count(*) from public.service_recipe_versions where shop_id=p_shop_id),
  'versions',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.id desc) from
   (select * from public.service_recipe_versions where shop_id=p_shop_id order by created_at desc,id desc limit 50 offset greatest(0,coalesce(p_offset,0)))v),'[]'));
end;$$;
revoke all on function public.service_recipe_context(uuid,integer) from public,anon;
grant execute on function public.service_recipe_context(uuid,integer) to authenticated;

create table public.service_material_corrections (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,consumption_id uuid not null references public.service_material_consumptions(id),
 request_id uuid not null,quantity numeric(12,2) not null check(quantity>0),reason text not null,
 actor_profile_id uuid not null references public.profiles(id),movement_id uuid not null references public.inventory_movements(id),
 created_at timestamptz not null default clock_timestamp(),unique(shop_id,request_id)
);
create index service_material_corrections_consumption on public.service_material_corrections(consumption_id);
alter table public.service_material_corrections enable row level security;
revoke all on public.service_material_corrections from public,anon,authenticated;
grant select,insert on public.service_material_corrections to service_role;
create trigger service_history_immutable before update or delete on public.service_material_corrections
 for each row execute function shop_private.commission_immutable();
create function public.correct_service_material(p_request_id uuid,p_shop_id uuid,p_consumption_id uuid,p_quantity numeric,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; c public.service_material_consumptions%rowtype; f public.service_fulfillments%rowtype;
 old public.service_material_corrections%rowtype; result uuid:=gen_random_uuid(); movement uuid;
begin
 actor:=shop_private.commission_manager(p_shop_id);
 perform shop_private.assert_period_is_open(p_shop_id,clock_timestamp());
 select * into c from public.service_material_consumptions where id=p_consumption_id and shop_id=p_shop_id;
 if not found then raise exception 'SERVICE_CONSUMPTION_NOT_FOUND' using errcode='P0002';end if;
 select * into f from public.service_fulfillments where id=c.fulfillment_id;
 perform shop_private.assert_location_access(p_shop_id,f.location_id,true);
 if p_request_id is null or p_quantity is null or p_quantity<=0 or round(p_quantity,2)<>p_quantity
  or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then raise exception 'INVALID_SERVICE_CORRECTION' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('service-correction:'||p_shop_id::text||':'||p_request_id::text,0));
 select * into old from public.service_material_corrections where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if old.consumption_id<>p_consumption_id or old.quantity<>p_quantity or old.reason<>btrim(p_reason) or old.actor_profile_id<>actor then
   raise exception 'SERVICE_REQUEST_CONFLICT' using errcode='23505';end if;
  return old.id;
 end if;
 perform 1 from public.products where id=c.product_id and shop_id=p_shop_id for update;
 if p_quantity+coalesce((select sum(quantity) from public.service_material_corrections where consumption_id=c.id),0)>c.quantity then
  raise exception 'SERVICE_CORRECTION_EXCEEDS_CONSUMPTION' using errcode='23514';end if;
 update public.inventory_batches set remaining_quantity=remaining_quantity+p_quantity
  where id=c.batch_id and shop_id=p_shop_id and location_id=f.location_id;
 if not found then raise exception 'SERVICE_BATCH_NOT_FOUND' using errcode='23514';end if;
 insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,
  created_by_profile_id,unit_cost_snapshot)
 values(p_shop_id,f.location_id,c.product_id,c.batch_id,p_quantity,'adjustment',result,actor,c.unit_cost) returning id into movement;
 insert into public.service_material_corrections(id,shop_id,consumption_id,request_id,quantity,reason,actor_profile_id,movement_id)
 values(result,p_shop_id,c.id,p_request_id,p_quantity,btrim(p_reason),actor,movement);
 return result;
end;$$;
revoke all on function public.correct_service_material(uuid,uuid,uuid,numeric,text) from public,anon;
grant execute on function public.correct_service_material(uuid,uuid,uuid,numeric,text) to authenticated;

create table public.service_completion_cancellations (
 shop_id uuid not null references public.shops(id),request_id uuid not null,payload jsonb not null,
 actor_profile_id uuid not null references public.profiles(id),resolution_request_id uuid not null,
 reason text not null,created_at timestamptz not null default clock_timestamp(),primary key(shop_id,request_id)
);
alter table public.service_completion_cancellations enable row level security;
revoke all on public.service_completion_cancellations from public,anon,authenticated;
grant select,insert on public.service_completion_cancellations to service_role;
create trigger service_history_immutable before update or delete on public.service_completion_cancellations
 for each row execute function shop_private.commission_immutable();
create function public.reconcile_service_completion(p_shop_id uuid,p_args jsonb,p_resolution_request_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; request uuid; payload jsonb; f public.service_fulfillments%rowtype; c public.service_completion_cancellations%rowtype;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 perform shop_private.assert_location_access(p_shop_id,(p_args->>'p_location_id')::uuid,true);
 request:=(p_args->>'p_request_id')::uuid;
 if p_shop_id is distinct from (p_args->>'p_shop_id')::uuid or request is null or p_resolution_request_id is null
  or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then raise exception 'INVALID_SERVICE_RECONCILIATION' using errcode='22023';end if;
 payload:=jsonb_build_array((p_args->>'p_line_id')::uuid,(p_args->>'p_location_id')::uuid,(p_args->>'p_quantity')::numeric,
  (p_args->>'p_appointment_id')::uuid,nullif(p_args->'p_materials','null'::jsonb),btrim(coalesce(p_args->>'p_reason','Service performed')));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('service:'||p_shop_id::text||':'||request::text,0));
 select * into f from public.service_fulfillments where shop_id=p_shop_id and request_id=request;
 if found then
  if f.actor_profile_id<>actor or f.payload<>payload then raise exception 'SERVICE_REQUEST_CONFLICT' using errcode='23505';end if;
  return jsonb_build_object('state','synced','invoiceId',f.id);
 end if;
 select * into c from public.service_completion_cancellations where shop_id=p_shop_id and request_id=request;
 if found then
  if c.actor_profile_id<>actor or c.payload<>payload then raise exception 'SERVICE_REQUEST_CONFLICT' using errcode='23505';end if;
  return jsonb_build_object('state','cancelled','resolutionRequestId',c.resolution_request_id);
 end if;
 insert into public.service_completion_cancellations(shop_id,request_id,payload,actor_profile_id,resolution_request_id,reason)
 values(p_shop_id,request,payload,actor,p_resolution_request_id,btrim(p_reason));
 return jsonb_build_object('state','cancelled','resolutionRequestId',p_resolution_request_id);
end;$$;
revoke all on function public.reconcile_service_completion(uuid,jsonb,uuid,text) from public,anon;
grant execute on function public.reconcile_service_completion(uuid,jsonb,uuid,text) to authenticated;
