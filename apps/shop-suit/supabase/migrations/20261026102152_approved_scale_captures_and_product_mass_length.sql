begin;
-- Optional, manager-approved metadata. Existing stock/financial ledgers remain
-- authoritative; neither profiles nor conversions hold an inventory balance.
create table public.scale_profiles(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),location_id uuid not null,
 label text not null check(length(btrim(label)) between 1 and 120),model text not null check(length(btrim(model)) between 1 and 120),
 serial_number text not null check(length(btrim(serial_number)) between 1 and 64 and serial_number ~ '^[ -~]+$' and serial_number!~ '["\\[:cntrl:]]'),
 protocol text not null default 'mt-sics-0-1' check(protocol='mt-sics-0-1'),serial_options jsonb not null,
 evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 500),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default clock_timestamp(),
 active boolean not null default false,revision integer not null default 1 check(revision>0),
 unique(id,shop_id,location_id),unique(shop_id,location_id,serial_number),foreign key(location_id,shop_id) references public.shop_locations(id,shop_id)
);
create table public.product_mass_length_factors(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,product_id uuid not null,
 base_unit_code text not null references public.units_of_measure(code),measurement_revision integer not null,
 kg_per_base_unit numeric(24,12) not null check(kg_per_base_unit>0 and kg_per_base_unit<=1000000),
 evidence_reference text not null check(length(btrim(evidence_reference)) between 3 and 500),
 approved_by uuid not null references public.profiles(id),approved_at timestamptz not null default clock_timestamp(),
 active boolean not null default false,revision integer not null default 1 check(revision>0),
 unique(id,shop_id,location_id),unique(shop_id,location_id,product_id),foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),
 foreign key(product_id,shop_id) references public.products(id,shop_id)
);
create table public.weighing_setup_events(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,kind text not null check(kind in('device','factor')),
 record_id uuid not null,revision integer not null,snapshot jsonb not null,reason text not null check(length(btrim(reason)) between 3 and 500),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id)
);
create index weighing_setup_history on public.weighing_setup_events(shop_id,location_id,kind,record_id,created_at desc,id);
create table shop_private.weighing_setup_requests(
 shop_id uuid not null,request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),payload jsonb not null,result jsonb,
 primary key(shop_id,request_id)
);
create table public.scale_captures(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,request_id uuid not null,
 actor_profile_id uuid not null references public.profiles(id),product_id uuid not null,measurement_revision integer not null,
 device_id uuid not null,device_revision integer not null,factor_id uuid,factor_revision integer,
 base_quantity numeric(18,6) not null check(base_quantity>0 and base_quantity<=1000000),base_unit_code text not null,
 snapshot jsonb not null,payload jsonb not null,created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 -- Retain the first assignment even if an ordinary, unissued draft is deleted.
 -- The trigger verifies its tenant/location; a deleted draft never frees a capture.
 invoice_id uuid,unique(shop_id,request_id),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),foreign key(product_id,shop_id) references public.products(id,shop_id),
 foreign key(device_id,shop_id,location_id) references public.scale_profiles(id,shop_id,location_id),
 foreign key(factor_id,shop_id,location_id) references public.product_mass_length_factors(id,shop_id,location_id),
 check((factor_id is null)=(factor_revision is null))
);
create index scale_capture_directory on public.scale_captures(shop_id,location_id,actor_profile_id,created_at desc,id);
do $$declare t text;begin
 foreach t in array array['scale_profiles','product_mass_length_factors','weighing_setup_events','scale_captures'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create policy weighing_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
revoke all on shop_private.weighing_setup_requests from public,anon,authenticated,service_role;
create trigger weighing_setup_history_immutable before update or delete on public.weighing_setup_events for each row execute function shop_private.measurement_history_immutable();

create function shop_private.validate_scale_options(p_options jsonb) returns void language plpgsql immutable set search_path='' as $$begin
 if jsonb_typeof(p_options) is distinct from 'object' or (p_options-array['baudRate','dataBits','stopBits','parity','flowControl'])<>'{}'
 or jsonb_typeof(p_options->'baudRate') is distinct from 'number' or p_options->>'baudRate' not in('1200','2400','4800','9600','19200','38400','57600','115200')
 or jsonb_typeof(p_options->'dataBits') is distinct from 'number' or p_options->>'dataBits' not in('7','8')
 or jsonb_typeof(p_options->'stopBits') is distinct from 'number' or p_options->>'stopBits' not in('1','2')
 or p_options->>'parity' is null or p_options->>'parity' not in('none','even','odd')
 or p_options->>'flowControl' is null or p_options->>'flowControl' not in('none','hardware') then raise exception 'INVALID_SCALE_OPTIONS' using errcode='22023';end if;
end;$$;
revoke all on function shop_private.validate_scale_options(jsonb) from public,anon,authenticated,service_role;

create function public.weighing_setup_command(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_kind text,p_id uuid,p_revision integer,p_values jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;request shop_private.weighing_setup_requests%rowtype;payload jsonb;v_result jsonb;previous jsonb;v_record_id uuid:=coalesce(p_id,gen_random_uuid());
 device public.scale_profiles%rowtype;factor public.product_mass_length_factors%rowtype;product public.products%rowtype;enabled boolean;kg numeric;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'products.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_kind is null or p_kind not in('device','factor') or p_request_id is null or p_revision is null or p_revision<0 or p_id is null and p_revision<>0
 or jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_values->'active') is distinct from 'boolean'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 500 or p_values->>'evidenceReference' is null or length(btrim(p_values->>'evidenceReference')) not between 3 and 500
 or jsonb_typeof(p_values->'confirmed') is distinct from 'boolean' or (p_values->>'active')::boolean and not (p_values->>'confirmed')::boolean then raise exception 'INVALID_WEIGHING_APPROVAL' using errcode='22023';end if;
 enabled:=(p_values->>'active')::boolean;
 if enabled and not exists(select 1 from public.shops where id=p_shop_id and business_mode in('product','mixed')) then raise exception 'BUSINESS_MODE_PRODUCT_DISABLED' using errcode='23514';end if;
 payload:=jsonb_build_array(p_location_id,p_kind,p_id,p_revision,p_values,btrim(p_reason));
 insert into shop_private.weighing_setup_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.weighing_setup_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'WEIGHING_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 if p_kind='device' then
  if (p_values-array['active','confirmed','evidenceReference','label','model','serialNumber','serialOptions'])<>'{}' or p_values->>'label' is null or p_values->>'model' is null or p_values->>'serialNumber' is null then raise exception 'INVALID_SCALE_PROFILE' using errcode='22023';end if;
  perform shop_private.validate_scale_options(p_values->'serialOptions');
  select * into device from public.scale_profiles where scale_profiles.id=p_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if p_id is not null and (device.id is null or device.revision<>p_revision) then raise exception 'WEIGHING_CONTEXT_CHANGED' using errcode='55000';end if;
  if p_id is null then
   if (select count(*) from public.scale_profiles where shop_id=p_shop_id and location_id=p_location_id)>=50 then raise exception 'SCALE_PROFILE_LIMIT' using errcode='54000';end if;
   insert into public.scale_profiles(id,shop_id,location_id,label,model,serial_number,serial_options,evidence_reference,approved_by,active)
    values(v_record_id,p_shop_id,p_location_id,btrim(p_values->>'label'),btrim(p_values->>'model'),btrim(p_values->>'serialNumber'),p_values->'serialOptions',btrim(p_values->>'evidenceReference'),actor,enabled) returning * into device;
  else
   previous:=to_jsonb(device);
   update public.scale_profiles set label=btrim(p_values->>'label'),model=btrim(p_values->>'model'),serial_number=btrim(p_values->>'serialNumber'),serial_options=p_values->'serialOptions',
    evidence_reference=btrim(p_values->>'evidenceReference'),approved_by=actor,approved_at=clock_timestamp(),active=enabled,revision=revision+1 where scale_profiles.id=v_record_id returning * into device;
  end if;
  v_result:=to_jsonb(device);
 else
  if (p_values-array['active','confirmed','evidenceReference','productId','kgPerBaseUnit','measurementRevision','baseUnitCode'])<>'{}' or p_values->>'productId' is null or p_values->>'kgPerBaseUnit' is null
   or p_values->>'kgPerBaseUnit'!~ '^[0-9]{1,7}(\.[0-9]{1,12})?$' then raise exception 'INVALID_MASS_LENGTH_FACTOR' using errcode='22023';end if;
  kg:=(p_values->>'kgPerBaseUnit')::numeric;if kg<=0 or kg>1000000 then raise exception 'INVALID_MASS_LENGTH_FACTOR' using errcode='22023';end if;
  select * into factor from public.product_mass_length_factors where product_mass_length_factors.id=p_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if p_id is not null and (factor.id is null or factor.revision<>p_revision or factor.product_id::text<>p_values->>'productId') then raise exception 'WEIGHING_CONTEXT_CHANGED' using errcode='55000';end if;
  select * into product from public.products where products.id=(p_values->>'productId')::uuid and shop_id=p_shop_id;
  if not found or (enabled or p_id is null) and (not product.is_active or product.measurement_status<>'active'
   or not exists(select 1 from public.units_of_measure where code=product.base_unit_code and dimension='length' and is_active)
   or shop_private.is_reel_tracked(p_shop_id,product.id)) then raise exception 'MASS_LENGTH_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
  if (enabled or p_id is null) and (jsonb_typeof(p_values->'measurementRevision') is distinct from 'number' or p_values->>'measurementRevision' is distinct from product.measurement_revision::text or p_values->>'baseUnitCode' is distinct from product.base_unit_code) then raise exception 'MASS_LENGTH_MEASUREMENT_CHANGED' using errcode='55000';end if;
  if p_id is null then
   insert into public.product_mass_length_factors(id,shop_id,location_id,product_id,base_unit_code,measurement_revision,kg_per_base_unit,evidence_reference,approved_by,active)
    values(v_record_id,p_shop_id,p_location_id,product.id,product.base_unit_code,product.measurement_revision,kg,btrim(p_values->>'evidenceReference'),actor,enabled) returning * into factor;
  else
   previous:=to_jsonb(factor)||jsonb_build_object('kg_per_base_unit',trim_scale(factor.kg_per_base_unit)::text);
   update public.product_mass_length_factors set base_unit_code=case when enabled then product.base_unit_code else factor.base_unit_code end,
    measurement_revision=case when enabled then product.measurement_revision else factor.measurement_revision end,kg_per_base_unit=kg,
    evidence_reference=btrim(p_values->>'evidenceReference'),approved_by=actor,approved_at=clock_timestamp(),active=enabled,revision=revision+1
    where product_mass_length_factors.id=v_record_id returning * into factor;
  end if;
  v_result:=to_jsonb(factor)||jsonb_build_object('kg_per_base_unit',trim_scale(factor.kg_per_base_unit)::text,'product_name',product.name);
 end if;
 insert into public.weighing_setup_events(shop_id,location_id,kind,record_id,revision,snapshot,reason,actor_profile_id)
 values(p_shop_id,p_location_id,p_kind,v_record_id,(v_result->>'revision')::integer,jsonb_build_object('previous',previous,'current',v_result),btrim(p_reason),actor);
 v_result:=jsonb_build_object('id',v_record_id,'kind',p_kind,'revision',(v_result->>'revision')::integer);
 update shop_private.weighing_setup_requests set result=v_result where shop_id=p_shop_id and request_id=p_request_id;return v_result;
end;$$;
revoke all on function public.weighing_setup_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.weighing_setup_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) to authenticated;

create function shop_private.scale_stock_quantity(p_shop uuid,p_location uuid,p_product uuid,p_net numeric,p_unit text,p_factor uuid default null,p_factor_revision integer default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare product public.products%rowtype;factor public.product_mass_length_factors%rowtype;target_dimension text;source_factor numeric;quantity numeric;factor_snapshot jsonb;begin
 select * into product from public.products where id=p_product and shop_id=p_shop and is_active;
 if not found or product.measurement_status<>'active' or shop_private.is_reel_tracked(p_shop,p_product) or p_net is null or p_net<=0 or round(p_net,6)<>p_net or p_unit not in('kg','g') then raise exception 'SCALE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
 select u.dimension into target_dimension from public.units_of_measure u where code=product.base_unit_code and is_active;
 if target_dimension='mass' then
  if p_factor is not null or p_factor_revision is not null then raise exception 'UNEXPECTED_MASS_LENGTH_FACTOR' using errcode='22023';end if;
  quantity:=shop_private.convert_measurement(p_net,p_unit,product.base_unit_code,product.quantity_increment);
 elsif target_dimension='length' then
  select * into factor from public.product_mass_length_factors where id=p_factor and shop_id=p_shop and location_id=p_location and product_id=p_product and active;
  if not found or factor.revision is distinct from p_factor_revision or factor.base_unit_code<>product.base_unit_code or factor.measurement_revision<>product.measurement_revision then raise exception 'APPROVED_MASS_LENGTH_REQUIRED' using errcode='55000';end if;
  select canonical_conversion_factor into source_factor from public.units_of_measure where code=p_unit and dimension='mass' and is_active;
  quantity:=p_net*source_factor/factor.kg_per_base_unit;
  -- Check the original ratio, not just the rounded result of numeric division.
  if round(quantity,6)*factor.kg_per_base_unit<>p_net*source_factor then raise exception 'UNREPRESENTABLE_MEASUREMENT_QUANTITY' using errcode='22023';end if;
  quantity:=shop_private.convert_measurement(quantity,product.base_unit_code,product.base_unit_code,product.quantity_increment);
  factor_snapshot:=jsonb_build_object('id',factor.id,'revision',factor.revision,'active',factor.active,'productId',factor.product_id,'baseUnitCode',factor.base_unit_code,'measurementRevision',factor.measurement_revision,
   'kgPerBaseUnit',trim_scale(factor.kg_per_base_unit)::text,'evidenceReference',factor.evidence_reference,'approvedBy',factor.approved_by,'approvedAt',factor.approved_at);
 else raise exception 'APPROVED_MASS_LENGTH_REQUIRED' using errcode='55000';end if;
 perform shop_private.assert_measured_quantity(p_shop,p_product,quantity);
 return jsonb_build_object('quantity',trim_scale(quantity)::text,'unitCode',product.base_unit_code,'measurementRevision',product.measurement_revision,'factor',factor_snapshot);
end;$$;
revoke all on function shop_private.scale_stock_quantity(uuid,uuid,uuid,numeric,text,uuid,integer) from public,anon,authenticated,service_role;

create function shop_private.parse_sics_weight(p_frame text,p_command text) returns jsonb language plpgsql immutable set search_path='' as $$
declare parts text[];field text;value numeric;begin
 if p_command is null or p_command not in('S','TA','T') or p_frame is null or length(p_frame)>128 or p_frame!~ E'^[ -~]+\r\n$' then raise exception 'SCALE_INVALID_FRAME' using errcode='22023';end if;
 parts:=regexp_match(left(p_frame,length(p_frame)-2),'^(S|TA|T) ([SAD]) (.{10}) ([A-Za-z]+)$');
 if parts is null or parts[1]<>p_command or parts[2]<>(case when p_command='TA' then 'A' else 'S' end) then raise exception 'SCALE_STABLE_READING_REQUIRED' using errcode='22023';end if;
 field:=ltrim(parts[3]);if field!~ '^-?[0-9]{1,10}(\.[0-9]{1,6})?$' or parts[4] not in('kg','g') then raise exception 'SCALE_UNSUPPORTED_READING' using errcode='22023';end if;
 value:=field::numeric;
 return jsonb_build_object('value',trim_scale(value)::text,'unit',parts[4]);
end;$$;
revoke all on function shop_private.parse_sics_weight(text,text) from public,anon,authenticated,service_role;

create function shop_private.scale_counter_item(p_shop uuid,p_location uuid,p_product uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',p.id,'name',p.name,'itemType','product','sku',p.sku,'barcode',p.barcode,'unitPrice',p.sale_price,'discount',0,
  'stock',greatest(coalesce((select sum(b.remaining_quantity) from public.inventory_batches b where b.shop_id=p_shop and b.location_id=p_location and b.product_id=p.id),0)
    -coalesce((select sum(r.remaining_quantity) from public.trade_order_reservations r where r.shop_id=p_shop and r.location_id=p_location and r.product_id=p.id and r.status='active' and r.expires_at>statement_timestamp()),0),0),
  'measurement',shop_private.pos_measurement(p_shop,p.id))
 from public.products p join public.units_of_measure u on u.code=p.base_unit_code and u.is_active
 where p.id=p_product and p.shop_id=p_shop and exists(select 1 from public.shops where id=p_shop and business_mode in('product','mixed')) and p.is_active and p.measurement_status='active' and not shop_private.is_reel_tracked(p_shop,p.id)
 and (u.dimension='mass' or u.dimension='length' and exists(select 1 from public.product_mass_length_factors f where f.shop_id=p_shop and f.location_id=p_location and f.product_id=p.id and f.active and f.measurement_revision=p.measurement_revision and f.base_unit_code=p.base_unit_code));
$$;
revoke all on function shop_private.scale_counter_item(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.record_scale_capture(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_product_id uuid,p_device_id uuid,p_device_revision integer,p_reading jsonb,p_factor_id uuid default null,p_factor_revision integer default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;device public.scale_profiles%rowtype;captured public.scale_captures%rowtype;payload jsonb;before jsonb;net jsonb;after jsonb;resolved jsonb;snapshot jsonb;item jsonb;read_at timestamptz;capture_id uuid:=gen_random_uuid();captured_at timestamptz;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_product_id is null or p_device_id is null or p_device_revision is null or jsonb_typeof(p_reading) is distinct from 'object'
  or (p_reading-array['tareBefore','stable','tareAfter','serial','readAt','confirmed'])<>'{}' or p_reading->'confirmed' is distinct from 'true'::jsonb then raise exception 'INVALID_SCALE_CAPTURE' using errcode='22023';end if;
 payload:=jsonb_build_array(p_location_id,p_product_id,p_device_id,p_device_revision,p_reading,p_factor_id,p_factor_revision);
 select * into captured from public.scale_captures where shop_id=p_shop_id and request_id=p_request_id for update;
 if found then
  if captured.actor_profile_id<>actor or captured.payload<>payload then raise exception 'SCALE_CAPTURE_REQUEST_CONFLICT' using errcode='23505';end if;
  return jsonb_build_object('id',captured.id,'quantity',trim_scale(captured.base_quantity)::text,'unitCode',captured.base_unit_code,'snapshot',captured.snapshot,'createdAt',captured.created_at);
 end if;
 if jsonb_typeof(p_reading->'tareBefore') is distinct from 'string' or jsonb_typeof(p_reading->'stable') is distinct from 'string'
  or jsonb_typeof(p_reading->'tareAfter') is distinct from 'string' or jsonb_typeof(p_reading->'serial') is distinct from 'string'
  or jsonb_typeof(p_reading->'readAt') is distinct from 'string' or p_reading->>'readAt'!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$' then raise exception 'INVALID_SCALE_CAPTURE' using errcode='22023';end if;
 read_at:=(p_reading->>'readAt')::timestamptz;
 if read_at<clock_timestamp()-interval '30 seconds' or read_at>clock_timestamp()+interval '5 seconds' then raise exception 'SCALE_READING_EXPIRED' using errcode='55000';end if;
 select * into device from public.scale_profiles where id=p_device_id and shop_id=p_shop_id and location_id=p_location_id and active for share;
 if not found or device.revision<>p_device_revision or device.serial_number is distinct from p_reading->>'serial' then raise exception 'SCALE_DEVICE_CONTEXT_CHANGED' using errcode='55000';end if;
 before:=shop_private.parse_sics_weight(p_reading->>'tareBefore','TA');net:=shop_private.parse_sics_weight(p_reading->>'stable','S');after:=shop_private.parse_sics_weight(p_reading->>'tareAfter','TA');
 if before->>'value' is distinct from after->>'value' or before->>'unit' is distinct from net->>'unit' or after->>'unit' is distinct from net->>'unit'
  or (before->>'value')::numeric<0 or (net->>'value')::numeric<=0 then raise exception 'SCALE_TARE_OR_UNIT_CHANGED' using errcode='22023';end if;
 resolved:=shop_private.scale_stock_quantity(p_shop_id,p_location_id,p_product_id,(net->>'value')::numeric,net->>'unit',p_factor_id,p_factor_revision);
 item:=shop_private.scale_counter_item(p_shop_id,p_location_id,p_product_id);
 if item is null or (item->>'stock')::numeric<(resolved->>'quantity')::numeric then raise exception 'INSUFFICIENT_STOCK' using errcode='55000';end if;
 if (select count(*) from public.scale_captures where shop_id=p_shop_id and location_id=p_location_id and actor_profile_id=actor and invoice_id is null and expires_at>clock_timestamp())>=100 then raise exception 'UNUSED_SCALE_CAPTURE_LIMIT' using errcode='54000';end if;
 captured_at:=clock_timestamp();
 snapshot:=jsonb_build_object('id',capture_id,'capturedAt',captured_at,'kind','scale','protocol',device.protocol,'productId',p_product_id,'productRevision',(resolved->>'measurementRevision')::integer,
  'baseQuantity',resolved->>'quantity','baseUnitCode',resolved->>'unitCode','netQuantity',net->>'value','tareQuantity',before->>'value',
  'grossQuantity',trim_scale((net->>'value')::numeric+(before->>'value')::numeric)::text,'unitCode',net->>'unit','reading',p_reading,
  'device',jsonb_build_object('id',device.id,'revision',device.revision,'label',device.label,'model',device.model,'serial',device.serial_number,'serialOptions',device.serial_options,
   'evidenceReference',device.evidence_reference,'approvedBy',device.approved_by,'approvedAt',device.approved_at),'factor',resolved->'factor','actorProfileId',actor);
 insert into public.scale_captures(id,created_at,shop_id,location_id,request_id,actor_profile_id,product_id,measurement_revision,device_id,device_revision,factor_id,factor_revision,base_quantity,base_unit_code,snapshot,payload,expires_at)
 values(capture_id,captured_at,p_shop_id,p_location_id,p_request_id,actor,p_product_id,(resolved->>'measurementRevision')::integer,device.id,device.revision,p_factor_id,p_factor_revision,(resolved->>'quantity')::numeric,resolved->>'unitCode',snapshot,payload,clock_timestamp()+interval '1 hour') returning * into captured;
 return jsonb_build_object('id',captured.id,'quantity',trim_scale(captured.base_quantity)::text,'unitCode',captured.base_unit_code,'snapshot',snapshot,'createdAt',captured.created_at);
end;$$;
revoke all on function public.record_scale_capture(uuid,uuid,uuid,uuid,uuid,integer,jsonb,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.record_scale_capture(uuid,uuid,uuid,uuid,uuid,integer,jsonb,uuid,integer) to authenticated;

create function shop_private.resolve_scale_capture(p_shop uuid,p_product uuid,p_capture jsonb,p_quantity numeric) returns jsonb
language plpgsql stable set search_path='' as $$
declare captured public.scale_captures%rowtype;resolved jsonb;actor uuid;begin
 if jsonb_typeof(p_capture) is distinct from 'object' or (p_capture-array['kind','id'])<>'{}' or p_capture->>'kind' is distinct from 'scale' or jsonb_typeof(p_capture->'id') is distinct from 'string' then raise exception 'INVALID_SCALE_CAPTURE' using errcode='22023';end if;
 select * into captured from public.scale_captures where id=(p_capture->>'id')::uuid and shop_id=p_shop and product_id=p_product;
 if not found then raise exception 'SCALE_CAPTURE_NOT_FOUND' using errcode='55000';end if;
 if captured.invoice_id is null then
  select m.profile_id into actor from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=p_shop and m.status='active' and p.status='active' and p.user_id=auth.uid();
  if actor is distinct from captured.actor_profile_id then raise exception 'SCALE_CAPTURE_ACTOR_CHANGED' using errcode='42501';end if;
  if captured.expires_at<clock_timestamp() then raise exception 'SCALE_CAPTURE_EXPIRED' using errcode='55000';end if;
 end if;
 if not exists(select 1 from public.scale_profiles where id=captured.device_id and shop_id=p_shop and location_id=captured.location_id and active and revision=captured.device_revision) then raise exception 'SCALE_DEVICE_CONTEXT_CHANGED' using errcode='55000';end if;
 resolved:=shop_private.scale_stock_quantity(p_shop,captured.location_id,p_product,(captured.snapshot->>'netQuantity')::numeric,captured.snapshot->>'unitCode',captured.factor_id,captured.factor_revision);
 if (resolved->>'quantity')::numeric is distinct from p_quantity or captured.base_quantity is distinct from p_quantity or (resolved->>'measurementRevision')::integer<>captured.measurement_revision then raise exception 'SCALE_CAPTURE_QUANTITY_CHANGED' using errcode='55000';end if;
 return captured.snapshot;
end;$$;
revoke all on function shop_private.resolve_scale_capture(uuid,uuid,jsonb,numeric) from public,anon,authenticated,service_role;

create function public.get_scale_capture(p_shop_id uuid,p_location_id uuid,p_capture_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare captured public.scale_captures%rowtype;item jsonb;actor uuid;begin
 perform public.pos_catalog_search(p_shop_id=>p_shop_id,p_location_id=>p_location_id,p_page_size=>1);
 select m.profile_id into actor from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=p_shop_id and m.status='active' and p.status='active' and p.user_id=auth.uid();
 select * into captured from public.scale_captures where id=p_capture_id and shop_id=p_shop_id and location_id=p_location_id and actor_profile_id=actor;
 if not found then raise exception 'SCALE_CAPTURE_NOT_FOUND' using errcode='P0002';end if;
 perform shop_private.resolve_scale_capture(p_shop_id,captured.product_id,jsonb_build_object('kind','scale','id',captured.id),captured.base_quantity);
 if captured.invoice_id is not null then raise exception 'SCALE_CAPTURE_ALREADY_ASSIGNED' using errcode='55000';end if;
 item:=shop_private.scale_counter_item(p_shop_id,p_location_id,captured.product_id);if item is null then raise exception 'SCALE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
 return jsonb_build_object('item',item,'id',captured.id,'quantity',trim_scale(captured.base_quantity)::text,'unitCode',captured.base_unit_code,'availableQuantity',trim_scale((item->>'stock')::numeric)::text,'snapshot',captured.snapshot);
end;$$;
revoke all on function public.get_scale_capture(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_scale_capture(uuid,uuid,uuid) to authenticated;

create function public.scale_counter_context(p_shop_id uuid,p_location_id uuid,p_search text default null,p_page integer default 1,p_product_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare profiles jsonb;items jsonb;total bigint;selected jsonb;factor jsonb;begin
 perform public.pos_catalog_search(p_shop_id=>p_shop_id,p_location_id=>p_location_id,p_page_size=>1);
 if p_page is null or p_page<1 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_SCALE_QUERY' using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'label',s.label,'model',s.model,'serialNumber',s.serial_number,'serialOptions',s.serial_options,'protocol',s.protocol,'revision',s.revision) order by s.label,s.id),'[]') into profiles
 from public.scale_profiles s where shop_id=p_shop_id and location_id=p_location_id and active;
 with eligible as (
  select p.id,p.name,p.sku,p.base_unit_code from public.products p join public.units_of_measure u on u.code=p.base_unit_code and u.is_active
  where p.shop_id=p_shop_id and p.is_active and p.measurement_status='active' and not shop_private.is_reel_tracked(p_shop_id,p.id)
   and exists(select 1 from public.shops where id=p_shop_id and business_mode in('product','mixed'))
   and (u.dimension='mass' or u.dimension='length' and exists(select 1 from public.product_mass_length_factors f where f.shop_id=p_shop_id and f.location_id=p_location_id and f.product_id=p.id and f.active and f.measurement_revision=p.measurement_revision and f.base_unit_code=p.base_unit_code))
   and (nullif(btrim(p_search),'') is null or p.name ilike '%'||btrim(p_search)||'%' or p.sku ilike '%'||btrim(p_search)||'%')
 ),page as(select * from eligible order by lower(name),id offset (p_page-1)*20 limit 20)
 select (select count(*) from eligible),coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'sku',sku,'unitCode',base_unit_code) order by lower(name),id) from page),'[]') into total,items;
 if p_product_id is not null then
  selected:=shop_private.scale_counter_item(p_shop_id,p_location_id,p_product_id);
  if selected is null then raise exception 'SCALE_PRODUCT_UNAVAILABLE' using errcode='55000';end if;
  select jsonb_build_object('id',f.id,'revision',f.revision,'active',f.active,'productId',f.product_id,'baseUnitCode',f.base_unit_code,'measurementRevision',f.measurement_revision,'kgPerBaseUnit',trim_scale(f.kg_per_base_unit)::text,'evidenceReference',f.evidence_reference,'approvedAt',f.approved_at)
   into factor from public.product_mass_length_factors f where f.shop_id=p_shop_id and f.location_id=p_location_id and f.product_id=p_product_id and f.active and f.measurement_revision=(selected#>>'{measurement,revision}')::integer and f.base_unit_code=selected#>>'{measurement,baseUnitCode}';
 end if;
 return jsonb_build_object('profiles',profiles,'items',items,'total',total,'page',p_page,'pageSize',20,'selected',selected,'factor',factor,'canConfigure',shop_private.has_permission(p_shop_id,'products.manage'));
end;$$;
revoke all on function public.scale_counter_context(uuid,uuid,text,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.scale_counter_context(uuid,uuid,text,integer,uuid) to authenticated;

create function public.weighing_setup_context(p_shop_id uuid,p_location_id uuid,p_kind text default 'device',p_search text default null,p_page integer default 1,p_id uuid default null,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;record jsonb;history jsonb;history_total bigint;begin
 perform shop_private.assert_team_permission(p_shop_id,'products.manage');perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_kind is null or p_kind not in('device','factor') or p_page is null or p_page<1 or p_history_page is null or p_history_page<1 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_WEIGHING_QUERY' using errcode='22023';end if;
 if p_kind='device' then
  with eligible as(select * from public.scale_profiles where shop_id=p_shop_id and location_id=p_location_id and (nullif(btrim(p_search),'') is null or label ilike '%'||btrim(p_search)||'%' or model ilike '%'||btrim(p_search)||'%' or serial_number ilike '%'||btrim(p_search)||'%')),
   page as(select * from eligible order by label,id offset (p_page-1)*20 limit 20)
  select (select count(*) from eligible),coalesce((select jsonb_agg(to_jsonb(page) order by label,id) from page),'[]') into total,items;
  select to_jsonb(s) into record from public.scale_profiles s where shop_id=p_shop_id and location_id=p_location_id and id=p_id;
 else
  with eligible as(select f.*,p.name product_name,p.sku,p.measurement_revision current_measurement_revision from public.product_mass_length_factors f join public.products p on p.id=f.product_id and p.shop_id=f.shop_id
   where f.shop_id=p_shop_id and f.location_id=p_location_id and (nullif(btrim(p_search),'') is null or p.name ilike '%'||btrim(p_search)||'%' or p.sku ilike '%'||btrim(p_search)||'%')),
   page as(select * from eligible order by product_name,id offset (p_page-1)*20 limit 20)
  select (select count(*) from eligible),coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('kg_per_base_unit',trim_scale(kg_per_base_unit)::text) order by product_name,id) from page),'[]') into total,items;
  select to_jsonb(f)||jsonb_build_object('kg_per_base_unit',trim_scale(f.kg_per_base_unit)::text,'product_name',p.name,'sku',p.sku,'current_measurement_revision',p.measurement_revision) into record
   from public.product_mass_length_factors f join public.products p on p.id=f.product_id and p.shop_id=f.shop_id where f.shop_id=p_shop_id and f.location_id=p_location_id and f.id=p_id;
 end if;
 if p_id is not null and record is null then raise exception 'WEIGHING_RECORD_NOT_FOUND' using errcode='P0002';end if;
 select count(*) into history_total from public.weighing_setup_events where shop_id=p_shop_id and location_id=p_location_id and kind=p_kind and record_id=p_id;
 select coalesce(jsonb_agg(to_jsonb(e)||jsonb_build_object('actor_name',(select display_name from public.profiles where id=e.actor_profile_id)) order by e.created_at desc,e.id),'[]') into history
  from(select * from public.weighing_setup_events where shop_id=p_shop_id and location_id=p_location_id and kind=p_kind and record_id=p_id order by created_at desc,id offset (p_history_page-1)*20 limit 20)e;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'record',record,'history',history,'historyTotal',history_total,'historyPage',p_history_page,'canManage',true);
end;$$;
revoke all on function public.weighing_setup_context(uuid,uuid,text,text,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.weighing_setup_context(uuid,uuid,text,text,integer,uuid,integer) to authenticated;

create function shop_private.scale_capture_immutable() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'SCALE_CAPTURE_IMMUTABLE' using errcode='55000';end if;
 if (to_jsonb(new)-'invoice_id') is distinct from (to_jsonb(old)-'invoice_id') or old.invoice_id is not null and new.invoice_id is distinct from old.invoice_id then raise exception 'SCALE_CAPTURE_IMMUTABLE' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.scale_capture_immutable() from public,anon,authenticated,service_role;
create trigger scale_capture_immutable before update or delete on public.scale_captures for each row execute function shop_private.scale_capture_immutable();

create function shop_private.guard_invoice_scale_capture() returns trigger language plpgsql security definer set search_path='' as $$
declare captured public.scale_captures%rowtype;invoice public.invoices%rowtype;actor uuid;canonical jsonb;begin
 if tg_op='UPDATE' and row(new.shop_id,new.invoice_id,new.product_id,new.quantity,new.measurement_snapshot) is not distinct from row(old.shop_id,old.invoice_id,old.product_id,old.quantity,old.measurement_snapshot) then return new;end if;
 if new.measurement_snapshot#>>'{capture,kind}' is distinct from 'scale' then return new;end if;
 actor:=shop_private.assert_shop_write_access(new.shop_id,case when shop_private.has_permission(new.shop_id,'sales.issue') then 'sales.issue' else 'sales.manage' end);
 select * into invoice from public.invoices where id=new.invoice_id and shop_id=new.shop_id;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 perform shop_private.assert_location_access(new.shop_id,invoice.location_id,true);
 select * into captured from public.scale_captures where id=(new.measurement_snapshot#>>'{capture,id}')::uuid and shop_id=new.shop_id for update;
 if not found or captured.location_id<>invoice.location_id or captured.product_id is distinct from new.product_id or captured.invoice_id is not null and captured.invoice_id<>invoice.id then raise exception 'SCALE_CAPTURE_ALREADY_ASSIGNED' using errcode='55000';end if;
 if captured.invoice_id is null and captured.actor_profile_id<>actor then raise exception 'SCALE_CAPTURE_ACTOR_CHANGED' using errcode='42501';end if;
 canonical:=shop_private.resolve_scale_capture(new.shop_id,new.product_id,jsonb_build_object('kind','scale','id',captured.id),new.quantity);
 if canonical is distinct from new.measurement_snapshot->'capture' then raise exception 'SCALE_CAPTURE_EVIDENCE_CHANGED' using errcode='55000';end if;
 if exists(select 1 from public.invoice_items where invoice_id=invoice.id and id<>new.id and measurement_snapshot#>>'{capture,kind}'='scale' and measurement_snapshot#>>'{capture,id}'=captured.id::text) then raise exception 'DUPLICATE_SCALE_CAPTURE' using errcode='23505';end if;
 if captured.invoice_id is null then update public.scale_captures set invoice_id=invoice.id where id=captured.id;end if;
 return new;
end;$$;
revoke all on function shop_private.guard_invoice_scale_capture() from public,anon,authenticated,service_role;
create trigger scale_capture_invoice_guard before insert or update of shop_id,invoice_id,product_id,quantity,measurement_snapshot on public.invoice_items for each row execute function shop_private.guard_invoice_scale_capture();

-- A scale reading describes a physical counter sale, not a future promise.
-- Existing accepted agreements and all their original quantities remain intact.
alter table public.trade_quotation_versions add constraint scale_capture_counter_sale_only
 check(not jsonb_path_exists(snapshot,'$.lines[*].measurement.capture ? (@.kind == "scale")'));

-- Reviewed additive scale dispatch around the existing quantity/price kernel.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean)'::regprocedure) is distinct from 'b0fc02dfc87691d89fc85e3d5d4e8f90' then raise exception 'SCALE_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function shop_private.resolve_measured_line(p_shop uuid,p_product uuid,p_line jsonb,p_purchase boolean default false) returns jsonb
language plpgsql stable set search_path='' as $capture$
declare result jsonb;measurement jsonb;loss_text text:=coalesce(p_line->>'cutting_loss','0');loss numeric;split boolean;reel public.inventory_reels%rowtype;
 entered_price numeric;factor numeric;fixed_package boolean;begin
 result:=shop_private.resolve_measured_line_before_reels(p_shop,p_product,p_line,p_purchase);
 if p_line ? 'measurement_capture' then
  if p_purchase or result->'measurement' is null or result->'measurement'='null'::jsonb then raise exception 'WEIGHT_CAPTURE_NOT_ALLOWED' using errcode='22023';end if;
  measurement:=result->'measurement';
  measurement:=measurement||jsonb_build_object('capture',case when p_line#>>'{measurement_capture,kind}'='scale' then shop_private.resolve_scale_capture(p_shop,p_product,p_line->'measurement_capture',(result->>'baseQuantity')::numeric) else shop_private.resolve_weight_capture(p_shop,p_product,p_line->'measurement_capture',(result->>'baseQuantity')::numeric) end);
  result:=result||jsonb_build_object('measurement',measurement);
 end if;
 if p_purchase or not shop_private.is_reel_tracked(p_shop,p_product) then return result;end if;
 if loss_text !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' or (p_line ? 'allow_split' and jsonb_typeof(p_line->'allow_split')<>'boolean') then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 loss:=loss_text::numeric;split:=coalesce((p_line->>'allow_split')::boolean,false);
 if loss>0 then perform shop_private.assert_measured_quantity(p_shop,p_product,loss);end if;
 if loss>1000000 then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 measurement:=result->'measurement';
 if p_line->>'reel_id' is not null then
  select * into reel from public.inventory_reels where id=(p_line->>'reel_id')::uuid and shop_id=p_shop and product_id=p_product;
  if not found or reel.status not in('sealed','open') or reel.classification not in('sellable','discounted') then raise exception 'REEL_NOT_AVAILABLE' using errcode='55000';end if;
  fixed_package:=exists(select 1 from public.product_packagings where id=(measurement->>'packageId')::uuid and shop_id=p_shop and product_id=p_product and sale_price is not null);
  if reel.classification='discounted' and not fixed_package then
   factor:=(measurement->>'baseQuantity')::numeric/(measurement->>'enteredQuantity')::numeric;
   entered_price:=reel.remnant_price*factor;
   if round(entered_price,12)<>entered_price then raise exception 'MEASUREMENT_PRICE_PRECISION' using errcode='22023';end if;
   result:=result||jsonb_build_object('baseUnitPrice',reel.remnant_price,'lineTotal',round(reel.remnant_price*(measurement->>'baseQuantity')::numeric,2));
   measurement:=measurement||jsonb_build_object('enteredUnitPrice',trim_scale(entered_price)::text,'baseUnitPrice',trim_scale(reel.remnant_price)::text,'priceSource','reel_remnant');
  end if;
 end if;
 measurement:=measurement||jsonb_build_object('reelTracking',true,'reelId',reel.id,'allowSplit',split,'cuttingLoss',trim_scale(loss)::text,
  'reelReturnPolicy',(select reel_return_policy||jsonb_build_object('damagedRestock',false) from public.product_technical_profiles where shop_id=p_shop and product_id=p_product));
 if measurement->>'packageId' is not null and loss<>0 then raise exception 'INVALID_SEALED_REEL_SALE' using errcode='22023';end if;
 return result||jsonb_build_object('measurement',measurement);
end;$capture$;
revoke all on function shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

-- Reviewed additive scale dispatch around the existing quantity/price kernel.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.reprice_measured_invoice_line(uuid)'::regprocedure) is distinct from '09d1296d5550d2aa354fd6404aa19801' then raise exception 'SCALE_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function shop_private.reprice_measured_invoice_line(p_line_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $capture$declare p_line public.invoice_items%rowtype;m jsonb;r jsonb;customer uuid;input jsonb;frozen jsonb;begin
 select * into strict p_line from public.invoice_items where id=p_line_id;
 m:=p_line.measurement_snapshot;
 select client_id into customer from public.invoices where id=p_line.invoice_id and shop_id=p_line.shop_id;
 if m is null or m='null'::jsonb then
  input:=jsonb_build_object('quantity',trim_scale(p_line.quantity)::text);
 else
  input:=jsonb_strip_nulls(jsonb_build_object('quantity',m->>'enteredQuantity','unit_code',m->>'enteredUnitCode',
   'reel_id',m->'reelId','allow_split',m->'allowSplit','cutting_loss',m->'cuttingLoss','measurement_revision',m->'productRevision','package_id',m->'packageId','package_version',m->'packageVersion'));
 end if;
 if m ? 'capture' then input:=input||jsonb_build_object('measurement_capture',case when m#>>'{capture,kind}'='scale' then jsonb_build_object('kind','scale','id',m#>>'{capture,id}') else jsonb_build_object('kind',m#>>'{capture,kind}','id',m#>>'{capture,id}','raw',m#>>'{capture,raw}') end);end if;
 r:=shop_private.resolve_measured_line(p_line.shop_id,p_line.product_id,input);
 if (r->>'baseQuantity')::numeric<>p_line.quantity then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 frozen:=p_line.trade_pricing_snapshot;
 if frozen->>'source'='staff_override' then
  if frozen->>'currency' is distinct from (select business_currency from public.shops where id=p_line.shop_id) then raise exception 'PRICE_APPROVAL_CONTEXT_CHANGED' using errcode='55000';end if;
  -- The original manager approval is server-written draft history. Issuing
  -- staff need not reacquire product-management authority to honor that approval.
  if frozen->>'actorProfileId' is null or frozen->>'reason' is null then raise exception 'INVALID_PRICE_APPROVAL' using errcode='23514';end if;
  m:=r->'measurement';
  if m is not null and m<>'null'::jsonb then m:=m||jsonb_build_object('tradePricing',frozen,'baseUnitPrice',trim_scale(p_line.unit_price)::text,
   'enteredUnitPrice',trim_scale(p_line.unit_price*p_line.quantity/(m->>'enteredQuantity')::numeric)::text);end if;
  return r||jsonb_build_object('baseUnitPrice',p_line.unit_price,'lineTotal',round(p_line.quantity*p_line.unit_price,2),'measurement',m,'pricing',frozen);
 end if;
 return shop_private.apply_trade_price(p_line.shop_id,p_line.product_id,customer,input,r,(select sum(quantity) from public.invoice_items where invoice_id=p_line.invoice_id and product_id=p_line.product_id));
end;$capture$;
revoke all on function shop_private.reprice_measured_invoice_line(uuid) from public,anon,authenticated,service_role;

commit;
