begin;
-- Technical specifications describe a SKU; they never redefine its stock unit.
create table public.product_attribute_definitions(
 code text primary key check(code ~ '^[a-z][a-z0-9_]{1,63}$'),
 name_en text not null,name_ar text not null,value_type text not null check(value_type in('text','number','integer','boolean')),
 unit_symbol text,min_value numeric(18,6),max_value numeric(18,6),choices text[],
 check(min_value is null or max_value is null or min_value<=max_value)
);
insert into public.product_attribute_definitions(code,name_en,name_ar,value_type,unit_symbol,min_value,max_value,choices) values
 ('brand','Brand','العلامة التجارية','text',null,null,null,null),
 ('manufacturer_reference','Manufacturer reference','مرجع المصنع','text',null,null,null,null),
 ('conductor_material','Conductor material','مادة الموصل','text',null,null,null,null),
 ('cross_section_mm2','Conductor cross-section','مساحة مقطع الموصل','number','mm²',0.000001,1000000,null),
 ('core_count','Core count','عدد القلوب','integer',null,1,1000,null),
 ('insulation_material','Insulation material','مادة العزل','text',null,null,null,null),
 ('voltage_rating','Voltage rating','الجهد المقنن','text','V',null,null,null),
 ('color','Color','اللون','text',null,null,null,null),
 ('cable_type','Cable type','نوع الكابل','text',null,null,null,null),
 ('flexibility','Flexible or solid','مرن أو مصمت','text',null,null,null,null),
 ('current_rating','Current rating','التيار المقنن','number','A',0.000001,1000000,null),
 ('pole_count','Pole count','عدد الأقطاب','integer','P',1,100,null),
 ('trip_curve','Trip curve','منحنى الفصل','text',null,null,null,null),
 ('breaking_capacity','Breaking capacity','قدرة القطع','number','kA',0.000001,1000000,null),
 ('series','Series','السلسلة','text',null,null,null,null),
 ('part_number','Part number','رقم القطعة','text',null,null,null,null),
 ('wattage','Wattage','القدرة','number','W',0.000001,1000000,null),
 ('lumens','Lumens','التدفق الضوئي','number','lm',0.000001,100000000,null),
 ('color_temperature','Color temperature','درجة حرارة اللون','integer','K',1,100000,null),
 ('lamp_base','Lamp base','قاعدة المصباح','text',null,null,null,null),
 ('dimensions','Dimensions','الأبعاد','text',null,null,null,null),
 ('conduit_diameter','Conduit diameter','قطر الماسورة','number','mm',0.000001,1000000,null);
create trigger product_attributes_registry_immutable before update or delete on public.product_attribute_definitions
 for each row execute function shop_private.measurement_history_immutable();
alter table public.product_attribute_definitions enable row level security;
revoke all on public.product_attribute_definitions from public,anon,authenticated,service_role;
grant select on public.product_attribute_definitions to authenticated,service_role;
create policy attribute_definitions_read on public.product_attribute_definitions for select to authenticated,service_role using(true);

create table public.product_families(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),
 name text not null check(length(btrim(name)) between 2 and 160),active boolean not null default true,
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id)
);
create unique index product_family_active_name on public.product_families(shop_id,lower(btrim(name))) where active;
create table public.product_technical_profiles(
 product_id uuid primary key,shop_id uuid not null,family_id uuid,
 revision integer not null check(revision>0),reel_tracking boolean not null default false,
 reel_return_policy jsonb not null default '{"unopenedResellable":true,"cutRequiresManagerApproval":true}'::jsonb,
 search_text text not null default '',updated_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id),
 foreign key(family_id,shop_id) references public.product_families(id,shop_id),unique(product_id,shop_id)
);
create table public.product_attribute_values(
 product_id uuid not null,shop_id uuid not null,attribute_code text not null references public.product_attribute_definitions(code),
 text_value text check(length(text_value) between 1 and 250),numeric_value numeric(18,6),boolean_value boolean,
 primary key(product_id,attribute_code),foreign key(product_id,shop_id) references public.products(id,shop_id),
 check(num_nonnulls(text_value,numeric_value,boolean_value)=1),
 check(numeric_value is null or numeric_value::text not in('NaN','Infinity','-Infinity'))
);
create table public.product_technical_changes(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,product_id uuid not null,revision integer not null,
 snapshot jsonb not null,reason text not null check(length(btrim(reason)) between 3 and 1000),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id),unique(product_id,revision)
);
create trigger product_technical_changes_immutable before update or delete on public.product_technical_changes
 for each row execute function shop_private.measurement_history_immutable();
create index product_technical_profiles_family on public.product_technical_profiles(shop_id,family_id,product_id);
create index product_attribute_values_shop on public.product_attribute_values(shop_id,product_id);
do $$declare t text;begin
 foreach t in array array['product_families','product_technical_profiles','product_attribute_values','product_technical_changes'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated,service_role',t);
  execute format('create policy technical_read on public.%I for select to authenticated using(shop_private.has_permission(shop_id,''products.view''))',t);
  execute format('create policy technical_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;

create function shop_private.product_technical_snapshot(p_shop uuid,p_product uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('revision',coalesce(p.revision,0),'familyId',p.family_id,'familyName',f.name,'reelTracking',coalesce(p.reel_tracking,false),'reelReturnPolicy',coalesce(p.reel_return_policy,'{"unopenedResellable":true,"cutRequiresManagerApproval":true}'::jsonb),
  'attributes',(select coalesce(jsonb_object_agg(v.attribute_code,coalesce(to_jsonb(v.text_value),to_jsonb(trim_scale(v.numeric_value)::text),to_jsonb(v.boolean_value))),'{}') from public.product_attribute_values v where v.shop_id=p_shop and v.product_id=p_product))
 from public.products item left join public.product_technical_profiles p on p.product_id=item.id and p.shop_id=item.shop_id
 left join public.product_families f on f.id=p.family_id and f.shop_id=p.shop_id
 where item.id=p_product and item.shop_id=p_shop;
$$;
revoke all on function shop_private.product_technical_snapshot(uuid,uuid) from public,anon,authenticated,service_role;

create function public.product_technical_options(p_shop_id uuid,p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare result jsonb;begin
 if not shop_private.has_permission(p_shop_id,'products.view') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_product_id is null then result:=jsonb_build_object('revision',0,'familyId',null,'familyName',null,'reelTracking',false,'reelReturnPolicy','{"unopenedResellable":true,"cutRequiresManagerApproval":true}'::jsonb,'attributes','{}'::jsonb);else result:=shop_private.product_technical_snapshot(p_shop_id,p_product_id);end if;
 if result is null then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 return result||jsonb_build_object('definitions',(select jsonb_agg(jsonb_build_object('code',code,'nameEn',name_en,'nameAr',name_ar,'type',value_type,'unit',unit_symbol,'minimum',min_value,'maximum',max_value,'choices',choices) order by code) from public.product_attribute_definitions),
 'trackingLocked',exists(select 1 from public.inventory_batches where shop_id=p_shop_id and product_id=p_product_id)
 or exists(select 1 from public.inventory_movements where shop_id=p_shop_id and product_id=p_product_id)
 or exists(select 1 from public.invoice_items where shop_id=p_shop_id and product_id=p_product_id));
end;$$;
revoke all on function public.product_technical_options(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.product_technical_options(uuid,uuid) to authenticated;

create function public.save_product_technical_details(p_shop_id uuid,p_product_id uuid,p_revision integer,p_family_name text,p_attributes jsonb,p_reel_tracking boolean,p_reason text,p_reel_return_policy jsonb default '{"unopenedResellable":true,"cutRequiresManagerApproval":true}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;product public.products%rowtype;profile public.product_technical_profiles%rowtype;definition public.product_attribute_definitions%rowtype;
 entry record;qty numeric;family uuid;family_name text:=nullif(btrim(p_family_name),'');canonical jsonb:='{}';snapshot jsonb;begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'products.manage');
 if p_revision is null or p_revision<0 or p_reel_tracking is null or p_attributes is null or jsonb_typeof(p_attributes)<>'object'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 1000 then raise exception 'INVALID_TECHNICAL_DETAILS' using errcode='22023';end if;
 if p_reel_return_policy is null or jsonb_typeof(p_reel_return_policy)<>'object' or (p_reel_return_policy-array['unopenedResellable','cutRequiresManagerApproval'])<>'{}' or jsonb_typeof(p_reel_return_policy->'unopenedResellable') is distinct from 'boolean' or jsonb_typeof(p_reel_return_policy->'cutRequiresManagerApproval') is distinct from 'boolean' then raise exception 'INVALID_REEL_RETURN_POLICY' using errcode='22023';end if;
 if (select count(*) from jsonb_object_keys(p_attributes))>32 then raise exception 'TOO_MANY_PRODUCT_ATTRIBUTES' using errcode='22023';end if;
 select * into product from public.products where id=p_product_id and shop_id=p_shop_id and is_active for update;
 if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 select * into profile from public.product_technical_profiles where product_id=product.id and shop_id=p_shop_id for update;
 for entry in select key,value from jsonb_each(p_attributes) order by key loop
  select * into definition from public.product_attribute_definitions where code=entry.key;
  if not found then raise exception 'UNKNOWN_PRODUCT_ATTRIBUTE' using errcode='22023';end if;
  if definition.value_type in('number','integer') then
   if jsonb_typeof(entry.value) not in('number','string') or (entry.value#>>'{}') !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_PRODUCT_ATTRIBUTE_NUMBER' using errcode='22023';end if;
   qty:=(entry.value#>>'{}')::numeric;
   if qty<definition.min_value or qty>definition.max_value or (definition.value_type='integer' and round(qty)<>qty) then raise exception 'PRODUCT_ATTRIBUTE_RANGE' using errcode='22023';end if;
   canonical:=canonical||jsonb_build_object(entry.key,trim_scale(qty)::text);
  elsif definition.value_type='boolean' then
   if jsonb_typeof(entry.value)<>'boolean' then raise exception 'INVALID_PRODUCT_ATTRIBUTE_BOOLEAN' using errcode='22023';end if;
   canonical:=canonical||jsonb_build_object(entry.key,entry.value);
  else
   if jsonb_typeof(entry.value)<>'string' or length(btrim(entry.value#>>'{}')) not between 1 and 250
   or (definition.choices is not null and not((entry.value#>>'{}')=any(definition.choices))) then raise exception 'INVALID_PRODUCT_ATTRIBUTE_TEXT' using errcode='22023';end if;
   canonical:=canonical||jsonb_build_object(entry.key,btrim(entry.value#>>'{}'));
  end if;
 end loop;
 if family_name is not null then
  if length(family_name) not between 2 and 160 or product.sku is null then raise exception 'VARIANT_FAMILY_REQUIRES_SKU' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text||':family:'||lower(family_name),0));
  select id into family from public.product_families where shop_id=p_shop_id and lower(btrim(name))=lower(family_name) and active;
  if not found then insert into public.product_families(shop_id,name,created_by_profile_id) values(p_shop_id,family_name,actor) returning id into family;end if;
 end if;
 if family is not null then select name into family_name from public.product_families where id=family;end if;
 snapshot:=jsonb_build_object('familyId',family,'familyName',family_name,'reelTracking',p_reel_tracking,'reelReturnPolicy',p_reel_return_policy,'attributes',canonical);
 if profile.product_id is not null and (shop_private.product_technical_snapshot(p_shop_id,product.id)-'revision')=snapshot then
  return shop_private.product_technical_snapshot(p_shop_id,product.id);end if;
 if coalesce(profile.revision,0)<>p_revision then raise exception 'PRODUCT_TECHNICAL_CONTEXT_CHANGED' using errcode='55000';end if;
 if coalesce(profile.reel_tracking,false) is distinct from p_reel_tracking then
  if exists(select 1 from public.inventory_batches where product_id=product.id) or exists(select 1 from public.inventory_movements where product_id=product.id)
   or exists(select 1 from public.invoice_items where product_id=product.id) or exists(select 1 from public.vendor_invoice_items where product_id=product.id)
   or exists(select 1 from public.stock_counts where product_id=product.id) or exists(select 1 from public.service_material_units where product_id=product.id) then
   raise exception 'REEL_TRACKING_REQUIRES_UNUSED_PRODUCT' using errcode='55000';end if;
 end if;
 if p_reel_tracking and (product.measurement_status<>'active' or not exists(select 1 from public.units_of_measure where code=product.base_unit_code and dimension='length')) then
  raise exception 'REEL_TRACKING_REQUIRES_LENGTH_UNIT' using errcode='22023';end if;
 insert into public.product_technical_profiles(product_id,shop_id,family_id,revision,reel_tracking,reel_return_policy)
 values(product.id,p_shop_id,family,p_revision+1,p_reel_tracking,p_reel_return_policy) on conflict(product_id) do update set
 family_id=excluded.family_id,revision=excluded.revision,reel_tracking=excluded.reel_tracking,reel_return_policy=excluded.reel_return_policy,updated_at=clock_timestamp();
 delete from public.product_attribute_values where product_id=product.id and shop_id=p_shop_id;
 for entry in select key,value from jsonb_each(canonical) loop
  select * into definition from public.product_attribute_definitions where code=entry.key;
  insert into public.product_attribute_values(product_id,shop_id,attribute_code,text_value,numeric_value,boolean_value)
  values(product.id,p_shop_id,entry.key,case when definition.value_type='text' then entry.value#>>'{}' end,
   case when definition.value_type in('number','integer') then (entry.value#>>'{}')::numeric end,
   case when definition.value_type='boolean' then (entry.value#>>'{}')::boolean end);
 end loop;
 update public.product_technical_profiles set search_text=lower(coalesce(family_name,'')||' '||coalesce((select string_agg(coalesce(v.text_value,trim_scale(v.numeric_value)::text,v.boolean_value::text)||coalesce(d.unit_symbol,''),' ') from public.product_attribute_values v join public.product_attribute_definitions d on d.code=v.attribute_code where v.shop_id=p_shop_id and v.product_id=product.id),'')) where product_id=product.id;
 insert into public.product_technical_changes(shop_id,product_id,revision,snapshot,reason,actor_profile_id)
 values(p_shop_id,product.id,p_revision+1,snapshot,btrim(p_reason),actor);
 return shop_private.product_technical_snapshot(p_shop_id,product.id);
end;$$;
revoke all on function public.save_product_technical_details(uuid,uuid,integer,text,jsonb,boolean,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.save_product_technical_details(uuid,uuid,integer,text,jsonb,boolean,text,jsonb) to authenticated;

create function shop_private.is_reel_tracked(p_shop uuid,p_product uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select reel_tracking from public.product_technical_profiles where shop_id=p_shop and product_id=p_product),false);
$$;
revoke all on function shop_private.is_reel_tracked(uuid,uuid) from public,anon,authenticated,service_role;
create function shop_private.matches_technical_search(p_shop uuid,p_product uuid,p_query text) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from regexp_split_to_table(lower(btrim(p_query)),'\s+') term where position(term in lower(p.name||' '||coalesce(p.sku,'')||' '||coalesce(p.barcode,'')||' '||coalesce(t.search_text,'')))=0)
 from public.products p left join public.product_technical_profiles t on t.shop_id=p.shop_id and t.product_id=p.id where p.shop_id=p_shop and p.id=p_product;
$$;
revoke all on function shop_private.matches_technical_search(uuid,uuid,text) from public,anon,authenticated,service_role;

create table public.inventory_reels(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,product_id uuid not null,batch_id uuid not null references public.inventory_batches(id),
 barcode text not null check(length(btrim(barcode)) between 1 and 80),storage_position text check(length(storage_position)<=160),
 original_length numeric(18,6) not null check(original_length>0 and original_length::text not in('NaN','Infinity','-Infinity')),
 remaining_length numeric(18,6) not null check(remaining_length>=0 and remaining_length::text not in('NaN','Infinity','-Infinity')),
 status text not null check(status in('sealed','open','empty','damaged','archived')),
 classification text not null default 'sellable' check(classification in('sellable','discounted','damaged','scrap')),
 remnant_price numeric(18,6) check(remnant_price>=0 and remnant_price<=999999999.99),
 source_reel_id uuid references public.inventory_reels(id),source_return_id uuid references public.sale_returns(id),
 created_by_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),last_movement_at timestamptz not null default clock_timestamp(),
 foreign key(product_id,shop_id) references public.products(id,shop_id),foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),
 unique(id,shop_id,location_id),check(classification<>'discounted' or remnant_price is not null),check(status not in('empty','archived') or remaining_length=0)
);
create unique index inventory_reel_active_barcode on public.inventory_reels(shop_id,barcode) where status<>'archived';
create index inventory_reel_available on public.inventory_reels(shop_id,location_id,product_id,status,classification,remaining_length);
create index inventory_reel_batch on public.inventory_reels(batch_id,id);
create table public.inventory_reel_cuts(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,reel_id uuid not null,invoice_item_id uuid not null references public.invoice_items(id),
 requested_length numeric(18,6) not null check(requested_length>0),actual_cut_length numeric(18,6) not null,cutting_loss numeric(18,6) not null default 0 check(cutting_loss>=0),
 resulting_remaining_length numeric(18,6) not null check(resulting_remaining_length>=0),kind text not null check(kind in('cut','sealed_sale')),
 sale_movement_id uuid not null references public.inventory_movements(id),loss_movement_id uuid references public.inventory_movements(id),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(reel_id,shop_id,location_id) references public.inventory_reels(id,shop_id,location_id),
 check(actual_cut_length=requested_length+cutting_loss),check((cutting_loss=0)=(loss_movement_id is null)),check(kind<>'sealed_sale' or cutting_loss=0)
);
create index inventory_reel_cuts_line on public.inventory_reel_cuts(shop_id,invoice_item_id,id);
create table public.inventory_reel_movements(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,reel_id uuid not null,
 kind text not null check(kind in('receipt','cut','sealed_sale','return','count','classification','scrap','supplier_return','purchase_void')),
 quantity_change numeric(18,6) not null,value_change numeric(30,12),inventory_movement_id uuid references public.inventory_movements(id),
 reference_id uuid,reason text not null check(length(btrim(reason)) between 3 and 1000),snapshot jsonb not null,
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(reel_id,shop_id,location_id) references public.inventory_reels(id,shop_id,location_id)
);
create index inventory_reel_movements_history on public.inventory_reel_movements(shop_id,location_id,reel_id,created_at desc,id desc);
create table shop_private.reel_operation_requests(
 shop_id uuid not null,request_id uuid not null,kind text not null,payload jsonb not null,result_id uuid not null,
 actor_profile_id uuid not null references public.profiles(id),primary key(shop_id,request_id)
);
revoke all on shop_private.reel_operation_requests from public,anon,authenticated,service_role;
alter table shop_private.reel_operation_requests enable row level security;
create trigger inventory_reel_cuts_immutable before update or delete on public.inventory_reel_cuts for each row execute function shop_private.measurement_history_immutable();
create trigger inventory_reel_movements_immutable before update or delete on public.inventory_reel_movements for each row execute function shop_private.measurement_history_immutable();
revoke all on public.inventory_reels,public.inventory_reel_cuts,public.inventory_reel_movements from public,anon,authenticated,service_role;
grant select on public.inventory_reels,public.inventory_reel_cuts to authenticated;
grant select on public.inventory_reels,public.inventory_reel_cuts,public.inventory_reel_movements to service_role;
do $$declare t text;begin
 foreach t in array array['inventory_reels','inventory_reel_cuts','inventory_reel_movements'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy reel_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
create policy reels_read on public.inventory_reels for select to authenticated using(shop_private.has_permission(shop_id,'inventory.view') and shop_private.user_can_access_location(shop_id,location_id));
create policy reel_cuts_read on public.inventory_reel_cuts for select to authenticated using(shop_private.has_permission(shop_id,'inventory.view') and shop_private.user_can_access_location(shop_id,location_id));

create function shop_private.reel_identity_guard() returns trigger language plpgsql security definer set search_path='' as $$declare b public.inventory_batches%rowtype;begin
 select * into b from public.inventory_batches where id=new.batch_id for share;
 if not found or (b.shop_id,b.location_id,b.product_id) is distinct from (new.shop_id,new.location_id,new.product_id)
 or not shop_private.is_reel_tracked(new.shop_id,new.product_id) then raise exception 'INVALID_REEL_BATCH_IDENTITY' using errcode='23514';end if;
 perform shop_private.assert_measured_quantity(new.shop_id,new.product_id,new.original_length);
 perform shop_private.assert_measured_quantity(new.shop_id,new.product_id,new.remaining_length,true);
 if tg_op='UPDATE' and (new.id,new.shop_id,new.location_id,new.product_id,new.batch_id,new.original_length,new.created_by_profile_id,new.created_at,new.source_reel_id,new.source_return_id)
  is distinct from (old.id,old.shop_id,old.location_id,old.product_id,old.batch_id,old.original_length,old.created_by_profile_id,old.created_at,old.source_reel_id,old.source_return_id) then
  raise exception 'REEL_ACQUISITION_IDENTITY_IMMUTABLE' using errcode='55000';end if;
 return new;
end;$$;
revoke all on function shop_private.reel_identity_guard() from public,anon,authenticated,service_role;
create trigger reel_identity_guard before insert or update on public.inventory_reels for each row execute function shop_private.reel_identity_guard();

create function shop_private.reel_barcode_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status='archived' then return new;end if;
 if tg_op='UPDATE' and new.barcode=old.barcode and old.status<>'archived' then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-barcode:'||new.shop_id::text,0));
 if exists(select 1 from public.products where shop_id=new.shop_id and barcode=new.barcode and is_active)
 or exists(select 1 from public.product_packagings where shop_id=new.shop_id and barcode=new.barcode and active)
 or exists(select 1 from public.inventory_reels where shop_id=new.shop_id and barcode=new.barcode and status<>'archived' and id<>new.id) then
  raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 return new;
end;$$;
revoke all on function shop_private.reel_barcode_guard() from public,anon,authenticated,service_role;
create trigger reel_barcode_guard before insert or update of barcode,status on public.inventory_reels for each row execute function shop_private.reel_barcode_guard();

-- A deferred invariant makes reel length a reconciled physical decomposition of
-- acquisition-batch stock. No independent second stock ledger can drift silently.
create function shop_private.check_reel_batch_balance() returns trigger language plpgsql security definer set search_path='' as $$
declare batch uuid;b public.inventory_batches%rowtype;physical numeric;begin
 if tg_table_name='inventory_batches' then batch:=coalesce(new.id,old.id);else batch:=coalesce(new.batch_id,old.batch_id);end if;
 select * into b from public.inventory_batches where id=batch;
 if not found or not shop_private.is_reel_tracked(b.shop_id,b.product_id) then return null;end if;
 select coalesce(sum(remaining_length),0) into physical from public.inventory_reels where batch_id=b.id;
 if physical<>b.remaining_quantity then raise exception 'REEL_STOCK_RECONCILIATION_REQUIRED' using errcode='23514';end if;
 return null;
end;$$;
revoke all on function shop_private.check_reel_batch_balance() from public,anon,authenticated,service_role;
create constraint trigger reel_batch_balance after insert or update or delete on public.inventory_batches deferrable initially deferred for each row execute function shop_private.check_reel_batch_balance();
create constraint trigger reel_length_balance after insert or update or delete on public.inventory_reels deferrable initially deferred for each row execute function shop_private.check_reel_batch_balance();

create function shop_private.register_purchase_reels(p_shop uuid,p_product uuid,p_batch uuid,p_snapshot jsonb,p_input jsonb,p_actor uuid) returns void
language plpgsql set search_path='' as $$
declare b public.inventory_batches%rowtype;n integer;each_length numeric;i integer;id uuid;barcode text;begin
 if not shop_private.is_reel_tracked(p_shop,p_product) then return;end if;
 select batch.* into b from public.inventory_batches batch where batch.id=p_batch and batch.shop_id=p_shop and batch.product_id=p_product for update;
 if not found then raise exception 'INVALID_REEL_BATCH_IDENTITY' using errcode='23514';end if;
 if p_snapshot->>'packageId' is not null then
  if p_snapshot->>'enteredUnitCode' not in('reel','roll') then raise exception 'REEL_RECEIPT_PACKAGE_REQUIRED' using errcode='22023';end if;
  n:=(p_snapshot->>'enteredQuantity')::integer;each_length:=b.quantity_received/n;
 else n:=1;each_length:=b.quantity_received;end if;
 if n not between 1 and 1000 then raise exception 'TOO_MANY_RECEIPT_REELS' using errcode='22023';end if;
 if p_input ? 'reel_barcodes' and (jsonb_typeof(p_input->'reel_barcodes')<>'array' or jsonb_array_length(p_input->'reel_barcodes')<>n) then raise exception 'INVALID_REEL_RECEIPT_IDENTITIES' using errcode='22023';end if;
 for i in 1..n loop
  id:=gen_random_uuid();barcode:=coalesce(p_input->'reel_barcodes'->>(i-1),'REEL-'||id::text);
  if barcode is null or length(btrim(barcode)) not between 1 and 80 then raise exception 'INVALID_REEL_BARCODE' using errcode='22023';end if;
  insert into public.inventory_reels(id,shop_id,location_id,product_id,batch_id,barcode,original_length,remaining_length,status,created_by_profile_id)
  values(id,b.shop_id,b.location_id,b.product_id,b.id,btrim(barcode),each_length,each_length,'sealed',p_actor);
  insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,reference_id,reason,snapshot,actor_profile_id)
  values(b.shop_id,b.location_id,id,'receipt',each_length,each_length*b.unit_cost,b.source_id,'Supplier reel receipt',jsonb_build_object('originalLength',trim_scale(each_length)::text,'batchId',b.id,'barcode',barcode),p_actor);
 end loop;
end;$$;
revoke all on function shop_private.register_purchase_reels(uuid,uuid,uuid,jsonb,jsonb,uuid) from public,anon,authenticated,service_role;

create function shop_private.plan_reel_sale(p_shop uuid,p_product uuid,p_location uuid,p_quantity numeric,p_measurement jsonb,p_used jsonb default '{}') returns jsonb
language plpgsql stable set search_path='' as $$
declare selected uuid:=nullif(p_measurement->>'reelId','')::uuid;split boolean:=coalesce((p_measurement->>'allowSplit')::boolean,false);
 loss numeric:=coalesce((p_measurement->>'cuttingLoss')::numeric,0);needed numeric:=p_quantity;factor numeric;packages integer;
 r record;available numeric;take_qty numeric;take_loss numeric;result jsonb:='[]';begin
 if not shop_private.is_reel_tracked(p_shop,p_product) then return '[]';end if;
 if p_quantity is null or p_quantity<=0 or loss<0 then raise exception 'INVALID_REEL_CUT' using errcode='22023';end if;
 if p_measurement->>'packageId' is not null then
  packages:=(p_measurement->>'enteredQuantity')::integer;factor:=p_quantity/packages;
  if loss<>0 or (selected is not null and packages<>1) then raise exception 'INVALID_SEALED_REEL_SALE' using errcode='22023';end if;
 end if;
 for r in select reel.*,batch.received_at from public.inventory_reels reel join public.inventory_batches batch on batch.id=reel.batch_id
 where reel.shop_id=p_shop and reel.product_id=p_product and reel.location_id=p_location
 and reel.status in('sealed','open') and reel.classification in('sellable','discounted') and (selected is null or reel.id=selected)
 and (reel.classification='sellable' or selected=reel.id)
 order by batch.received_at,reel.id loop
  available:=r.remaining_length-coalesce((p_used->>r.id::text)::numeric,0);
  if available<=0 then continue;end if;
  take_loss:=0;
  if packages is not null then
   if r.status<>'sealed' or r.original_length<>factor or available<>factor then continue;end if;
   take_qty:=factor;packages:=packages-1;
  elsif not split then
   if available<needed+loss then continue;end if;
   take_qty:=needed;take_loss:=loss;
  elsif available>=needed+loss then take_qty:=needed;take_loss:=loss;
  elsif available<needed then take_qty:=available;
  else take_qty:=greatest(available-loss,0);end if;
  if take_qty<=0 then continue;end if;
  result:=result||jsonb_build_array(jsonb_build_object('reelId',r.id,'barcode',r.barcode,'soldQuantity',trim_scale(take_qty)::text,
   'cuttingLoss',trim_scale(take_loss)::text,'actualCutLength',trim_scale(take_qty+take_loss)::text,'kind',case when packages is not null then 'sealed_sale' else 'cut' end));
  needed:=needed-take_qty;
  if jsonb_array_length(result)>1000 then raise exception 'TOO_MANY_REEL_ALLOCATIONS' using errcode='22023';end if;
  exit when needed=0;
 end loop;
 if needed<>0 then
  if selected is not null then raise exception 'SELECTED_REEL_CANNOT_FULFILL' using errcode='23514';end if;
  if packages is not null then raise exception 'INSUFFICIENT_SEALED_REELS' using errcode='23514';end if;
  if not split then raise exception 'CONTINUOUS_LENGTH_UNAVAILABLE' using errcode='23514';end if;
  raise exception 'INSUFFICIENT_REEL_LENGTH' using errcode='23514';
 end if;
 return result;
end;$$;
revoke all on function shop_private.plan_reel_sale(uuid,uuid,uuid,numeric,jsonb,jsonb) from public,anon,authenticated,service_role;

create function shop_private.stage_invoice_reel_plans(p_shop uuid,p_invoice uuid) returns void language plpgsql set search_path='' as $$
declare location uuid;line public.invoice_items%rowtype;plan jsonb;entry jsonb;used jsonb:='{}';key text;begin
 select location_id into location from public.invoices where id=p_invoice and shop_id=p_shop;
 if location is null then raise exception 'SALE_LOCATION_REQUIRED' using errcode='23514';end if;
 -- The sale authority already locks products in UUID order. Every other reel
 -- command follows product -> reel -> batch, so competing cashiers serialize.
 perform r.id from public.inventory_reels r where r.shop_id=p_shop and r.location_id=location
 and r.product_id in(select product_id from public.invoice_items where invoice_id=p_invoice and item_type='product') order by r.product_id,r.id for update;
 for line in select * from public.invoice_items where invoice_id=p_invoice and shop_id=p_shop and item_type='product' order by product_id,line_order,id loop
  if not shop_private.is_reel_tracked(p_shop,line.product_id) then continue;end if;
  plan:=shop_private.plan_reel_sale(p_shop,line.product_id,location,line.quantity,line.measurement_snapshot,used);
  for entry in select value from jsonb_array_elements(plan) loop
   key:=entry->>'reelId';used:=jsonb_set(used,array[key],to_jsonb(coalesce((used->>key)::numeric,0)+(entry->>'actualCutLength')::numeric));
  end loop;
  update public.invoice_items set measurement_snapshot=measurement_snapshot||jsonb_build_object('reelAllocations',plan,
   'physicalConsumedQuantity',trim_scale(line.quantity+coalesce((line.measurement_snapshot->>'cuttingLoss')::numeric,0))::text) where id=line.id;
 end loop;
end;$$;
revoke all on function shop_private.stage_invoice_reel_plans(uuid,uuid) from public,anon,authenticated,service_role;

create function shop_private.consume_product_sale_line(p_shop uuid,p_invoice uuid,p_line uuid,p_actor uuid) returns void
language plpgsql set search_path='' as $$
declare line public.invoice_items%rowtype;location uuid;r public.inventory_reels%rowtype;b public.inventory_batches%rowtype;
 plan jsonb;entry jsonb;qty numeric;loss numeric;physical numeric;remaining numeric;take_qty numeric;cut uuid;movement uuid;loss_movement uuid;begin
 select * into line from public.invoice_items where id=p_line and shop_id=p_shop and invoice_id=p_invoice and item_type='product';
 select location_id into location from public.invoices where id=p_invoice and shop_id=p_shop;
 if not found or line.id is null or location is null then raise exception 'SALE_LINE_NOT_FOUND' using errcode='P0002';end if;
 if not shop_private.is_reel_tracked(p_shop,line.product_id) then
  remaining:=line.quantity;
  for b in select * from public.inventory_batches where shop_id=p_shop and product_id=line.product_id and location_id=location and remaining_quantity>0 order by received_at,id for update loop
   take_qty:=least(remaining,b.remaining_quantity);
   update public.inventory_batches set remaining_quantity=remaining_quantity-take_qty where id=b.id;
   insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
   values(p_shop,location,line.product_id,b.id,-take_qty,'out',p_invoice,p_actor,b.unit_cost,line.id);
   remaining:=remaining-take_qty;exit when remaining=0;
  end loop;
  if remaining<>0 then raise exception 'INSUFFICIENT_STOCK' using errcode='23514';end if;
  return;
 end if;
 plan:=line.measurement_snapshot->'reelAllocations';
 if jsonb_typeof(plan) is distinct from 'array' or jsonb_array_length(plan)<1
 or (select sum((e->>'soldQuantity')::numeric) from jsonb_array_elements(plan)e)<>line.quantity
 or (select sum((e->>'cuttingLoss')::numeric) from jsonb_array_elements(plan)e)<>coalesce((line.measurement_snapshot->>'cuttingLoss')::numeric,0) then raise exception 'SERVER_REEL_PLAN_REQUIRED' using errcode='55000';end if;
 for entry in select value from jsonb_array_elements(plan) loop
  qty:=(entry->>'soldQuantity')::numeric;loss:=(entry->>'cuttingLoss')::numeric;physical:=qty+loss;cut:=gen_random_uuid();loss_movement:=null;
  select * into r from public.inventory_reels where id=(entry->>'reelId')::uuid and shop_id=p_shop and location_id=location and product_id=line.product_id for update;
  if not found or r.status not in('sealed','open') or r.classification not in('sellable','discounted') or r.remaining_length<physical then raise exception 'REEL_PLAN_CHANGED' using errcode='23514';end if;
  select * into b from public.inventory_batches where id=r.batch_id and shop_id=p_shop and location_id=location for update;
  if not found or b.remaining_quantity<physical then raise exception 'REEL_STOCK_RECONCILIATION_REQUIRED' using errcode='23514';end if;
  perform shop_private.assert_measured_quantity(p_shop,line.product_id,qty);
  if loss>0 then perform shop_private.assert_measured_quantity(p_shop,line.product_id,loss);end if;
  update public.inventory_reels set remaining_length=remaining_length-physical,status=case when remaining_length=physical then 'empty' else 'open' end,last_movement_at=clock_timestamp() where id=r.id;
  update public.inventory_batches set remaining_quantity=remaining_quantity-physical where id=b.id;
  insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
  values(p_shop,location,line.product_id,b.id,-qty,'out',p_invoice,p_actor,b.unit_cost,line.id) returning id into movement;
  if loss>0 then
   insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot)
   values(p_shop,location,line.product_id,b.id,-loss,'out',cut,p_actor,b.unit_cost) returning id into loss_movement;
  end if;
  insert into public.inventory_reel_cuts(id,shop_id,location_id,reel_id,invoice_item_id,requested_length,actual_cut_length,cutting_loss,resulting_remaining_length,kind,sale_movement_id,loss_movement_id,actor_profile_id)
  values(cut,p_shop,location,r.id,line.id,qty,physical,loss,r.remaining_length-physical,entry->>'kind',movement,loss_movement,p_actor);
  insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,inventory_movement_id,reference_id,reason,snapshot,actor_profile_id)
  values(p_shop,location,r.id,entry->>'kind',-physical,-physical*b.unit_cost,movement,cut,'Issued reel sale',entry||jsonb_build_object('resultingRemainingLength',trim_scale(r.remaining_length-physical)::text,'invoiceId',p_invoice),p_actor);
 end loop;
end;$$;
revoke all on function shop_private.consume_product_sale_line(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

alter function shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean) rename to resolve_measured_line_before_reels;
revoke all on function shop_private.resolve_measured_line_before_reels(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;
create function shop_private.resolve_measured_line(p_shop uuid,p_product uuid,p_line jsonb,p_purchase boolean default false) returns jsonb
language plpgsql stable set search_path='' as $$
declare result jsonb;measurement jsonb;loss_text text:=coalesce(p_line->>'cutting_loss','0');loss numeric;split boolean;reel public.inventory_reels%rowtype;
 entered_price numeric;factor numeric;fixed_package boolean;begin
 result:=shop_private.resolve_measured_line_before_reels(p_shop,p_product,p_line,p_purchase);
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
end;$$;
revoke all on function shop_private.resolve_measured_line(uuid,uuid,jsonb,boolean) from public,anon,authenticated,service_role;

create function shop_private.technical_product_guard() returns trigger language plpgsql security definer set search_path='' as $$declare profile public.product_technical_profiles%rowtype;begin
 select * into profile from public.product_technical_profiles where product_id=new.id and shop_id=new.shop_id;
 if not found then return new;end if;
 if profile.family_id is not null and nullif(btrim(new.sku),'') is null then raise exception 'VARIANT_FAMILY_REQUIRES_SKU' using errcode='23514';end if;
 if profile.reel_tracking and not exists(select 1 from public.units_of_measure where code=new.base_unit_code and dimension='length') then raise exception 'REEL_TRACKING_REQUIRES_LENGTH_UNIT' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function shop_private.technical_product_guard() from public,anon,authenticated,service_role;
create trigger technical_product_guard before update of sku,base_unit_code on public.products for each row execute function shop_private.technical_product_guard();

alter function shop_private.catalog_media(uuid,text,jsonb) rename to catalog_media_before_reels;
revoke all on function shop_private.catalog_media_before_reels(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function shop_private.catalog_media(p_shop_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$declare result jsonb;begin
 result:=shop_private.catalog_media_before_reels(p_shop_id,p_action,p_payload);
 if p_action='save_product' and (p_payload->>'p_technical_enabled')::boolean is true then
  perform public.save_product_technical_details(p_shop_id,(result#>>'{}')::uuid,coalesce((p_payload->>'p_technical_revision')::integer,0),p_payload->>'p_family_name',
   coalesce((p_payload->>'p_technical_attributes')::jsonb,'{}'),coalesce((p_payload->>'p_reel_tracking')::boolean,false),coalesce(p_payload->>'p_technical_reason','Product technical configuration'),coalesce((p_payload->>'p_reel_return_policy')::jsonb,'{"unopenedResellable":true,"cutRequiresManagerApproval":true}'::jsonb));
 end if;
 return result;
end;$$;
revoke all on function shop_private.catalog_media(uuid,text,jsonb) from public,anon,authenticated,service_role;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.issue_sale(uuid,uuid,uuid)'::regprocedure) is distinct from 'c9a7e490edcda67508ced5edc178a5c7' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.issue_sale' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.issue_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_request public.sale_requests%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_line record;
  v_batch record;
  v_remaining numeric;
  v_take numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
  v_number bigint;
  v_issued_at timestamptz := clock_timestamp();
  v_payload_hash text := md5(coalesce(p_invoice_id::text, ''));
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if p_request_id is null or p_invoice_id is null then
    raise exception 'INVALID_SALE_ISSUE' using errcode = '22023';
  end if;

  insert into public.sale_requests (
    shop_id, operation, request_id, actor_profile_id, payload_hash
  ) values (
    p_shop_id, 'issue', p_request_id, v_profile_id, v_payload_hash
  ) on conflict do nothing;
  select * into v_request from public.sale_requests
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id
  for update;
  if v_request.actor_profile_id <> v_profile_id
    or v_request.payload_hash <> v_payload_hash then
    raise exception 'SALE_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.invoice_id is not null then return v_request.invoice_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft'::public.invoice_status then
    raise exception 'SALE_NOT_DRAFT' using errcode = '23514';
  end if;
  if v_invoice.client_id is null then
    raise exception 'OUTSTANDING_SALE_REQUIRES_CUSTOMER' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  -- Product rows are the serialization point shared by supported stock writes.
  -- The stable ordering prevents opposite-order multi-product deadlocks.
  perform product.id
  from public.products product
  join (
    select distinct item.product_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id
  order by product.id
  for update of product;

  perform service.id
  from public.services service
  join (
    select distinct item.service_id
    from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id
  order by service.id
  for update of service;

  update public.invoices invoice set
    client_name_snapshot = client.name,
    client_phone_snapshot = client.phone,
    client_email_snapshot = client.email,
    client_address_snapshot = client.address
  from public.clients client
  where invoice.id = p_invoice_id and client.id = invoice.client_id
    and client.shop_id = p_shop_id and client.is_active;
  if not found then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  -- Re-price every line from the locked active catalog. Draft values are only
  -- a preview and cannot become authoritative through browser input.
  for v_line in
    select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product'::public.invoice_item_type then
      select * into v_product from public.products
      where id = v_line.product_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_discount := 0;
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set
        item_name = v_product.name, unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=case when v_measurement is null then null else v_measurement->'measurement' end,
        discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku,
        product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0
      where id = v_line.id;
    elsif v_line.item_type = 'service'::public.invoice_item_type then
      select * into v_service from public.services
      where id = v_line.service_id and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type
        when 'percent' then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set
        item_name = v_service.name, unit_price = v_service.base_sale_price,
        discount_amount = v_discount, total_amount = v_total,
        discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value
      where id = v_line.id;
    else
      raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  -- Aggregate before mutation so duplicate product lines cannot evade the
  -- available-stock check.
  if exists (
    select requested.product_id
    from (
      select product_id, sum(quantity) as quantity
      from public.invoice_items
      where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id
    ) requested
    left join public.inventory_batches batch
      on batch.shop_id = p_shop_id and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then
    raise exception 'INSUFFICIENT_STOCK' using errcode = '23514';
  end if;

  perform shop_private.assert_period_is_open(p_shop_id, v_issued_at);
  insert into public.sale_number_counters (shop_id, next_number)
  values (p_shop_id, 2)
  on conflict (shop_id) do update set
    next_number = public.sale_number_counters.next_number + 1,
    updated_at = now()
  returning next_number - 1 into v_number;

  perform shop_private.stage_invoice_reel_plans(p_shop_id,p_invoice_id);
  update public.invoices invoice set
    invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = totals.total_amount,
    discount_amount = totals.discount_amount,
    status = 'issued',
    issued_at = v_issued_at,
    issued_by_profile_id = v_profile_id,
    updated_at = v_issued_at
  from (
    select sum(total_amount) as total_amount, sum(discount_amount) as discount_amount
    from public.invoice_items where invoice_id = p_invoice_id
  ) totals where invoice.id = p_invoice_id;

  for v_line in select id from public.invoice_items where invoice_id=p_invoice_id and shop_id=p_shop_id and item_type='product' order by product_id,line_order,id loop
    perform shop_private.consume_product_sale_line(p_shop_id,p_invoice_id,v_line.id,v_profile_id);
  end loop;

  update public.sale_requests set invoice_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'issue' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.checkout_customerless_sale(uuid,uuid,uuid,numeric,timestamp with time zone,public.payment_method,text)'::regprocedure) is distinct from '558cc02dae1635a2335d51ae09734b65' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.checkout_customerless_sale' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.checkout_customerless_sale(p_request_id uuid, p_shop_id uuid, p_invoice_id uuid, p_amount numeric, p_paid_at timestamp with time zone, p_method public.payment_method, p_reference text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_request public.customer_payment_requests%rowtype;
  v_invoice public.invoices%rowtype;
  v_product public.products%rowtype;
  v_service public.services%rowtype;
  v_line record;
  v_batch record;
  v_remaining numeric;
  v_take numeric;
  v_unit_discount numeric;
  v_discount numeric;
  v_total numeric;
  v_measurement jsonb;
  v_number bigint;
  v_payment_id uuid;
  v_hash text;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  if not shop_private.has_permission(p_shop_id, 'payments.receive') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_invoice_id is null or p_amount is null or p_amount <= 0
    or round(p_amount, 2) <> p_amount or p_paid_at is null or p_method is null
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_CUSTOMERLESS_CHECKOUT' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_paid_at);
  v_hash := md5(jsonb_build_object('invoiceId', p_invoice_id, 'amount', p_amount,
    'paidAt', p_paid_at, 'method', p_method,
    'reference', nullif(btrim(p_reference), ''))::text);
  insert into public.customer_payment_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'checkout', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.customer_payment_requests
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'PAYMENT_REQUEST_CONFLICT' using errcode = '23505';
  end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;

  select * into v_invoice from public.invoices
  where id = p_invoice_id and shop_id = p_shop_id for update;
  if not found then raise exception 'SALE_DRAFT_NOT_FOUND'; end if;
  if v_invoice.status <> 'draft' then raise exception 'SALE_NOT_DRAFT' using errcode = '23514'; end if;
  if v_invoice.client_id is not null then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_ANONYMOUS_DRAFT' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_items where invoice_id = p_invoice_id) then
    raise exception 'SALE_REQUIRES_LINES' using errcode = '23514';
  end if;

  perform product.id from public.products product join (
    select distinct item.product_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'product'
  ) requested on requested.product_id = product.id order by product.id for update of product;
  perform service.id from public.services service join (
    select distinct item.service_id from public.invoice_items item
    where item.invoice_id = p_invoice_id and item.item_type = 'service'
  ) requested on requested.service_id = service.id order by service.id for update of service;

  for v_line in select * from public.invoice_items
    where invoice_id = p_invoice_id order by line_order, id
  loop
    if v_line.item_type = 'product' then
      select * into v_product from public.products where id = v_line.product_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
      v_measurement:=shop_private.reprice_measured_invoice_line(v_line.id);
      v_total:=coalesce((v_measurement->>'lineTotal')::numeric,round(v_product.sale_price*v_line.quantity,2));
      update public.invoice_items set item_name = v_product.name,
        unit_price = coalesce((v_measurement->>'baseUnitPrice')::numeric,v_product.sale_price), measurement_snapshot=case when v_measurement is null then null else v_measurement->'measurement' end, discount_amount = 0, total_amount = v_total,
        product_sku_snapshot = v_product.sku, product_barcode_snapshot = v_product.barcode,
        discount_type_snapshot = null, discount_value_snapshot = 0 where id = v_line.id;
    elsif v_line.item_type = 'service' then
      select * into v_service from public.services where id = v_line.service_id
        and shop_id = p_shop_id and is_active;
      if not found then raise exception 'SERVICE_NOT_FOUND'; end if;
      v_unit_discount := case v_service.default_discount_type when 'percent'
        then round(v_service.base_sale_price * v_service.default_discount_value / 100, 2)
        else v_service.default_discount_value end;
      v_discount := round(v_unit_discount * v_line.quantity, 2);
      v_total := round(v_service.base_sale_price * v_line.quantity - v_discount, 2);
      update public.invoice_items set item_name = v_service.name,
        unit_price = v_service.base_sale_price, discount_amount = v_discount,
        total_amount = v_total, discount_type_snapshot = v_service.default_discount_type,
        discount_value_snapshot = v_service.default_discount_value where id = v_line.id;
    else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode = '22023';
    end if;
  end loop;

  select sum(total_amount), sum(discount_amount) into v_total, v_discount
  from public.invoice_items where invoice_id = p_invoice_id;
  v_total := (shop_private.quote_invoice_tax(p_invoice_id,clock_timestamp())->>'total')::numeric;
  if p_amount <> v_total then
    raise exception 'CUSTOMERLESS_CHECKOUT_REQUIRES_FULL_PAYMENT' using errcode = '23514';
  end if;
  if exists (
    select requested.product_id from (select product_id, sum(quantity) quantity
      from public.invoice_items where invoice_id = p_invoice_id and item_type = 'product'
      group by product_id) requested
    left join public.inventory_batches batch on batch.shop_id = p_shop_id
      and batch.product_id = requested.product_id
    group by requested.product_id, requested.quantity
    having coalesce(sum(batch.remaining_quantity), 0) < requested.quantity
  ) then raise exception 'INSUFFICIENT_STOCK' using errcode = '23514'; end if;

  insert into public.sale_number_counters (shop_id, next_number) values (p_shop_id, 2)
  on conflict (shop_id) do update set next_number = public.sale_number_counters.next_number + 1,
    updated_at = now() returning next_number - 1 into v_number;
  perform shop_private.stage_invoice_reel_plans(p_shop_id,p_invoice_id);
  update public.invoices set invoice_number = 'SALE-' || lpad(v_number::text, 6, '0'),
    total_amount = v_total, discount_amount = v_discount, status = 'issued',
    issued_at = p_paid_at, issued_by_profile_id = v_profile_id, due_date = null,
    updated_at = p_paid_at where id = p_invoice_id;
  select total_amount into v_total from public.invoices where id=p_invoice_id;
  if p_amount<>v_total then raise exception 'TAX_QUOTE_CHANGED' using errcode='23514'; end if;

  for v_line in select id from public.invoice_items where invoice_id=p_invoice_id and shop_id=p_shop_id and item_type='product' order by product_id,line_order,id loop
    perform shop_private.consume_product_sale_line(p_shop_id,p_invoice_id,v_line.id,v_profile_id);
  end loop;

  insert into public.payments (shop_id, payment_direction, invoice_id, client_id,
    amount, method, status, reference, paid_at, created_by_profile_id, customer_kind)
  values (p_shop_id, 'in', p_invoice_id, null, v_total, p_method, 'completed',
    nullif(btrim(p_reference), ''), p_paid_at, v_profile_id, 'receipt')
  returning id into v_payment_id;
  insert into public.customer_payment_allocations (shop_id, payment_id, invoice_id, amount)
  values (p_shop_id, v_payment_id, p_invoice_id, v_total);
  update public.customer_payment_requests set result_id = p_invoice_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'checkout' and request_id = p_request_id;
  return p_invoice_id;
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.create_supplier_purchase(uuid,uuid,uuid,text,date,text,jsonb)'::regprocedure) is distinct from '92454bb5033298278583cc4b4139db14' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.create_supplier_purchase' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.create_supplier_purchase(p_request_id uuid, p_shop_id uuid, p_vendor_id uuid, p_invoice_number text, p_issued_on date, p_notes text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_profile_id uuid;
  v_vendor_name text;
  v_invoice_id uuid;
  v_invoice_number text := nullif(btrim(p_invoice_number), '');
  v_notes text := nullif(btrim(p_notes), '');
  v_issued_at timestamptz;
  v_items jsonb;
  v_item_count integer;
  v_distinct_product_count integer;
  v_valid_product_count integer;
  v_total numeric;
  v_request_payload jsonb;
  v_existing public.vendor_invoices%rowtype;
  v_item record;
  v_batch_id uuid;
  v_input jsonb; v_resolved jsonb; v_original jsonb:=p_items; v_snapshots jsonb:='{}';
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendor_invoices.manage'
  );
  if p_request_id is null or p_vendor_id is null or p_issued_on is null
    or p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100
    or (v_invoice_number is not null and length(v_invoice_number) > 120)
    or (v_notes is not null and length(v_notes) > 1000) then
    raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end if;

  perform 1 from public.shops where id=p_shop_id for update;
  perform shop_private.assert_purchase_entitlement(p_shop_id);
  select * into v_existing from public.vendor_invoices where shop_id=p_shop_id and request_id=p_request_id for update;
  if found and v_existing.request_payload ? 'measurementInput' then
    if v_existing.request_payload->'measurementInput' is distinct from p_items
      or v_existing.request_payload->>'vendor_id' is distinct from p_vendor_id::text
      or v_existing.request_payload->>'invoice_number' is distinct from v_invoice_number
      or v_existing.request_payload->>'issued_on' is distinct from p_issued_on::text
      or v_existing.request_payload->>'notes' is distinct from v_notes
      or v_existing.status not in('posted','void') then raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode='23505';end if;
    return v_existing.id;
  end if;
  if v_existing.id is not null and exists(select 1 from jsonb_array_elements(p_items)e where e ? 'unit_code' or e ? 'package_id') then
   raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode='23505';end if;
  p_items:='[]'::jsonb;
  for v_input in select value from jsonb_array_elements(v_original) loop
   v_resolved:=shop_private.resolve_measured_line(p_shop_id,(v_input->>'product_id')::uuid,v_input,true);
   p_items:=p_items||jsonb_build_array(jsonb_build_object('product_id',v_input->>'product_id','quantity',(v_resolved->>'baseQuantity')::numeric,
    'unit_cost',case when v_resolved->'measurement'='null'::jsonb then (v_input->>'unit_cost')::numeric else (v_resolved->>'baseUnitPrice')::numeric end));
   v_snapshots:=jsonb_set(v_snapshots,array[v_input->>'product_id'],coalesce(v_resolved->'measurement','null'));
  end loop;
  begin
    select
      jsonb_agg(jsonb_build_object(
        'product_id', parsed.product_id,
        'quantity', parsed.quantity,
        'unit_cost', parsed.unit_cost
      ) order by parsed.product_id),
      count(*), count(distinct parsed.product_id),
      sum(round(parsed.quantity * parsed.unit_cost, 2))
    into v_items, v_item_count, v_distinct_product_count, v_total
    from (
      select
        (entry ->> 'product_id')::uuid as product_id,
        (entry ->> 'quantity')::numeric as quantity,
        (entry ->> 'unit_cost')::numeric as unit_cost
      from jsonb_array_elements(p_items) entry
    ) parsed;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end;

  if v_item_count <> jsonb_array_length(p_items)
    or v_distinct_product_count <> v_item_count
    or exists (
      select 1
      from jsonb_to_recordset(v_items)
        as item(product_id uuid, quantity numeric, unit_cost numeric)
      where item.product_id is null or item.quantity is null
        or item.unit_cost is null or item.quantity <= 0
        or item.quantity > 1000000 or round(item.quantity,shop_private.quantity_scale(p_shop_id,item.product_id,3)) <> item.quantity
        or item.unit_cost < 0 or item.unit_cost > 999999999.99
        or round(item.unit_cost,case when shop_private.quantity_scale(p_shop_id,item.product_id,3)=6 then 12 else 2 end) <> item.unit_cost
    )
    or v_total is null or v_total > 9999999999.99 then
    raise exception 'INVALID_PURCHASE' using errcode = '22023';
  end if;

  v_issued_at := (
    p_issued_on::timestamp + interval '12 hours'
  ) at time zone 'Africa/Cairo';
  v_request_payload := jsonb_build_object(
    'vendor_id', p_vendor_id,
    'invoice_number', v_invoice_number,
    'issued_on', p_issued_on,
    'notes', v_notes,
    'items', v_items
  );
  if v_existing.id is null then v_request_payload:=v_request_payload||jsonb_build_object('measurementInput',v_original);end if;

  -- Serialize document creation and retries for a shop.
  perform 1 from public.shops where id = p_shop_id for update;
  if not found then raise exception 'SHOP_NOT_FOUND'; end if;
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'vendor_invoices.manage'
  );
  perform shop_private.assert_purchase_entitlement(p_shop_id);

  select * into v_existing
  from public.vendor_invoices
  where shop_id = p_shop_id and request_id = p_request_id
  for update;
  if found then
    if v_existing.request_payload = v_request_payload
      and v_existing.status in (
        'posted'::public.vendor_invoice_status,
        'void'::public.vendor_invoice_status
      ) then
      return v_existing.id;
    end if;
    raise exception 'PURCHASE_REQUEST_CONFLICT' using errcode = '23505';
  end if;

  select v.name into v_vendor_name
  from public.vendors v
  where v.id = p_vendor_id and v.shop_id = p_shop_id and v.is_active;
  if v_vendor_name is null then
    raise exception 'VENDOR_NOT_FOUND';
  end if;

  select count(*) into v_valid_product_count
  from public.products product
  join jsonb_to_recordset(v_items)
    as item(product_id uuid, quantity numeric, unit_cost numeric)
    on item.product_id = product.id
  where product.shop_id = p_shop_id and product.is_active;
  if v_valid_product_count <> v_item_count then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  perform p.id from public.products p where p.shop_id=p_shop_id and p.id in(select(v->>'product_id')::uuid from jsonb_array_elements(v_items)v) order by p.id for update;
  perform shop_private.assert_period_is_open(p_shop_id, v_issued_at);

  insert into public.vendor_invoices (
    shop_id, vendor_id, vendor_name_snapshot, invoice_number, status,
    issued_at, total_amount, notes, created_by_profile_id, request_id,
    request_payload
  ) values (
    p_shop_id, p_vendor_id, v_vendor_name, v_invoice_number, 'draft',
    v_issued_at, v_total, v_notes, v_profile_id, p_request_id,
    v_request_payload
  ) returning id into v_invoice_id;

  for v_item in
    select item.product_id, item.quantity, item.unit_cost
    from jsonb_to_recordset(v_items)
      as item(product_id uuid, quantity numeric, unit_cost numeric)
    order by item.product_id
  loop
    insert into public.vendor_invoice_items (
      vendor_invoice_id, product_id, quantity, unit_cost, total_cost, measurement_snapshot
    ) values (
      v_invoice_id, v_item.product_id, v_item.quantity, v_item.unit_cost,
      round(v_item.quantity * v_item.unit_cost, 2), nullif(v_snapshots->v_item.product_id::text,'null'::jsonb)
    );

    insert into public.inventory_batches (
      shop_id, product_id, quantity_received, remaining_quantity,
      unit_cost, received_at, source_type, source_id
    ) values (
      p_shop_id, v_item.product_id, v_item.quantity, v_item.quantity,
      v_item.unit_cost, v_issued_at, 'vendor_invoice', v_invoice_id
    ) returning id into v_batch_id;
    perform shop_private.register_purchase_reels(p_shop_id,v_item.product_id,v_batch_id,v_snapshots->v_item.product_id::text,
      (select e from jsonb_array_elements(v_original)e where e->>'product_id'=v_item.product_id::text),v_profile_id);

    insert into public.inventory_movements (
      shop_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot
    ) values (
      p_shop_id, v_item.product_id, v_batch_id, v_item.quantity, 'in',
      v_invoice_id, v_profile_id, v_item.unit_cost
    );
  end loop;

  update public.vendor_invoices
  set status = 'posted', updated_at = now()
  where id = v_invoice_id and status = 'draft';
  if not found then raise exception 'PURCHASE_POST_FAILED'; end if;

  return v_invoice_id;
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.reprice_measured_invoice_line(uuid)'::regprocedure) is distinct from '9801cab42311201955bb5c7c582e5dc9' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.reprice_measured_invoice_line' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.reprice_measured_invoice_line(p_line_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$declare p_line public.invoice_items%rowtype;m jsonb;r jsonb;begin
 select * into strict p_line from public.invoice_items where id=p_line_id;
 m:=p_line.measurement_snapshot;
 if m is null or m='null'::jsonb then return null;end if;
 r:=shop_private.resolve_measured_line(p_line.shop_id,p_line.product_id,jsonb_strip_nulls(jsonb_build_object('quantity',m->>'enteredQuantity','unit_code',m->>'enteredUnitCode',
 'reel_id',m->'reelId','allow_split',m->'allowSplit','cutting_loss',m->'cuttingLoss','measurement_revision',m->'productRevision','package_id',m->'packageId','package_version',m->'packageVersion')));
 if (r->>'baseQuantity')::numeric<>p_line.quantity then raise exception 'MEASUREMENT_CONTEXT_CHANGED' using errcode='55000';end if;
 return r;
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.measurement_barcode_guard()'::regprocedure) is distinct from 'bd4be5d20b95f4e65017d7adc29ca6cd' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.measurement_barcode_guard' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.measurement_barcode_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$begin
 if new.barcode is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended('shop-barcode:'||new.shop_id::text,0));
 if tg_table_name='products' then
 if new.is_active and exists(select 1 from public.product_packagings where shop_id=new.shop_id and barcode=new.barcode and active) then raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 else
 if new.active and exists(select 1 from public.products where shop_id=new.shop_id and barcode=new.barcode and is_active) then raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 end if;
 if exists(select 1 from public.inventory_reels where shop_id=new.shop_id and barcode=new.barcode and status<>'archived') then raise exception 'BARCODE_IDENTITY_CONFLICT' using errcode='23505';end if;
 return new;
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.quote_sale_tax(uuid,uuid,jsonb)'::regprocedure) is distinct from '3734df7aeb64ba8ddd19c52764c266ae' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: public.quote_sale_tax' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.quote_sale_tax(p_shop_id uuid, p_location_id uuid, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare policy jsonb;lines jsonb:='[]';item jsonb;price numeric;discount numeric;qty numeric;r jsonb;begin
 perform shop_private.assert_sale_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_TAX_INPUT' using errcode='22023';end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 for item in select value from jsonb_array_elements(p_lines) loop
 qty:=(item->>'quantity')::numeric;r:=null;
 if item->>'item_type'='product' then
 r:=shop_private.resolve_measured_line(p_shop_id,(item->>'source_id')::uuid,item);
 qty:=(r->>'baseQuantity')::numeric;price:=(r->>'baseUnitPrice')::numeric;discount:=0;
 if shop_private.is_reel_tracked(p_shop_id,(item->>'source_id')::uuid) then perform shop_private.plan_reel_sale(p_shop_id,(item->>'source_id')::uuid,p_location_id,qty,r->'measurement');end if;
 elsif item->>'item_type'='service' then
 select base_sale_price,round((case default_discount_type when 'percent' then round(base_sale_price*default_discount_value/100,2) else default_discount_value end)*qty,2)
 into price,discount from public.services where id=(item->>'source_id')::uuid and shop_id=p_shop_id and is_active;
 else raise exception 'UNSUPPORTED_SALE_LINE_TYPE' using errcode='22023';end if;
 if price is null then raise exception 'TAX_ITEM_NOT_FOUND' using errcode='P0002';end if;
 lines:=lines||jsonb_build_array(jsonb_build_object('itemType',item->>'item_type','sourceId',item->>'source_id','quantity',qty,'unitPrice',price,'lineDiscount',discount,'measurement',r->'measurement'));
 end loop;
 return shop_private.calculate_tax(lines,policy,0);
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.list_products(uuid,text,uuid,integer,integer)'::regprocedure) is distinct from 'b488b52d55da010b292b6d01c1daa90e' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.list_products' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.list_products(p_shop_id uuid, p_search text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_search text := nullif(btrim(p_search), ''); v_items jsonb; v_total bigint;
begin
  if not shop_private.has_permission(p_shop_id, 'products.view') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_page < 1 or p_page_size < 1 or p_page_size > 100
    or length(coalesce(v_search, '')) > 160 then
    raise exception 'INVALID_PRODUCT_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select count(*) into v_total from public.products product
  left join public.catalog_categories category on category.id = product.category_id
  where product.shop_id = p_shop_id and product.is_active
    and (p_category_id is null or product.category_id = p_category_id)
    and (v_search is null or product.name ilike '%' || v_search || '%'
      or coalesce(product.sku, '') ilike '%' || v_search || '%'
      or coalesce(product.barcode, '') ilike '%' || v_search || '%'
      or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search));
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.name, rows.id), '[]'::jsonb)
  into v_items from (select product.id, product.name, product.sku, product.barcode,
      product.sale_price, product.base_unit_code,product.quantity_increment,product.measurement_status,product.measurement_revision,product.sale_unit_codes, product.category_id, category.name category_name, product.created_at,shop_private.product_technical_snapshot(p_shop_id,product.id) technical_details
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
    order by lower(product.name), product.id offset (p_page - 1) * p_page_size limit p_page_size) rows;
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page, 'pageSize', p_page_size,'supportsMeasurements',true,'supportsTechnicalDetails',true);
end;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.pos_catalog_search(uuid,uuid,text,text,text,uuid,integer,integer)'::regprocedure) is distinct from '2c7e8beed55a0aced6229b637f421532' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.pos_catalog_search' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.pos_catalog_search(p_shop_id uuid, p_location_id uuid, p_search text DEFAULT NULL::text, p_item_type text DEFAULT NULL::text, p_barcode text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_page integer DEFAULT 1, p_page_size integer DEFAULT 30) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_search text := nullif(btrim(p_search), ''); v_barcode text := nullif(btrim(p_barcode), '');
  v_mode public.business_mode; v_items jsonb; v_total bigint;
begin
  perform shop_private.assert_location_access(p_shop_id, p_location_id, false);
  if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)), false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  if p_item_type is not null and p_item_type not in ('product', 'service')
    or p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 50
    or length(coalesce(v_search, '')) > 160 or length(coalesce(v_barcode, '')) > 80 then
    raise exception 'INVALID_POS_CATALOG_QUERY' using errcode = '22023'; end if;
  if p_category_id is not null and not exists (select 1 from public.catalog_categories
    where id = p_category_id and shop_id = p_shop_id and is_active) then
    raise exception 'CATEGORY_NOT_FOUND'; end if;
  select business_mode into v_mode from public.shops where id = p_shop_id;
  with catalog as (
    select product.id, 'product'::text item_type, product.name, product.sku,
      product.barcode, product.sale_price unit_price, 0::numeric discount,
      coalesce((select sum(batch.remaining_quantity) from public.inventory_batches batch
        where batch.shop_id = p_shop_id and batch.location_id = p_location_id
          and batch.product_id = product.id), 0) stock,
      product.category_id, category.name category_name
    from public.products product left join public.catalog_categories category on category.id = product.category_id
    where product.shop_id = p_shop_id and product.is_active and v_mode in ('product', 'mixed')
      and (p_item_type is null or p_item_type = 'product')
      and (p_category_id is null or product.category_id = p_category_id)
      and (v_barcode is null or product.barcode = v_barcode or exists(select 1 from public.product_packagings k where k.shop_id=product.shop_id and k.product_id=product.id and k.active and k.can_sell and k.barcode=v_barcode) or exists(select 1 from public.inventory_reels r where r.shop_id=product.shop_id and r.location_id=p_location_id and r.product_id=product.id and r.barcode=v_barcode and r.status<>'archived'))
      and (v_search is null or product.name ilike '%' || v_search || '%'
        or coalesce(product.sku, '') ilike '%' || v_search || '%'
        or coalesce(product.barcode, '') ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%'
        or shop_private.matches_technical_search(p_shop_id,product.id,v_search))
    union all
    select service.id, 'service', service.name, null, null, service.base_sale_price,
      case service.default_discount_type when 'percent'
        then round(service.base_sale_price * service.default_discount_value / 100, 2)
        else service.default_discount_value end, null::numeric,
      service.category_id, category.name
    from public.services service left join public.catalog_categories category on category.id = service.category_id
    where service.shop_id = p_shop_id and service.is_active and v_mode in ('service', 'mixed')
      and v_barcode is null and (p_item_type is null or p_item_type = 'service')
      and (p_category_id is null or service.category_id = p_category_id)
      and (v_search is null or service.name ilike '%' || v_search || '%'
        or coalesce(category.name, '') ilike '%' || v_search || '%')
  ), counted as (select *, count(*) over () total_count from catalog), paged as (
    select * from counted order by lower(name), id offset (p_page - 1) * p_page_size limit p_page_size
  ) select coalesce(max(total_count), 0), coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'itemType', item_type, 'name', name, 'sku', sku, 'barcode', barcode,
    'unitPrice', unit_price, 'discount', discount, 'stock', stock,
    'categoryId', category_id, 'categoryName', category_name
  ) order by lower(name), id), '[]'::jsonb) into v_total, v_items from paged;
  select coalesce(jsonb_agg(e||case when shop_private.is_reel_tracked(p_shop_id,(e->>'id')::uuid) then jsonb_build_object('stock',(shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)->>'available')::numeric,'catalogStock',(shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)->>'available')::numeric,'reelSummary',shop_private.reel_availability(p_shop_id,p_location_id,(e->>'id')::uuid)) else '{}'::jsonb end||jsonb_build_object('measurement',shop_private.pos_measurement(p_shop_id,(e->>'id')::uuid))||coalesce((select jsonb_build_object('unitSelection','package:'||k.id::text,'unitPrice',coalesce(k.sale_price,(e->>'unitPrice')::numeric*k.base_quantity),'barcode',k.barcode) from public.product_packagings k where k.shop_id=p_shop_id and k.product_id=(e->>'id')::uuid and k.active and k.can_sell and k.barcode=v_barcode),'{}')||coalesce((select jsonb_build_object('reelId',r.id,'reelBarcode',r.barcode,'reelStatus',r.status,'reelRemaining',trim_scale(r.remaining_length)::text,'reelPrice',case when r.classification='discounted' then r.remnant_price else null end,'stock',case when r.status in('sealed','open') and r.classification in('sellable','discounted') then r.remaining_length else 0 end,'unitPrice',case when r.classification='discounted' then r.remnant_price else p.sale_price end,'unitSelection','unit:'||p.base_unit_code,'barcode',r.barcode) from public.inventory_reels r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id where r.shop_id=p_shop_id and r.location_id=p_location_id and r.product_id=(e->>'id')::uuid and r.barcode=v_barcode and r.status<>'archived'),'{}') order by n),'[]') into v_items from jsonb_array_elements(v_items) with ordinality a(e,n);
  return jsonb_build_object('items', v_items, 'total', v_total, 'page', p_page,
    'pageSize', p_page_size, 'businessMode', v_mode,
    'ambiguousBarcode', v_barcode is not null and v_total > 1);
end;
$$;

alter table public.inventory_reels add column revision integer not null default 1 check(revision>0);
create function shop_private.reel_revision() returns trigger language plpgsql set search_path='' as $$begin new.revision:=old.revision+1;new.last_movement_at:=clock_timestamp();return new;end;$$;
revoke all on function shop_private.reel_revision() from public,anon,authenticated,service_role;
create trigger reel_revision before update on public.inventory_reels for each row execute function shop_private.reel_revision();

create function shop_private.reel_availability(p_shop uuid,p_location uuid,p_product uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('baseUnitCode',(select base_unit_code from public.products where id=p_product and shop_id=p_shop),'reelCount',count(*),'onHand',trim_scale(coalesce(sum(remaining_length),0))::text,
 'available',trim_scale(coalesce(sum(remaining_length) filter(where status in('sealed','open') and classification in('sellable','discounted')),0))::text,
 'largestContinuous',trim_scale(coalesce(max(remaining_length) filter(where status in('sealed','open') and classification in('sellable','discounted')),0))::text,
 'largestAutomatic',trim_scale(coalesce(max(remaining_length) filter(where status in('sealed','open') and classification='sellable'),0))::text,'automaticAvailable',trim_scale(coalesce(sum(remaining_length) filter(where status in('sealed','open') and classification='sellable'),0))::text,
 'sealedByLength',(select coalesce(jsonb_object_agg(trim_scale(length)::text,n),'{}') from(select remaining_length length,count(*) n from public.inventory_reels where shop_id=p_shop and location_id=p_location and product_id=p_product and status='sealed' and classification='sellable' group by remaining_length)q),
 'sealedCount',count(*) filter(where status='sealed' and classification='sellable'))
 from public.inventory_reels where shop_id=p_shop and location_id=p_location and product_id=p_product and status<>'archived';
$$;
revoke all on function shop_private.reel_availability(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.inventory_reel_context(p_shop_id uuid,p_location_id uuid,p_product_id uuid default null,p_search text default null,p_page integer default 1,p_page_size integer default 20,p_reel_id uuid default null,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;total bigint;costs boolean;history jsonb;history_total bigint;enabled boolean;begin
 perform shop_private.assert_inventory_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 costs:=shop_private.has_permission(p_shop_id,'reports.cost_profit.view');
 select inventory_enabled into enabled from shop_private.inventory_access(p_shop_id);
 if p_page<1 or p_page_size not between 1 and 100 or p_history_page<1 or length(coalesce(p_search,''))>160 then raise exception 'INVALID_REEL_QUERY' using errcode='22023';end if;
 if p_product_id is not null and not exists(select 1 from public.products where id=p_product_id and shop_id=p_shop_id) then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_reel_id is not null and not exists(select 1 from public.inventory_reels where id=p_reel_id and shop_id=p_shop_id and location_id=p_location_id) then raise exception 'REEL_NOT_FOUND' using errcode='P0002';end if;
 with rows as(select r.*,p.name,p.sku,p.base_unit_code,b.unit_cost,count(*) over() total_count from public.inventory_reels r join public.products p on p.id=r.product_id and p.shop_id=r.shop_id join public.inventory_batches b on b.id=r.batch_id
 where r.shop_id=p_shop_id and r.location_id=p_location_id and (p_product_id is null or r.product_id=p_product_id)
 and (nullif(btrim(p_search),'') is null or r.barcode ilike '%'||btrim(p_search)||'%' or p.name ilike '%'||btrim(p_search)||'%' or coalesce(r.storage_position,'') ilike '%'||btrim(p_search)||'%')),
 paged as(select * from rows order by created_at desc,id offset(p_page-1)*p_page_size limit p_page_size)
 select (select count(*) from rows),coalesce(jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'name',name,'sku',sku,'barcode',barcode,'unit',base_unit_code,
 'originalLength',trim_scale(original_length)::text,'remainingLength',trim_scale(remaining_length)::text,'reservedLength','0','status',status,'classification',classification,'storagePosition',storage_position,'revision',revision,
 'remnantPrice',remnant_price,'lastMovementAt',last_movement_at,'value',case when costs then remaining_length*unit_cost else null end) order by created_at desc,id),'[]') into total,items from paged;
 select count(*) into history_total from public.inventory_reel_movements where shop_id=p_shop_id and location_id=p_location_id and reel_id=p_reel_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'quantityChange',trim_scale(m.quantity_change)::text,'valueChange',case when costs then m.value_change else null end,'reason',m.reason,'createdAt',m.created_at,'actorName',profile.display_name,'snapshot',m.snapshot) order by m.created_at desc,m.id desc),'[]') into history
 from(select * from public.inventory_reel_movements where shop_id=p_shop_id and location_id=p_location_id and reel_id=p_reel_id order by created_at desc,id desc offset(p_history_page-1)*20 limit 20)m left join public.profiles profile on profile.id=m.actor_profile_id;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',p_page_size,'canManage',enabled and shop_private.has_permission(p_shop_id,'inventory.manage'),
 'canCount',enabled and shop_private.has_permission(p_shop_id,'inventory.manage') and shop_private.has_permission(p_shop_id,'inventory.adjust'),'canSetPrices',shop_private.has_permission(p_shop_id,'products.manage'),'canViewCosts',costs,
 'summary',case when p_product_id is not null then shop_private.reel_availability(p_shop_id,p_location_id,p_product_id) else jsonb_build_object('reelCount',total) end,
 'history',history,'historyTotal',history_total);
end;$$;
revoke all on function public.inventory_reel_context(uuid,uuid,uuid,text,integer,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.inventory_reel_context(uuid,uuid,uuid,text,integer,integer,uuid,integer) to authenticated;

create function public.pos_reel_options(p_shop_id uuid,p_location_id uuid,p_product_id uuid,p_search text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$declare items jsonb;total bigint;begin
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if not coalesce((select can_manage from shop_private.sale_access(p_shop_id)),false) then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501';end if;
 if p_page<1 or length(coalesce(p_search,''))>160 or not shop_private.is_reel_tracked(p_shop_id,p_product_id) then raise exception 'INVALID_REEL_QUERY' using errcode='22023';end if;
 with rows as(select r.*,b.received_at,count(*) over() total_count from public.inventory_reels r join public.inventory_batches b on b.id=r.batch_id
 where r.shop_id=p_shop_id and r.location_id=p_location_id and r.product_id=p_product_id and r.status in('sealed','open') and r.classification in('sellable','discounted') and r.remaining_length>0
 and(nullif(btrim(p_search),'') is null or r.barcode ilike '%'||btrim(p_search)||'%' or coalesce(r.storage_position,'') ilike '%'||btrim(p_search)||'%')),
 paged as(select * from rows order by received_at,id offset(p_page-1)*20 limit 20)
 select (select count(*) from rows),coalesce(jsonb_agg(jsonb_build_object('id',id,'barcode',barcode,'remainingLength',trim_scale(remaining_length)::text,'originalLength',trim_scale(original_length)::text,'status',status,'classification',classification,'price',remnant_price,'storagePosition',storage_position,'revision',revision) order by received_at,id),'[]') into total,items from paged;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20,'summary',shop_private.reel_availability(p_shop_id,p_location_id,p_product_id));
end;$$;
revoke all on function public.pos_reel_options(uuid,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.pos_reel_options(uuid,uuid,uuid,text,integer) to authenticated;

create function public.update_inventory_reel(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_reel_id uuid,p_revision integer,p_action text,p_values jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid;r public.inventory_reels%rowtype;b public.inventory_batches%rowtype;prior shop_private.reel_operation_requests%rowtype;product uuid;payload jsonb;
 target numeric;delta numeric:=0;price numeric;kind text;v_classification text;new_status text;position text;counted_at timestamptz;reference text;expected numeric;
 movement uuid;result uuid:=gen_random_uuid();begin
 actor:=shop_private.assert_inventory_write_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_revision is null or p_action not in('count','classify','archive') or p_values is null or jsonb_typeof(p_values)<>'object'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception 'INVALID_REEL_OPERATION' using errcode='22023';end if;
 payload:=jsonb_build_array(p_location_id,p_reel_id,p_revision,p_action,p_values,btrim(p_reason));
 perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text||':reel-request:'||p_request_id::text,0));
 select * into prior from shop_private.reel_operation_requests where shop_id=p_shop_id and request_id=p_request_id;
 if found then if prior.actor_profile_id<>actor or prior.payload<>payload then raise exception 'REEL_REQUEST_CONFLICT' using errcode='23505';end if;return prior.result_id;end if;
 select product_id into product from public.inventory_reels where id=p_reel_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'REEL_NOT_FOUND' using errcode='P0002';end if;
 perform 1 from public.products where id=product and shop_id=p_shop_id for update;
 select * into r from public.inventory_reels where id=p_reel_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if r.revision<>p_revision or r.status='archived' then raise exception 'REEL_CONTEXT_CHANGED' using errcode='55000';end if;
 actor:=shop_private.assert_inventory_write_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 select * into b from public.inventory_batches where id=r.batch_id and shop_id=p_shop_id and location_id=p_location_id for update;
 v_classification:=r.classification;new_status:=r.status;position:=r.storage_position;price:=r.remnant_price;
 if p_action='count' then
  perform shop_private.assert_team_permission(p_shop_id,'inventory.adjust');
  if(p_values-array['quantity','countedAt','reference'])<>'{}' or p_values->>'quantity' !~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then raise exception 'INVALID_REEL_COUNT' using errcode='22023';end if;
  target:=(p_values->>'quantity')::numeric;counted_at:=(p_values->>'countedAt')::timestamptz;reference:=btrim(p_values->>'reference');
  if target is null or counted_at is null or counted_at>now()+interval '5 minutes' or reference is null or length(reference) not between 1 and 200 then raise exception 'INVALID_REEL_COUNT' using errcode='22023';end if;
  perform shop_private.assert_measured_quantity(p_shop_id,product,target,true);delta:=target-r.remaining_length;
  if b.remaining_quantity+delta>b.quantity_received then raise exception 'REEL_COUNT_EXCEEDS_RECEIVED_QUANTITY' using errcode='23514';end if;
  perform shop_private.assert_period_is_open(p_shop_id,counted_at);
  select coalesce(sum(remaining_quantity),0) into expected from public.inventory_batches where shop_id=p_shop_id and location_id=p_location_id and product_id=product;
  insert into public.stock_counts(id,shop_id,location_id,product_id,expected_quantity,counted_quantity,variance_quantity,positive_variance_unit_cost,reason,external_reference,counted_at,created_by_profile_id)
  values(p_request_id,p_shop_id,p_location_id,product,expected,expected+delta,delta,case when delta>0 then b.unit_cost end,btrim(p_reason),reference,counted_at,actor);
  result:=p_request_id;kind:='count';new_status:=case when target=0 then 'empty' when r.status='sealed' and target=r.original_length then 'sealed' when r.status='damaged' then 'damaged' else 'open' end;
 elsif p_action='classify' then
  if(p_values-array['classification','price','storagePosition'])<>'{}' or coalesce(p_values->>'classification','') not in('sellable','discounted','damaged','scrap') then raise exception 'INVALID_REEL_CLASSIFICATION' using errcode='22023';end if;
  v_classification:=p_values->>'classification';position:=nullif(btrim(p_values->>'storagePosition'),'');
  if length(position)>160 then raise exception 'INVALID_REEL_STORAGE_POSITION' using errcode='22023';end if;
  if v_classification='discounted' then
   if p_values->>'price' !~ '^[0-9]{1,9}(\.[0-9]{1,6})?$' then raise exception 'INVALID_REMNANT_PRICE' using errcode='22023';end if;
   price:=(p_values->>'price')::numeric;
   if price is null or price>999999999.99 then raise exception 'INVALID_REMNANT_PRICE' using errcode='22023';end if;
   if r.classification<>'discounted' or r.remnant_price is distinct from price then perform shop_private.assert_team_permission(p_shop_id,'products.manage');end if;
  else price:=null;end if;
  kind:='classification';new_status:=case when r.remaining_length=0 then 'empty' when v_classification='damaged' then 'damaged' when r.status='sealed' then 'sealed' else 'open' end;
  if v_classification='scrap' then perform shop_private.assert_team_permission(p_shop_id,'inventory.adjust');delta:=-r.remaining_length;new_status:='empty';kind:='scrap';end if;
  perform shop_private.assert_period_is_open(p_shop_id,clock_timestamp());
 else
  if r.remaining_length<>0 or p_values<>'{}' then raise exception 'ONLY_EMPTY_REEL_CAN_BE_ARCHIVED' using errcode='23514';end if;
  new_status:='archived';kind:='classification';perform shop_private.assert_period_is_open(p_shop_id,clock_timestamp());
 end if;
 if delta<>0 then
  update public.inventory_batches set remaining_quantity=remaining_quantity+delta where id=b.id;
  insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,created_at)
  values(p_shop_id,p_location_id,product,b.id,delta,case when delta>0 then 'in'::public.inventory_movement_type else 'out'::public.inventory_movement_type end,result,actor,b.unit_cost,coalesce(counted_at,clock_timestamp())) returning id into movement;
 end if;
 update public.inventory_reels set remaining_length=remaining_length+delta,status=new_status,classification=v_classification,remnant_price=price,storage_position=position where id=r.id;
 insert into public.inventory_reel_movements(id,shop_id,location_id,reel_id,kind,quantity_change,value_change,inventory_movement_id,reference_id,reason,snapshot,actor_profile_id)
 values(gen_random_uuid(),p_shop_id,p_location_id,r.id,kind,delta,delta*b.unit_cost,movement,result,btrim(p_reason),jsonb_build_object('previousLength',trim_scale(r.remaining_length)::text,'remainingLength',trim_scale(r.remaining_length+delta)::text,'previousClassification',r.classification,'classification',v_classification,'status',new_status,'storagePosition',position,'remnantPrice',price,'previousRevision',r.revision),actor);
 insert into shop_private.reel_operation_requests(shop_id,request_id,kind,payload,result_id,actor_profile_id) values(p_shop_id,p_request_id,p_action,payload,result,actor);
 return result;
end;$$;
revoke all on function public.update_inventory_reel(uuid,uuid,uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.update_inventory_reel(uuid,uuid,uuid,uuid,integer,text,jsonb,text) to authenticated;

alter table public.inventory_reel_cuts add constraint inventory_reel_sale_movement_unique unique(sale_movement_id);
create table public.inventory_reel_return_approvals(
 return_id uuid not null references public.sale_returns(id),line_id uuid not null references public.invoice_items(id),shop_id uuid not null references public.shops(id),location_id uuid not null,
 quantity numeric(18,6) not null check(quantity>0),actor_profile_id uuid not null references public.profiles(id),reason text not null,created_at timestamptz not null default clock_timestamp(),
 primary key(return_id,line_id),foreign key(location_id,shop_id) references public.shop_locations(id,shop_id)
);
alter table public.inventory_reel_return_approvals enable row level security;
revoke all on public.inventory_reel_return_approvals from public,anon,authenticated,service_role;
grant select on public.inventory_reel_return_approvals to authenticated,service_role;
create policy reel_approvals_read on public.inventory_reel_return_approvals for select to authenticated using(shop_private.has_permission(shop_id,'inventory.view') and shop_private.user_can_access_location(shop_id,location_id));
create policy reel_approvals_service_read on public.inventory_reel_return_approvals for select to service_role using(true);
create trigger reel_approvals_immutable before update or delete on public.inventory_reel_return_approvals for each row execute function shop_private.measurement_history_immutable();

create function shop_private.restore_returned_reel(p_shop uuid,p_location uuid,p_return uuid,p_source_movement uuid,p_quantity numeric,p_restoration uuid,p_actor uuid) returns void
language plpgsql set search_path='' as $$declare cut public.inventory_reel_cuts%rowtype;source public.inventory_reels%rowtype;batch public.inventory_batches%rowtype;new_reel uuid:=gen_random_uuid();begin
 select * into cut from public.inventory_reel_cuts where shop_id=p_shop and location_id=p_location and sale_movement_id=p_source_movement;
 if not found then return;end if;
 select * into source from public.inventory_reels where id=cut.reel_id and shop_id=p_shop and location_id=p_location;
 select * into batch from public.inventory_batches where id=source.batch_id and shop_id=p_shop and location_id=p_location;
 if p_restoration is not null then
  insert into public.inventory_reels(id,shop_id,location_id,product_id,batch_id,barcode,original_length,remaining_length,status,source_reel_id,source_return_id,created_by_profile_id)
  values(new_reel,p_shop,p_location,source.product_id,source.batch_id,'RETURN-'||new_reel::text,p_quantity,p_quantity,
   case when cut.kind='sealed_sale' and p_quantity=cut.requested_length then 'sealed' else 'open' end,source.id,p_return,p_actor);
  insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,inventory_movement_id,reference_id,reason,snapshot,actor_profile_id)
  values(p_shop,p_location,new_reel,'return',p_quantity,p_quantity*batch.unit_cost,p_restoration,p_return,'Eligible returned cable piece',jsonb_build_object('sourceReelId',source.id,'sourceCutId',cut.id,'returnId',p_return),p_actor);
 end if;
 -- A return is a separate physical piece; it cannot increase the source reel's
 -- continuous length. Damaged returns retain history without restoring stock.
 insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,reference_id,reason,snapshot,actor_profile_id)
 values(p_shop,p_location,source.id,'return',0,0,p_return,'Original reel return reference',jsonb_build_object('returnedQuantity',trim_scale(p_quantity)::text,'sourceCutId',cut.id,'restocked',p_restoration is not null,'returnedReelId',case when p_restoration is not null then new_reel else null end),p_actor);
end;$$;
revoke all on function shop_private.restore_returned_reel(uuid,uuid,uuid,uuid,numeric,uuid,uuid) from public,anon,authenticated,service_role;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.return_plan(uuid,uuid,uuid,jsonb)'::regprocedure) is distinct from '480026777c3d16b883371b0f8be7ab99' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.return_plan' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.return_plan(p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_lines jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid;requires_approval boolean;is_cut boolean;policy jsonb;package_factor numeric;sale public.invoices%rowtype; source jsonb; item jsonb; line public.invoice_items%rowtype; frozen jsonb; prior numeric; qty numeric;
 components jsonb; rows jsonb:='[]'; allocations jsonb:='[]'; total numeric:=0; tax numeric:=0; due numeric; needed numeric; take_amount numeric; receipt_part record;
begin
 actor:=shop_private.return_actor(p_shop_id,p_location_id);
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id for update;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 if sale.status<>'issued' or exists(select 1 from public.sale_corrections where invoice_id=sale.id) then raise exception 'SALE_NOT_RETURNABLE' using errcode='23514';end if;
 source:=shop_private.return_source(sale.id);
 if source is null or source->>'currency' is distinct from sale.currency then raise exception 'RETURN_ORIGINAL_SNAPSHOT_UNSUPPORTED' using errcode='55000';end if;
 if p_lines is null or jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 100
 or exists(select 1 from jsonb_array_elements(p_lines)e group by e->>'lineId' having count(*)>1) then
  raise exception 'INVALID_RETURN_LINES' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(p_lines) order by value->>'lineId' loop
  requires_approval:=false;
  if item ? 'approveCut' and jsonb_typeof(item->'approveCut') is distinct from 'boolean' then raise exception 'INVALID_REEL_RETURN_APPROVAL' using errcode='22023';end if;
  qty:=(item->>'quantity')::numeric;
  if jsonb_typeof(item->'quantity') is distinct from 'number' or qty is null or qty<=0 or qty>1000000 or round(qty,6)<>qty
   or (item-array['lineId','quantity','disposition','approveCut'])<>'{}'::jsonb then raise exception 'INVALID_RETURN_QUANTITY_PRECISION' using errcode='22023';end if;
  select * into line from public.invoice_items where id=(item->>'lineId')::uuid and invoice_id=sale.id and shop_id=p_shop_id;
  if not found then raise exception 'RETURN_LINE_NOT_FOUND' using errcode='P0002';end if;
  if (line.item_type='service' and item->>'disposition' is distinct from 'service') or (line.item_type='product' and coalesce(item->>'disposition','') not in('resellable','damaged')) then
   raise exception 'INVALID_RETURN_DISPOSITION' using errcode='22023';end if;
  select value into frozen from jsonb_array_elements(source->'lines') where value->>'id'=line.id::text;
  if frozen is null or (frozen->>'originalQuantity')::numeric<>line.quantity then raise exception 'RETURN_ORIGINAL_SNAPSHOT_UNSUPPORTED' using errcode='55000';end if;
  if line.measurement_snapshot is null and round(qty,2)<>qty then raise exception 'INVALID_RETURN_QUANTITY_PRECISION' using errcode='22023';end if;
  if line.measurement_snapshot is null and round(line.quantity,2)<>line.quantity then raise exception 'RETURN_ORIGINAL_QUANTITY_PRECISION_UNSUPPORTED' using errcode='55000';end if;
  if line.measurement_snapshot is not null and mod(qty,(line.measurement_snapshot->>'quantityIncrement')::numeric)<>0 then raise exception 'INVALID_MEASUREMENT_INCREMENT' using errcode='22023';end if;
  if coalesce((line.measurement_snapshot->>'reelTracking')::boolean,false) then
   policy:=line.measurement_snapshot->'reelReturnPolicy';
   package_factor:=case when line.measurement_snapshot->>'packageId' is not null then (line.measurement_snapshot->>'baseQuantity')::numeric/(line.measurement_snapshot->>'enteredQuantity')::numeric else null end;
   is_cut:=package_factor is null or mod(qty,package_factor)<>0;
   if not is_cut and item->>'disposition'='resellable' and not coalesce((policy->>'unopenedResellable')::boolean,true) then raise exception 'REEL_UNOPENED_RETURN_NOT_RESELLABLE' using errcode='23514';end if;
   requires_approval:=is_cut and coalesce((policy->>'cutRequiresManagerApproval')::boolean,true);
   if requires_approval and (coalesce((item->>'approveCut')::boolean,false) is not true or not shop_private.has_permission(p_shop_id,'inventory.manage')) then raise exception 'REEL_CUT_RETURN_APPROVAL_REQUIRED' using errcode='42501';end if;
  end if;
  select coalesce(sum(quantity),0) into prior from public.sale_return_lines where line_id=line.id;
  if qty+prior>line.quantity then raise exception 'RETURN_QUANTITY_EXCEEDED' using errcode='23514';end if;
  components:=shop_private.tax_return_components(frozen,prior+qty,prior);
  total:=total+(components->>'total')::numeric;tax:=tax+(components->>'tax')::numeric;
  rows:=rows||jsonb_build_array(item||components||jsonb_build_object('originalSnapshot',frozen,'cumulativeQuantity',prior+qty,'cutApproval',case when requires_approval then jsonb_build_object('actorProfileId',actor) else null end));
 end loop;
 -- Same allocation locks used by legacy refunds; verify again after waiting.
 perform a.id from public.customer_payment_allocations a where a.invoice_id=sale.id order by a.id for update;
 due:=shop_private.invoice_outstanding(sale.id);needed:=greatest(total-due,0);
 for receipt_part in select a.id,a.payment_id,p.method,p.paid_at,shop_private.allocation_remaining(a.id) capacity
  from public.customer_payment_allocations a join public.payments p on p.id=a.payment_id and p.shop_id=a.shop_id
  where a.invoice_id=sale.id and p.customer_kind='receipt' and p.status='completed' order by p.paid_at,p.id,a.id loop
  take_amount:=least(needed,receipt_part.capacity);
  if take_amount>0 then allocations:=allocations||jsonb_build_array(jsonb_build_object('allocationId',receipt_part.id,'paymentId',receipt_part.payment_id,'method',receipt_part.method,'amount',take_amount));needed:=needed-take_amount;end if;
 end loop;
 if needed>0 then raise exception 'RETURN_REFUND_CAPACITY_UNAVAILABLE' using errcode='23514';end if;
 return jsonb_build_object('version',1,'currency',sale.currency,'lines',rows,'total',total,'tax',tax,'net',total-tax,
  'dueBefore',due,'debtReduction',least(total,due),'refundDue',greatest(total-due,0),'dueAfter',greatest(due-total,0),'allocations',allocations,
  'originalDocument',jsonb_build_object('invoiceId',sale.id,'invoiceNumber',sale.invoice_number,'issuedAt',sale.issued_at,
   'receiptId',(select invoice_id from public.sale_receipts where invoice_id=sale.id),'etaSourceAvailable',exists(select 1 from public.eta_sale_sources where invoice_id=sale.id)));
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.create_sale_return(uuid,uuid,uuid,uuid,jsonb,text,jsonb)'::regprocedure) is distinct from 'f10f75c1d110584b0b82074940ef79ac' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: public.create_sale_return' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.create_sale_return(p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_lines jsonb, p_reason text, p_expected_plan jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare actor uuid; payload jsonb; previous public.sale_returns%rowtype; plan jsonb; result uuid:=gen_random_uuid(); item jsonb; refund_part jsonb;
 line public.invoice_items%rowtype; fifo_part record; needed numeric; take_qty numeric; movement uuid; refund uuid; stamp timestamptz:=clock_timestamp();
begin
 actor:=shop_private.return_actor(p_shop_id,p_location_id);
 if p_request_id is null or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 or p_expected_plan is null then raise exception 'INVALID_RETURN_REQUEST' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('return:'||p_shop_id::text||':'||p_request_id::text,0));
 payload:=jsonb_build_array(p_location_id,p_invoice_id,p_lines,btrim(p_reason),p_expected_plan);
 select * into previous from public.sale_returns where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if previous.payload<>payload or previous.actor_profile_id<>actor then raise exception 'RETURN_REQUEST_CONFLICT' using errcode='23505';end if;
  return previous.id;
 end if;
 perform shop_private.assert_period_is_open(p_shop_id,stamp);
 plan:=shop_private.return_plan(p_shop_id,p_location_id,p_invoice_id,p_lines);
 if plan<>p_expected_plan then raise exception 'RETURN_PREVIEW_CHANGED' using errcode='40001';end if;
 insert into public.sale_returns(id,shop_id,location_id,invoice_id,request_id,payload,currency,original_document,total,net,tax,due_before,debt_reduction,refund_due,due_after,reason,actor_profile_id,created_at)
 values(result,p_shop_id,p_location_id,p_invoice_id,p_request_id,payload,plan->>'currency',plan->'originalDocument',(plan->>'total')::numeric,(plan->>'net')::numeric,(plan->>'tax')::numeric,
  (plan->>'dueBefore')::numeric,(plan->>'debtReduction')::numeric,(plan->>'refundDue')::numeric,(plan->>'dueAfter')::numeric,btrim(p_reason),actor,stamp);
 -- Product and batch lock order agrees with stock commands. Track damaged FIFO
 -- allocations too, so later resellable returns cannot restore them a second time.
 perform p.id from public.products p where p.id in(select l.product_id from public.invoice_items l join jsonb_array_elements(p_lines)e on (e->>'lineId')::uuid=l.id) order by p.id for update;
 perform b.id from public.inventory_batches b where b.id in(select m.batch_id from public.inventory_movements m where m.reference_id=p_invoice_id and m.invoice_item_id in(select (e->>'lineId')::uuid from jsonb_array_elements(p_lines)e)) order by b.id for update;
 for item in select value from jsonb_array_elements(plan->'lines') loop
  select * into line from public.invoice_items where id=(item->>'lineId')::uuid;
  insert into public.sale_return_lines(return_id,shop_id,line_id,quantity,disposition,original_snapshot,total,net,tax)
  values(result,p_shop_id,line.id,(item->>'quantity')::numeric,item->>'disposition',item->'originalSnapshot',(item->>'total')::numeric,(item->>'net')::numeric,(item->>'tax')::numeric);
  if line.item_type='product' then
   needed:=(item->>'quantity')::numeric;
   for fifo_part in select m.*,abs(m.quantity_change)-coalesce((select sum(s.quantity) from public.sale_return_stock s where s.movement_id=m.id),0) capacity
    from public.inventory_movements m join public.inventory_batches b on b.id=m.batch_id
    where m.reference_id=p_invoice_id and m.invoice_item_id=line.id and m.product_id=line.product_id and m.shop_id=p_shop_id
     and m.location_id=p_location_id and m.movement_type='out' and m.sale_correction_id is null
     and not exists(select 1 from public.service_material_consumptions c where c.movement_id=m.id)
    order by b.received_at,b.id,m.id loop
    take_qty:=least(needed,fifo_part.capacity);if take_qty<=0 then continue;end if;
    if fifo_part.unit_cost_snapshot is null or round(take_qty,6)<>take_qty then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
    movement:=null;
    if item->>'disposition'='resellable' then
     update public.inventory_batches set remaining_quantity=remaining_quantity+take_qty where id=fifo_part.batch_id and shop_id=p_shop_id and location_id=p_location_id;
     if not found then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
     insert into public.inventory_movements(shop_id,location_id,product_id,batch_id,quantity_change,movement_type,reference_id,created_by_profile_id,unit_cost_snapshot,invoice_item_id)
     values(p_shop_id,p_location_id,fifo_part.product_id,fifo_part.batch_id,take_qty,'in',result,actor,fifo_part.unit_cost_snapshot,line.id) returning id into movement;
    end if;
    perform shop_private.restore_returned_reel(p_shop_id,p_location_id,result,fifo_part.id,take_qty,movement,actor);
    insert into public.sale_return_stock(return_id,line_id,movement_id,quantity,disposition,restoration_movement_id)
    values(result,line.id,fifo_part.id,take_qty,item->>'disposition',movement);
    needed:=needed-take_qty;if needed=0 then exit;end if;
   end loop;
   if needed<>0 then raise exception 'RETURN_FIFO_LINEAGE_UNSUPPORTED' using errcode='55000';end if;
  end if;
 end loop;
 for item in select value from jsonb_array_elements(plan->'lines') loop
  if item->'cutApproval' is not null and item->'cutApproval'<>'null'::jsonb then
   insert into public.inventory_reel_return_approvals(return_id,line_id,shop_id,location_id,quantity,actor_profile_id,reason)
   values(result,(item->>'lineId')::uuid,p_shop_id,p_location_id,(item->>'quantity')::numeric,actor,btrim(p_reason));
  end if;
 end loop;
 for refund_part in select value from jsonb_array_elements(plan->'allocations') loop
  insert into public.sale_return_refunds(return_id,shop_id,allocation_id,payment_id,amount,method)
  values(result,p_shop_id,(refund_part->>'allocationId')::uuid,(refund_part->>'paymentId')::uuid,(refund_part->>'amount')::numeric,(refund_part->>'method')::public.payment_method) returning id into refund;
  insert into public.sale_return_refund_events(refund_id,shop_id,request_id,state,operation,reference,reason,actor_profile_id)
  values(refund,p_shop_id,refund,'pending','reserved','',btrim(p_reason),actor);
 end loop;
 perform shop_private.reconcile_commission(p_invoice_id);
 return result;
end;$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.sale_return_context(uuid,uuid,uuid,integer)'::regprocedure) is distinct from '8bc15b95655eeb78c46b4e658074ad5e' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: public.sale_return_context' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION public.sale_return_context(p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_offset integer DEFAULT 0) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare sale public.invoices%rowtype; source jsonb; allowed boolean:=true;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_payment_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_offset<0 or p_offset>100000 then raise exception 'INVALID_RETURN_OFFSET' using errcode='22023';end if;
 select * into sale from public.invoices where id=p_invoice_id and shop_id=p_shop_id and location_id=p_location_id;
 if not found then raise exception 'SALE_NOT_FOUND' using errcode='P0002';end if;
 begin perform shop_private.return_actor(p_shop_id,p_location_id);exception when insufficient_privilege then allowed:=false;end;
 source:=shop_private.return_source(sale.id);
 if exists(select 1 from public.invoice_items where invoice_id=sale.id and measurement_snapshot is null and round(quantity,2)<>quantity) then source:=null;end if;
 return jsonb_build_object('version',1,'canReturn',allowed and sale.status='issued' and source is not null and not exists(select 1 from public.sale_corrections where invoice_id=sale.id),
 'canApproveCuts',shop_private.has_permission(p_shop_id,'inventory.manage'),'supported',source is not null,'due',shop_private.invoice_outstanding(sale.id),'currency',sale.currency,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'name',l.item_name,'itemType',l.item_type,'quantity',l.quantity,'measurement',l.measurement_snapshot,
  'remaining',l.quantity-coalesce((select sum(quantity) from public.sale_return_lines where line_id=l.id),0)) order by l.line_order,l.id),'[]'::jsonb) from public.invoice_items l where l.invoice_id=sale.id),
 'totalCount',(select count(*) from public.sale_returns where invoice_id=sale.id),
 'history',(select coalesce(jsonb_agg(shop_private.return_document(r.id) order by r.created_at desc,r.id desc),'[]'::jsonb)
  from(select id,created_at from public.sale_returns where invoice_id=sale.id order by created_at desc,id desc offset p_offset limit 50)r));
end;$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.pos_measurement(uuid,uuid)'::regprocedure) is distinct from '0695104b20c87f2e3c314210a69bcf0a' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: pos_measurement' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.pos_measurement(p_shop_id uuid, p_product_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO ''
    AS $$
 select case when p.measurement_status='active' then jsonb_build_object('baseUnitCode',p.base_unit_code,'increment',trim_scale(p.quantity_increment)::text,'revision',p.measurement_revision,'saleUnits',p.sale_unit_codes,'baseUnitPrice',trim_scale(p.sale_price)::text,'reelTracking',shop_private.is_reel_tracked(p_shop_id,p_product_id),
 'packages',(select coalesce(jsonb_agg(jsonb_build_object('id',k.id,'code',k.code,'name',k.name,'unitCode',k.unit_code,'baseQuantity',trim_scale(k.base_quantity)::text,'containedQuantity',trim_scale(k.contained_quantity)::text,'containedUnitCode',k.contained_unit_code,'version',k.version,'salePrice',k.sale_price,'barcode',k.barcode,'canSell',k.can_sell,'canPurchase',k.can_purchase,'defaultSale',k.default_sale,'defaultPurchase',k.default_purchase) order by k.name,k.id),'[]') from public.product_packagings k where k.shop_id=p.shop_id and k.product_id=p.id and k.active)) else null end from public.products p where p.shop_id=p_shop_id and p.id=p_product_id;
$$;


-- Supplier withdrawals preserve physical provenance and the original acquisition cost.
create function shop_private.withdraw_purchase_reels(p_batch uuid,p_quantity numeric,p_reel uuid,p_reference uuid,p_actor uuid,p_kind text,p_reason text) returns void
language plpgsql set search_path='' as $$
declare b public.inventory_batches%rowtype;r public.inventory_reels%rowtype;left_qty numeric:=p_quantity;take_qty numeric;
begin
 select * into strict b from public.inventory_batches where id=p_batch;
 if not shop_private.is_reel_tracked(b.shop_id,b.product_id) then return;end if;
 perform shop_private.assert_measured_quantity(b.shop_id,b.product_id,p_quantity,false);
 for r in select * from public.inventory_reels where batch_id=b.id and remaining_length>0 and status<>'archived' and (p_reel is null or id=p_reel) order by created_at,id for update loop
  take_qty:=least(left_qty,r.remaining_length);
  update public.inventory_reels set remaining_length=remaining_length-take_qty,status=case when remaining_length=take_qty then 'empty' else 'open' end where id=r.id;
  insert into public.inventory_reel_movements(shop_id,location_id,reel_id,kind,quantity_change,value_change,reference_id,reason,snapshot,actor_profile_id)
  values(b.shop_id,b.location_id,r.id,p_kind,-take_qty,-take_qty*b.unit_cost,p_reference,left('Supplier withdrawal: '||p_reason,1000),jsonb_build_object('batchId',b.id,'barcode',r.barcode,'withdrawnLength',trim_scale(take_qty)::text),p_actor);
  left_qty:=left_qty-take_qty;exit when left_qty=0;
 end loop;
 if left_qty<>0 then raise exception 'PURCHASE_RETURN_REEL_UNAVAILABLE' using errcode='23514';end if;
end;$$;
revoke all on function shop_private.withdraw_purchase_reels(uuid,numeric,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.record_purchase_return(uuid,uuid,uuid,timestamp with time zone,text,text,jsonb)'::regprocedure) is distinct from '8320f369f1ce12fcea483a215c13c9ec' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.record_purchase_return' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.record_purchase_return(p_request_id uuid, p_shop_id uuid, p_purchase_id uuid, p_returned_at timestamp with time zone, p_reason text, p_reference text, p_items jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_profile_id uuid; v_request public.supplier_operation_requests%rowtype;
  v_invoice public.vendor_invoices%rowtype; v_items jsonb; v_count integer;
  v_distinct integer; v_total numeric; v_hash text; v_return_id uuid;
  v_credit_id uuid; v_item record; v_line record; v_batch public.inventory_batches%rowtype;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'purchase_returns.manage');
  if p_request_id is null or p_purchase_id is null or p_returned_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200 or p_items is null
    or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 100 then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end if;
  begin
    select jsonb_agg(jsonb_build_object('vendor_invoice_item_id', parsed.item_id,
      'quantity', parsed.quantity,'reel_id',parsed.reel_id) order by parsed.item_id), count(*), count(distinct parsed.item_id)
    into v_items, v_count, v_distinct from (select
      (entry ->> 'vendor_invoice_item_id')::uuid item_id,
      (entry ->> 'quantity')::numeric quantity,(entry->>'reel_id')::uuid reel_id from jsonb_array_elements(p_items) entry) parsed;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end;
  if v_count <> jsonb_array_length(p_items) or v_distinct <> v_count or exists (
    select 1 from jsonb_to_recordset(v_items) item(vendor_invoice_item_id uuid, quantity numeric)
    where item.vendor_invoice_item_id is null or item.quantity is null or item.quantity <= 0
      or item.quantity > 1000000 or round(item.quantity,6) <> item.quantity) then
    raise exception 'INVALID_PURCHASE_RETURN' using errcode = '22023'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_returned_at);
  v_hash := md5(jsonb_build_object('purchaseId', p_purchase_id,
    'returnedAt', p_returned_at, 'reason', btrim(p_reason),
    'reference', nullif(btrim(p_reference), ''), 'items', v_items)::text);
  insert into public.supplier_operation_requests
    (shop_id, operation, request_id, actor_profile_id, payload_hash)
  values (p_shop_id, 'return', p_request_id, v_profile_id, v_hash) on conflict do nothing;
  select * into v_request from public.supplier_operation_requests
  where shop_id = p_shop_id and operation = 'return' and request_id = p_request_id for update;
  if v_request.actor_profile_id <> v_profile_id or v_request.payload_hash <> v_hash then
    raise exception 'SUPPLIER_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.result_id; end if;
  select * into v_invoice from public.vendor_invoices where id = p_purchase_id
    and shop_id = p_shop_id and status = 'posted' for update;
  if not found or v_invoice.vendor_id is null then raise exception 'PURCHASE_RETURN_NOT_ELIGIBLE'; end if;
  perform product.id from public.products product join public.vendor_invoice_items line on line.product_id=product.id
    where line.vendor_invoice_id=p_purchase_id and product.shop_id=p_shop_id order by product.id for update of product;
  perform shop_private.assert_location_access(p_shop_id,v_invoice.location_id,true);
  perform batch.id from public.inventory_batches batch join public.vendor_invoice_items line
    on line.product_id = batch.product_id and line.vendor_invoice_id = p_purchase_id
  join jsonb_array_elements(v_items) item
    on (item ->> 'vendor_invoice_item_id')::uuid = line.id
  where batch.shop_id = p_shop_id and batch.source_type = 'vendor_invoice'
    and batch.source_id = p_purchase_id order by batch.product_id, batch.id for update of batch;
  v_total := 0;
  for v_item in select value from jsonb_array_elements(v_items) loop
    select line.* into v_line from public.vendor_invoice_items line
    where line.id = (v_item.value ->> 'vendor_invoice_item_id')::uuid
      and line.vendor_invoice_id = p_purchase_id;
    if not found then raise exception 'PURCHASE_RETURN_ITEM_NOT_FOUND'; end if;
    select * into v_batch from public.inventory_batches batch where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice' and batch.source_id = p_purchase_id
      and batch.product_id = v_line.product_id for update;
    if not found then raise exception 'PURCHASE_BATCHES_MISSING'; end if;
    if (v_item.value ->> 'quantity')::numeric > v_batch.remaining_quantity then
      raise exception 'PURCHASE_RETURN_STOCK_UNAVAILABLE' using errcode = '23514'; end if;
    v_total := v_total + round((v_item.value ->> 'quantity')::numeric * v_line.unit_cost, 2);
  end loop;
  if v_total <= 0 then raise exception 'ZERO_VALUE_PURCHASE_RETURN_REQUIRES_EXPLICIT_CREDIT' using errcode = '23514'; end if;
  if v_total > shop_private.purchase_payable(p_purchase_id) then
    raise exception 'SUPPLIER_CREDIT_EXCEEDS_PAYABLE' using errcode = '23514'; end if;
  insert into public.purchase_returns (shop_id, vendor_id, vendor_invoice_id,
    vendor_name_snapshot, returned_at, reason, reference, total_amount, created_by_profile_id)
  values (p_shop_id, v_invoice.vendor_id, p_purchase_id, v_invoice.vendor_name_snapshot,
    p_returned_at, btrim(p_reason), nullif(btrim(p_reference), ''), v_total, v_profile_id)
  returning id into v_return_id;
  for v_item in select value from jsonb_array_elements(v_items) loop
    select line.* into v_line from public.vendor_invoice_items line
    where line.id = (v_item.value ->> 'vendor_invoice_item_id')::uuid;
    select * into v_batch from public.inventory_batches batch where batch.shop_id = p_shop_id
      and batch.source_type = 'vendor_invoice' and batch.source_id = p_purchase_id
      and batch.product_id = v_line.product_id for update;
    perform shop_private.withdraw_purchase_reels(v_batch.id,(v_item.value->>'quantity')::numeric,(v_item.value->>'reel_id')::uuid,v_return_id,v_profile_id,'supplier_return',btrim(p_reason));
    update public.inventory_batches set remaining_quantity = remaining_quantity
      - (v_item.value ->> 'quantity')::numeric where id = v_batch.id;
    insert into public.purchase_return_items (shop_id, purchase_return_id,
      vendor_invoice_item_id, product_id, inventory_batch_id, quantity, unit_cost, total_amount)
    values (p_shop_id, v_return_id, v_line.id, v_line.product_id, v_batch.id,
      (v_item.value ->> 'quantity')::numeric, v_line.unit_cost,
      round((v_item.value ->> 'quantity')::numeric * v_line.unit_cost, 2));
    insert into public.inventory_movements (shop_id, product_id, batch_id,
      quantity_change, movement_type, reference_id, created_by_profile_id, unit_cost_snapshot)
    values (p_shop_id, v_line.product_id, v_batch.id,
      -(v_item.value ->> 'quantity')::numeric, 'adjustment', v_return_id,
      v_profile_id, v_line.unit_cost);
  end loop;
  insert into public.supplier_credits (shop_id, vendor_id, vendor_invoice_id,
    purchase_return_id, vendor_name_snapshot, amount, effective_at, reason,
    reference, created_by_profile_id)
  values (p_shop_id, v_invoice.vendor_id, p_purchase_id, v_return_id,
    v_invoice.vendor_name_snapshot, v_total, p_returned_at, btrim(p_reason),
    nullif(btrim(p_reference), ''), v_profile_id) returning id into v_credit_id;
  update public.supplier_operation_requests set result_id = v_return_id, completed_at = now()
  where shop_id = p_shop_id and operation = 'return' and request_id = p_request_id;
  return v_return_id;
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.void_supplier_purchase(uuid,uuid)'::regprocedure) is distinct from '740ca105c827b8912866e1a02ac25a9e' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.void_supplier_purchase' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.void_supplier_purchase(p_shop_id uuid, p_purchase_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_profile_id uuid; v_purchase public.vendor_invoices%rowtype; v_batch record;
begin
  v_profile_id := shop_private.assert_shop_write_access(p_shop_id, 'vendor_invoices.manage');
  perform shop_private.assert_purchase_entitlement(p_shop_id);
  select * into v_purchase from public.vendor_invoices
  where id = p_purchase_id and shop_id = p_shop_id for update;
  if not found then raise exception 'PURCHASE_NOT_FOUND'; end if;
  if v_purchase.status = 'void' then return; end if;
  if v_purchase.status <> 'posted' then raise exception 'PURCHASE_NOT_POSTED'; end if;
  perform shop_private.assert_period_is_open(p_shop_id, now());
  if exists (select 1 from public.supplier_payment_allocations where vendor_invoice_id = p_purchase_id)
    or exists (select 1 from public.supplier_credits where vendor_invoice_id = p_purchase_id)
    or exists (select 1 from public.purchase_returns where vendor_invoice_id = p_purchase_id) then
    raise exception 'PURCHASE_WITH_PAYABLE_HISTORY_CANNOT_BE_VOIDED' using errcode = '23514'; end if;
  perform product.id from public.products product join public.inventory_batches batch on batch.product_id=product.id
    where batch.shop_id=p_shop_id and batch.source_type='vendor_invoice' and batch.source_id=p_purchase_id order by product.id for update of product;
  perform shop_private.assert_location_access(p_shop_id,v_purchase.location_id,true);
  for v_batch in select batch.* from public.inventory_batches batch
    where batch.shop_id = p_shop_id and batch.source_type = 'vendor_invoice'
      and batch.source_id = p_purchase_id order by batch.product_id, batch.id for update
  loop
    if v_batch.remaining_quantity <> v_batch.quantity_received then
      raise exception 'PURCHASE_STOCK_ALREADY_USED' using errcode = '55000'; end if;
    perform shop_private.withdraw_purchase_reels(v_batch.id,v_batch.quantity_received,null,p_purchase_id,v_profile_id,'purchase_void','Unused purchase voided');
    update public.inventory_batches set remaining_quantity = 0 where id = v_batch.id;
    insert into public.inventory_movements (shop_id, product_id, batch_id,
      quantity_change, movement_type, reference_id, created_by_profile_id, unit_cost_snapshot)
    values (p_shop_id, v_batch.product_id, v_batch.id, -v_batch.quantity_received,
      'adjustment', p_purchase_id, v_profile_id, v_batch.unit_cost);
  end loop;
  update public.vendor_invoices set status = 'void', updated_at = now()
  where id = p_purchase_id and shop_id = p_shop_id and status = 'posted';
  if not found then raise exception 'PURCHASE_VOID_FAILED'; end if;
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.correct_sale(uuid,uuid,uuid,uuid,timestamp with time zone,text,text)'::regprocedure) is distinct from '27e825a93114c42625feeedd0acae4c3' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.correct_sale' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.correct_sale(p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid, p_effective_at timestamp with time zone, p_reason text, p_reference text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_actor uuid;
  v_invoice public.invoices%rowtype;
  v_existing public.sale_corrections%rowtype;
  v_correction_id uuid := gen_random_uuid();
  v_hash text;
  v_refund_total numeric := 0;
  v_restored_quantity numeric := 0;
  v_part record;
  v_movement record;
  v_refund_id uuid;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.issue');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if not shop_private.has_permission(p_shop_id, 'payments.refund') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_request_id is null or p_invoice_id is null or p_effective_at is null
    or length(btrim(coalesce(p_reason, ''))) < 2 or length(p_reason) > 1000
    or length(coalesce(p_reference, '')) > 200 then
    raise exception 'INVALID_SALE_CORRECTION' using errcode = '22023';
  end if;
  perform shop_private.assert_period_is_open(p_shop_id, p_effective_at);
  v_hash := md5(jsonb_build_object('locationId', p_location_id,
    'invoiceId', p_invoice_id, 'effectiveAt', p_effective_at,
    'reason', btrim(p_reason), 'reference', nullif(btrim(p_reference), ''))::text);

  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id for update;
  if found then
    if v_existing.payload_hash <> v_hash or v_existing.created_by_profile_id <> v_actor then
      raise exception 'SALE_CORRECTION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;

  select * into v_invoice from public.invoices invoice
  where invoice.id = p_invoice_id and invoice.shop_id = p_shop_id
    and invoice.location_id = p_location_id for update;
  if not found then raise exception 'SALE_NOT_FOUND' using errcode = 'P0002'; end if;
  -- A concurrent identical request may have completed while this transaction
  -- waited on the invoice serialization lock.
  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id;
  if found then
    if v_existing.payload_hash <> v_hash or v_existing.created_by_profile_id <> v_actor then
      raise exception 'SALE_CORRECTION_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  if v_invoice.status <> 'issued'::public.invoice_status then
    raise exception 'SALE_CORRECTION_REQUIRES_ISSUED_SALE' using errcode = '23514';
  end if;
  select * into v_existing from public.sale_corrections correction
  where correction.invoice_id = p_invoice_id for update;
  if found then raise exception 'SALE_ALREADY_CORRECTED' using errcode = '23514'; end if;

  if exists(select 1 from public.invoice_items line where line.invoice_id=p_invoice_id and coalesce((line.measurement_snapshot->>'reelTracking')::boolean,false)) then
    raise exception 'REEL_RETURN_REQUIRES_LINE_WORKFLOW' using errcode='23514';
  end if;
  -- Serialize against receipt reversals/refunds and calculate only the still
  -- effective portion of every receipt allocated to this sale.
  perform allocation.id from public.customer_payment_allocations allocation
  where allocation.invoice_id = p_invoice_id order by allocation.id for update;
  select coalesce(sum(shop_private.allocation_remaining(allocation.id)), 0)
  into v_refund_total from public.customer_payment_allocations allocation
  where allocation.invoice_id = p_invoice_id;
  if v_refund_total > v_invoice.total_amount then
    raise exception 'SALE_PAYMENT_RECONCILIATION_INVALID' using errcode = '23514';
  end if;

  perform product.id from public.products product join (
    select distinct movement.product_id from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
  ) affected on affected.product_id = product.id
  order by product.id for update of product;
  perform batch.id from public.inventory_batches batch join (
    select distinct movement.batch_id from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
  ) affected on affected.batch_id = batch.id
  order by batch.id for update of batch;
  select coalesce(sum(abs(movement.quantity_change)), 0)
  into v_restored_quantity from public.inventory_movements movement
  where movement.reference_id = p_invoice_id and movement.shop_id = p_shop_id
    and movement.location_id = p_location_id and movement.movement_type = 'out'
    and movement.sale_correction_id is null;

  insert into public.sale_corrections (
    id, request_id, shop_id, location_id, invoice_id, kind, payload_hash,
    effective_at, reason, reference, refund_amount, restored_quantity,
    created_by_profile_id
  ) values (
    v_correction_id, p_request_id, p_shop_id, p_location_id, p_invoice_id,
    case when v_refund_total > 0 then 'full_return'::public.sale_correction_kind
      else 'void'::public.sale_correction_kind end,
    v_hash, p_effective_at, btrim(p_reason), nullif(btrim(p_reference), ''),
    v_refund_total, v_restored_quantity, v_actor
  );

  for v_movement in
    select movement.* from public.inventory_movements movement
    where movement.reference_id = p_invoice_id and movement.shop_id = p_shop_id
      and movement.location_id = p_location_id and movement.movement_type = 'out'
      and movement.sale_correction_id is null
    order by movement.product_id, movement.batch_id, movement.id
  loop
    update public.inventory_batches batch
    set remaining_quantity = batch.remaining_quantity + abs(v_movement.quantity_change)
    where batch.id = v_movement.batch_id and batch.shop_id = p_shop_id
      and batch.location_id = p_location_id;
    if not found then raise exception 'SALE_FIFO_LAYER_NOT_FOUND' using errcode = '23514'; end if;
    insert into public.inventory_movements (
      shop_id, location_id, product_id, batch_id, quantity_change, movement_type,
      reference_id, created_by_profile_id, unit_cost_snapshot, invoice_item_id,
      sale_correction_id, reversal_of_movement_id
    ) values (
      p_shop_id, p_location_id, v_movement.product_id, v_movement.batch_id,
      abs(v_movement.quantity_change), 'in', p_invoice_id, v_actor,
      v_movement.unit_cost_snapshot, v_movement.invoice_item_id,
      v_correction_id, v_movement.id
    );
  end loop;

  for v_part in
    select allocation.id as allocation_id, allocation.payment_id,
      shop_private.allocation_remaining(allocation.id) as amount,
      payment.client_id, payment.method, payment.reference
    from public.customer_payment_allocations allocation
    join public.payments payment on payment.id = allocation.payment_id
      and payment.shop_id = allocation.shop_id
    where allocation.invoice_id = p_invoice_id
    order by allocation.id
  loop
    if v_part.amount > 0 then
      insert into public.payments (
        shop_id, location_id, payment_direction, invoice_id, client_id, amount,
        method, status, reference, paid_at, created_by_profile_id, notes,
        customer_kind, original_payment_id, sale_correction_id
      ) values (
        p_shop_id, p_location_id, 'out', p_invoice_id, v_part.client_id,
        v_part.amount, v_part.method, 'completed',
        coalesce(nullif(btrim(p_reference), ''), v_part.reference), p_effective_at,
        v_actor, btrim(p_reason), 'refund', v_part.payment_id, v_correction_id
      ) returning id into v_refund_id;
      insert into public.customer_payment_adjustments (
        shop_id, location_id, kind, adjustment_group_id, original_payment_id,
        original_allocation_id, refund_payment_id, amount, effective_at, reason,
        reference, created_by_profile_id, sale_correction_id
      ) values (
        p_shop_id, p_location_id, 'refund', v_correction_id, v_part.payment_id,
        v_part.allocation_id, v_refund_id, v_part.amount, p_effective_at,
        btrim(p_reason), nullif(btrim(p_reference), ''), v_actor, v_correction_id
      );
    end if;
  end loop;
  return v_correction_id;
exception when unique_violation then
  select * into v_existing from public.sale_corrections correction
  where correction.shop_id = p_shop_id and correction.request_id = p_request_id;
  if found and v_existing.payload_hash = v_hash
    and v_existing.created_by_profile_id = v_actor then return v_existing.id; end if;
  raise;
end;
$$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.match_catalog_offers(uuid,jsonb,uuid[])'::regprocedure) is distinct from '478ba9ac2b5e3700d7091b0364de4593' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.match_catalog_offers' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.match_catalog_offers(p_shop_id uuid, p_lines jsonb, p_allowed uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO ''
    AS $$
declare remaining jsonb:='{}'; entry jsonb; recipe jsonb; offer public.shop_catalog_offers%rowtype; source record;
 key text; qty numeric; count_sets numeric; old_price numeric; savings numeric; discount numeric:=0; matched jsonb:='[]'; eligible boolean; resolved jsonb;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_lines) loop
 if entry->>'item_type'='product' then
 resolved:=shop_private.resolve_measured_line(p_shop_id,(entry->>'source_id')::uuid,entry);
 if (resolved#>>'{measurement,packageId}' is not null or resolved#>>'{measurement,priceSource}'='reel_remnant') then continue;end if;
 qty:=(resolved->>'baseQuantity')::numeric;
 else qty:=(entry->>'quantity')::numeric;end if;
 key:=(entry->>'item_type')||':'||(entry->>'source_id');
 if key is null or qty is null or qty not between 0.000001 and 1000000 or round(qty,6)<>qty then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
 remaining:=jsonb_set(remaining,array[key],to_jsonb(coalesce((remaining->>key)::numeric,0)+qty));
 end loop;
 for offer in select * from public.shop_catalog_offers o where o.shop_id=p_shop_id and o.active
 and (o.starts_at is null or o.starts_at<=statement_timestamp()) and (o.ends_at is null or o.ends_at>statement_timestamp())
 and (p_allowed is null or o.id=any(p_allowed)) order by o.priority,o.created_at,o.id loop
 count_sets:=1000000; old_price:=0; eligible:=true;
 for recipe in select value from jsonb_array_elements(offer.lines) loop
 key:=(recipe->>'kind')||':'||(recipe->>'sourceId'); qty:=(recipe->>'quantity')::numeric;
 select * into source from shop_private.offer_sources(p_shop_id) where id=(recipe->>'sourceId')::uuid and kind=recipe->>'kind';
 if not found then eligible:=false; exit; end if;
 count_sets:=least(count_sets,floor(coalesce((remaining->>key)::numeric,0)/qty));
 old_price:=old_price+round((source.price-source.discount)*qty,2);
 end loop;
 savings:=round(old_price-offer.price,2);
 if not eligible or count_sets<1 or savings<=0 then continue; end if;
 for recipe in select value from jsonb_array_elements(offer.lines) loop
 key:=(recipe->>'kind')||':'||(recipe->>'sourceId');
 remaining:=jsonb_set(remaining,array[key],to_jsonb((remaining->>key)::numeric-(recipe->>'quantity')::numeric*count_sets));
 end loop;
 discount:=discount+savings*count_sets;
 matched:=matched||jsonb_build_array(jsonb_build_object('id',offer.id,'name',offer.name,'revision',offer.revision,'quantity',count_sets,'price',offer.price,'oldPrice',old_price,'saving',savings*count_sets));
 end loop;
 return jsonb_build_object('discount',discount,'offers',matched);
end; $$;
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.return_document(uuid)'::regprocedure) is distinct from '0a2c1faf434fae60ae2654413679d473' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: shop_private.return_document' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.return_document(p_return_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
 select to_jsonb(r)-'payload'||jsonb_build_object('version',1,'actorName',(select coalesce(p.display_name,p.email_snapshot) from public.profiles p where p.id=r.actor_profile_id),
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.line_id) from public.sale_return_lines l where l.return_id=r.id),'[]'::jsonb),
 'cutApprovals',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object('actorName',(select coalesce(p.display_name,p.email_snapshot) from public.profiles p where p.id=a.actor_profile_id)) order by a.line_id) from public.inventory_reel_return_approvals a where a.return_id=r.id),'[]'::jsonb),
 'stock',coalesce((select jsonb_agg(to_jsonb(s) order by s.line_id,s.movement_id) from public.sale_return_stock s where s.return_id=r.id),'[]'::jsonb),
 'refunds',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('state',
  (select state from public.sale_return_refund_events e where e.refund_id=f.id order by e.created_at desc,e.id desc limit 1),
  'events',(select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from public.sale_return_refund_events e where e.refund_id=f.id)) order by f.id)
  from public.sale_return_refunds f where f.return_id=r.id),'[]'::jsonb)) from public.sale_returns r where r.id=p_return_id;
$$;

do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='shop_private.get_purchase(uuid,uuid)'::regprocedure) is distinct from 'e0ab9c132240a9b38171c6826f4167b0' then raise exception 'REEL_ROUTINE_REVIEW_REQUIRED: get_purchase' using errcode='55000';end if;end;$$;
CREATE OR REPLACE FUNCTION shop_private.get_purchase(p_shop_id uuid, p_purchase_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare v_result jsonb; v_access record;
begin
  perform shop_private.assert_supplier_read_access(p_shop_id);
  select * into v_access from shop_private.supplier_access(p_shop_id);
  select jsonb_build_object(
    'id', invoice.id, 'vendorId', invoice.vendor_id,
    'vendorNameSnapshot', invoice.vendor_name_snapshot,
    'invoiceNumber', invoice.invoice_number, 'status', invoice.status,
    'issuedAt', invoice.issued_at, 'totalAmount', invoice.total_amount,
    'payable', shop_private.purchase_payable(invoice.id),
    'settlementState', case when shop_private.purchase_payable(invoice.id) = 0 then 'paid'
      when shop_private.purchase_payable(invoice.id) = invoice.total_amount then 'unpaid' else 'partial' end,
    'notes', invoice.notes, 'createdAt', invoice.created_at,
    'canManageSuppliers', v_access.can_manage_suppliers,
    'canManagePurchases', v_access.can_manage_purchases,
    'canRecordPayment', v_access.can_record_payment,
    'canReversePayment', v_access.can_reverse_payment,
    'canRecordCredit', v_access.can_record_credit,
    'canReturnStock', v_access.can_return_stock,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id, 'productId', item.product_id, 'productName', product.name,
      'reelTracking',shop_private.is_reel_tracked(p_shop_id,item.product_id),'quantity', item.quantity, 'unitCost', item.unit_cost, 'measurement',item.measurement_snapshot,
      'totalCost', item.total_cost, 'availableToReturn', coalesce(batch.remaining_quantity, 0),
      'batchId', batch.id) order by item.id), '[]'::jsonb)
      from public.vendor_invoice_items item join public.products product on product.id = item.product_id
      left join public.inventory_batches batch on batch.shop_id = p_shop_id
        and batch.source_type = 'vendor_invoice' and batch.source_id = invoice.id
        and batch.product_id = item.product_id where item.vendor_invoice_id = invoice.id),
    'paymentEvents', (select coalesce(jsonb_agg(event order by event ->> 'eventAt', event ->> 'id'), '[]'::jsonb)
      from (
        select jsonb_build_object('id', allocation.id, 'eventType', 'payment',
          'paymentId', payment.id, 'allocationId', allocation.id,
          'amount', allocation.amount, 'eventAt', payment.paid_at,
          'method', payment.method, 'reference', payment.reference,
          'notes', payment.notes, 'actorProfileId', payment.created_by_profile_id,
          'remainingEffective', shop_private.supplier_allocation_remaining(allocation.id)) event
        from public.supplier_payment_allocations allocation join public.payments payment
          on payment.id = allocation.payment_id where allocation.vendor_invoice_id = invoice.id
        union all
        select jsonb_build_object('id', reversal.id, 'eventType', 'reversal',
          'paymentId', reversal.original_payment_id,
          'allocationId', reversal.original_allocation_id, 'amount', reversal.amount,
          'eventAt', reversal.effective_at, 'reference', reversal.reference,
          'reason', reversal.reason, 'actorProfileId', reversal.created_by_profile_id)
        from public.supplier_payment_reversals reversal
        join public.supplier_payment_allocations allocation
          on allocation.id = reversal.original_allocation_id
        where allocation.vendor_invoice_id = invoice.id
      ) events),
    'credits', (select coalesce(jsonb_agg(jsonb_build_object('id', credit.id,
      'amount', credit.amount, 'effectiveAt', credit.effective_at,
      'reason', credit.reason, 'reference', credit.reference,
      'purchaseReturnId', credit.purchase_return_id,
      'actorProfileId', credit.created_by_profile_id) order by credit.effective_at, credit.id), '[]'::jsonb)
      from public.supplier_credits credit where credit.vendor_invoice_id = invoice.id),
    'returns', (select coalesce(jsonb_agg(jsonb_build_object('id', return_doc.id,
      'returnedAt', return_doc.returned_at, 'reason', return_doc.reason,
      'reference', return_doc.reference, 'totalAmount', return_doc.total_amount,
      'items', (select coalesce(jsonb_agg(jsonb_build_object('id', return_item.id,
        'productId', return_item.product_id, 'quantity', return_item.quantity,
        'unitCost', return_item.unit_cost, 'totalAmount', return_item.total_amount,
        'batchId', return_item.inventory_batch_id) order by return_item.id), '[]'::jsonb)
        from public.purchase_return_items return_item
        where return_item.purchase_return_id = return_doc.id))
      order by return_doc.returned_at, return_doc.id), '[]'::jsonb)
      from public.purchase_returns return_doc where return_doc.vendor_invoice_id = invoice.id),
    'receiptMovements', (select coalesce(jsonb_agg(jsonb_build_object('id', movement.id,
      'productId', movement.product_id, 'batchId', movement.batch_id,
      'quantityChange', movement.quantity_change,
      'unitCostSnapshot', movement.unit_cost_snapshot,
      'createdAt', movement.created_at, 'referenceId', movement.reference_id)
      order by movement.created_at, movement.id), '[]'::jsonb)
      from public.inventory_movements movement join public.inventory_batches batch
        on batch.id = movement.batch_id where movement.shop_id = p_shop_id
        and batch.source_type = 'vendor_invoice' and batch.source_id = invoice.id)
  ) into v_result from public.vendor_invoices invoice
  where invoice.id = p_purchase_id and invoice.shop_id = p_shop_id;
  return v_result;
end;
$$;
create function public.purchase_reel_options(p_shop_id uuid,p_purchase_id uuid,p_line_id uuid,p_search text default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare purchase public.vendor_invoices%rowtype;line public.vendor_invoice_items%rowtype;items jsonb;total bigint;
begin
 perform shop_private.assert_supplier_read_access(p_shop_id);
 select * into purchase from public.vendor_invoices where id=p_purchase_id and shop_id=p_shop_id;
 if not found then raise exception 'PURCHASE_NOT_FOUND' using errcode='P0002';end if;
 perform shop_private.assert_location_access(p_shop_id,purchase.location_id,false);
 select * into line from public.vendor_invoice_items where id=p_line_id and vendor_invoice_id=purchase.id;
 if not found or p_page<1 or length(coalesce(p_search,''))>160 then raise exception 'INVALID_REEL_QUERY' using errcode='22023';end if;
 with rows as(select r.*,count(*) over() total_count from public.inventory_reels r join public.inventory_batches b on b.id=r.batch_id
 where r.shop_id=p_shop_id and r.location_id=purchase.location_id and r.product_id=line.product_id and b.source_type='vendor_invoice' and b.source_id=purchase.id
 and r.remaining_length>0 and r.status<>'archived' and(nullif(btrim(p_search),'') is null or r.barcode ilike '%'||btrim(p_search)||'%')),
 paged as(select * from rows order by created_at,id offset(p_page-1)*20 limit 20)
 select (select count(*) from rows),coalesce(jsonb_agg(jsonb_build_object('id',id,'barcode',barcode,'remainingLength',trim_scale(remaining_length)::text) order by created_at,id),'[]') into total,items from paged;
 return jsonb_build_object('items',items,'total',total,'page',p_page);
end;$$;
revoke all on function public.purchase_reel_options(uuid,uuid,uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.purchase_reel_options(uuid,uuid,uuid,text,integer) to authenticated;
notify pgrst,'reload schema';
commit;
