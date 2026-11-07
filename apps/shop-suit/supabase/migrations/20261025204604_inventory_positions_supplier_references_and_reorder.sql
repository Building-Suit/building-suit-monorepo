begin;
-- Position metadata refines the existing stock ledger; it carries no quantity.
create table public.storage_bins(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),location_id uuid not null,
 code text not null check(length(btrim(code)) between 1 and 40),name text not null check(length(btrim(name)) between 1 and 120),
 aisle text not null default '' check(length(aisle)<=80),shelf text not null default '' check(length(shelf)<=80),
 active boolean not null default true,revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id,location_id),foreign key(location_id,shop_id) references public.shop_locations(id,shop_id)
);
create unique index storage_bins_code_unique on public.storage_bins(shop_id,location_id,lower(code));
create table public.inventory_positions(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,product_id uuid not null,bin_id uuid not null,
 reel_id uuid references public.inventory_reels(id),notes text not null default '' check(length(notes)<=500),active boolean not null default true,
 revision integer not null default 1 check(revision>0),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),foreign key(product_id,shop_id) references public.products(id,shop_id),
 foreign key(bin_id,shop_id,location_id) references public.storage_bins(id,shop_id,location_id)
);
create unique index inventory_positions_product_bin_unique on public.inventory_positions(shop_id,location_id,product_id,bin_id) where active and reel_id is null;
create unique index inventory_positions_reel_unique on public.inventory_positions(reel_id) where active and reel_id is not null;
create index inventory_positions_directory on public.inventory_positions(shop_id,location_id,product_id,active,id);
create table public.supplier_product_references(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,product_id uuid not null,vendor_id uuid not null,
 item_code text not null check(length(btrim(item_code)) between 1 and 120),unit_code text,package_id uuid references public.product_packagings(id),package_version integer,
 measurement_revision integer not null,lead_days integer not null check(lead_days between 0 and 3650),review_days integer not null default 14 check(review_days between 1 and 365),
 preferred boolean not null default false,active boolean not null default true,revision integer not null default 1 check(revision>0),
 purchase_snapshot jsonb not null,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id),foreign key(product_id,shop_id) references public.products(id,shop_id),
 foreign key(vendor_id,shop_id) references public.vendors(id,shop_id),check((package_id is null)=(package_version is null)),
 unique(shop_id,location_id,product_id,vendor_id)
);
create unique index supplier_product_preferred_unique on public.supplier_product_references(shop_id,location_id,product_id) where active and preferred;
create index supplier_product_directory on public.supplier_product_references(shop_id,location_id,vendor_id,product_id);
create table public.inventory_planning_events(
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,location_id uuid not null,kind text not null check(kind in('bin','position','supplier')),
 record_id uuid not null,revision integer not null,snapshot jsonb not null,reason text not null check(length(btrim(reason)) between 3 and 500),
 actor_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default clock_timestamp(),
 foreign key(location_id,shop_id) references public.shop_locations(id,shop_id)
);
create index inventory_planning_history on public.inventory_planning_events(shop_id,location_id,kind,record_id,created_at desc,id);
create table shop_private.inventory_planning_requests(
 shop_id uuid not null references public.shops(id),request_id uuid not null,actor_profile_id uuid not null references public.profiles(id),
 payload jsonb not null,result jsonb,created_at timestamptz not null default clock_timestamp(),primary key(shop_id,request_id)
);
do $$declare t text;begin
 foreach t in array array['storage_bins','inventory_positions','supplier_product_references','inventory_planning_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to service_role',t);
  execute format('create policy inventory_planning_service_read on public.%I for select to service_role using(true)',t);
 end loop;
end;$$;
revoke all on shop_private.inventory_planning_requests from public,anon,authenticated,service_role;
create trigger inventory_planning_history_immutable before update or delete on public.inventory_planning_events for each row execute function shop_private.measurement_history_immutable();

-- Keep the existing reel/POS label consistent with an active structured bin.
-- Unassigned historical reels retain their original free-text behavior.
create function shop_private.guard_reel_bin_position() returns trigger language plpgsql security definer set search_path='' as $$
declare expected text;begin
 if new.storage_position is distinct from old.storage_position then
  select left(b.code||' · '||b.name,160) into expected from public.inventory_positions pos join public.storage_bins b on b.id=pos.bin_id and b.shop_id=pos.shop_id and b.location_id=pos.location_id
  where pos.reel_id=old.id and pos.shop_id=old.shop_id and pos.location_id=old.location_id and pos.active;
  if found and new.storage_position is distinct from expected then raise exception 'REEL_POSITION_REQUIRES_BIN_COMMAND' using errcode='55000';end if;
 end if;
 return new;
end;$$;
revoke all on function shop_private.guard_reel_bin_position() from public,anon,authenticated,service_role;
create trigger inventory_reel_bin_position before update of storage_position on public.inventory_reels for each row execute function shop_private.guard_reel_bin_position();

create function public.inventory_planning_command(p_request_id uuid,p_shop_id uuid,p_location_id uuid,p_kind text,p_id uuid,p_revision integer,p_values jsonb,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
<<planning>>
declare actor uuid;request shop_private.inventory_planning_requests%rowtype;payload jsonb;result jsonb;id uuid:=coalesce(p_id,gen_random_uuid());
 b public.storage_bins%rowtype;pos public.inventory_positions%rowtype;ref public.supplier_product_references%rowtype;reel public.inventory_reels%rowtype;product public.products%rowtype;
 previous jsonb;snapshot jsonb;rev integer;active boolean;input jsonb;resolved jsonb;unit text;package uuid;version integer;preferred boolean;begin
 if p_kind is null or p_kind not in('bin','position','supplier') then raise exception 'INVALID_PLANNING_KIND' using errcode='22023';end if;
 actor:=case when p_kind='supplier' then shop_private.assert_shop_write_access(p_shop_id,'vendors.manage') else shop_private.assert_inventory_write_access(p_shop_id) end;
 perform shop_private.assert_location_access(p_shop_id,p_location_id,true);
 if p_request_id is null or p_revision is null or p_revision<0 or (p_id is null and p_revision<>0) or jsonb_typeof(p_values) is distinct from 'object'
 or p_reason is null or length(btrim(p_reason)) not between 3 and 500 or jsonb_typeof(p_values->'active') is distinct from 'boolean' then raise exception 'INVALID_PLANNING_INPUT' using errcode='22023';end if;
 active:=(p_values->>'active')::boolean;
 payload:=jsonb_build_array(p_kind,p_location_id,p_id,p_revision,p_values,btrim(p_reason));
 insert into shop_private.inventory_planning_requests(shop_id,request_id,actor_profile_id,payload) values(p_shop_id,p_request_id,actor,payload) on conflict do nothing;
 select * into request from shop_private.inventory_planning_requests where shop_id=p_shop_id and request_id=p_request_id for update;
 if request.actor_profile_id<>actor or request.payload<>payload then raise exception 'PLANNING_REQUEST_CONFLICT' using errcode='23505';end if;
 if request.result is not null then return request.result;end if;
 if p_kind='bin' then
  if (p_values-array['code','name','aisle','shelf','active'])<>'{}' or p_values->>'code' is null or p_values->>'name' is null then raise exception 'INVALID_STORAGE_BIN' using errcode='22023';end if;
  select * into b from public.storage_bins where storage_bins.id=p_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if (p_id is not null and (b.id is null or b.revision<>p_revision)) then raise exception 'PLANNING_CONTEXT_CHANGED' using errcode='55000';end if;
  if p_id is null then
   if (select count(*) from public.storage_bins where shop_id=p_shop_id and location_id=p_location_id)>=2000 then raise exception 'STORAGE_BIN_LIMIT' using errcode='54000';end if;
   insert into public.storage_bins(id,shop_id,location_id,code,name,aisle,shelf,active) values(id,p_shop_id,p_location_id,btrim(p_values->>'code'),btrim(p_values->>'name'),btrim(coalesce(p_values->>'aisle','')),btrim(coalesce(p_values->>'shelf','')),active) returning * into b;
  else
   previous:=to_jsonb(b);
   if not active and exists(select 1 from public.inventory_positions where bin_id=b.id and inventory_positions.active) then raise exception 'STORAGE_BIN_IN_USE' using errcode='55000';end if;
   if (b.code,b.name) is distinct from (btrim(p_values->>'code'),btrim(p_values->>'name')) and exists(select 1 from public.inventory_positions where bin_id=b.id and reel_id is not null and inventory_positions.active) then raise exception 'STORAGE_BIN_IN_USE' using errcode='55000';end if;
   -- Clear physical placements before renaming their label; retain their audit.
   update public.storage_bins set code=btrim(p_values->>'code'),name=btrim(p_values->>'name'),aisle=btrim(coalesce(p_values->>'aisle','')),shelf=btrim(coalesce(p_values->>'shelf','')),active=planning.active,revision=revision+1,updated_at=clock_timestamp() where storage_bins.id=p_id returning * into b;
  end if;
  snapshot:=to_jsonb(b);rev:=b.revision;
 elsif p_kind='position' then
  if (p_values-array['productId','binId','reelId','reelRevision','notes','active'])<>'{}' then raise exception 'INVALID_STORAGE_POSITION' using errcode='22023';end if;
  select * into pos from public.inventory_positions where inventory_positions.id=p_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if p_id is not null and (pos.id is null or pos.revision<>p_revision) then raise exception 'PLANNING_CONTEXT_CHANGED' using errcode='55000';end if;
  if p_id is not null and (pos.product_id is distinct from (p_values->>'productId')::uuid or pos.reel_id is distinct from nullif(p_values->>'reelId','')::uuid) then raise exception 'POSITION_TARGET_IMMUTABLE' using errcode='55000';end if;
  select * into product from public.products where products.id=(p_values->>'productId')::uuid and shop_id=p_shop_id and (not active or is_active) for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
  select * into b from public.storage_bins where storage_bins.id=(p_values->>'binId')::uuid and shop_id=p_shop_id and location_id=p_location_id;
  if not found or (active and not b.active) then raise exception 'STORAGE_BIN_UNAVAILABLE' using errcode='55000';end if;
  if p_id is null and (select count(*) from public.inventory_positions where shop_id=p_shop_id and location_id=p_location_id and product_id=product.id and inventory_positions.active)>=20 then raise exception 'PRODUCT_POSITION_LIMIT' using errcode='54000';end if;
  if nullif(p_values->>'reelId','') is not null then
   select * into reel from public.inventory_reels where inventory_reels.id=(p_values->>'reelId')::uuid and shop_id=p_shop_id and location_id=p_location_id and product_id=product.id;
   if not found then raise exception 'REEL_NOT_FOUND' using errcode='P0002';end if;
   if (p_values->>'reelRevision')::integer is distinct from reel.revision then raise exception 'REEL_CONTEXT_CHANGED' using errcode='55000';end if;
  end if;
  previous:=case when pos.id is null then null else to_jsonb(pos) end;
  if p_id is null then
   insert into public.inventory_positions(id,shop_id,location_id,product_id,bin_id,reel_id,notes,active) values(id,p_shop_id,p_location_id,product.id,b.id,reel.id,btrim(coalesce(p_values->>'notes','')),active) returning * into pos;
  else
   update public.inventory_positions set bin_id=b.id,notes=btrim(coalesce(p_values->>'notes','')),active=planning.active,revision=revision+1,updated_at=clock_timestamp() where inventory_positions.id=p_id returning * into pos;
  end if;
  -- The metadata and existing reel command commit or roll back together.
   if reel.id is not null and (active or reel.status<>'archived') then perform public.update_inventory_reel(gen_random_uuid(),p_shop_id,p_location_id,reel.id,reel.revision,'classify',jsonb_build_object('classification',reel.classification,'price',reel.remnant_price,'storagePosition',case when active then left(b.code||' · '||b.name,160) else null end),btrim(p_reason));end if;
  snapshot:=to_jsonb(pos);rev:=pos.revision;
 else
  if (p_values-array['productId','vendorId','itemCode','unitCode','packageId','packageVersion','leadDays','reviewDays','preferred','active'])<>'{}'
   or coalesce(p_values->>'leadDays','') !~ '^[0-9]{1,4}$' or coalesce(p_values->>'reviewDays','') !~ '^[0-9]{1,3}$' or jsonb_typeof(p_values->'preferred') is distinct from 'boolean' then raise exception 'INVALID_SUPPLIER_REFERENCE' using errcode='22023';end if;
  select * into ref from public.supplier_product_references where supplier_product_references.id=p_id and shop_id=p_shop_id and location_id=p_location_id for update;
  if p_id is not null and (ref.id is null or ref.revision<>p_revision) then raise exception 'PLANNING_CONTEXT_CHANGED' using errcode='55000';end if;
  if p_id is not null and (ref.product_id is distinct from (p_values->>'productId')::uuid or ref.vendor_id is distinct from (p_values->>'vendorId')::uuid) then raise exception 'SUPPLIER_REFERENCE_TARGET_IMMUTABLE' using errcode='55000';end if;
  select * into product from public.products where products.id=(p_values->>'productId')::uuid and shop_id=p_shop_id and (not active or is_active) for update;
  if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
  if not exists(select 1 from public.vendors where vendors.id=(p_values->>'vendorId')::uuid and shop_id=p_shop_id and (not active or is_active)) then raise exception 'VENDOR_NOT_FOUND' using errcode='P0002';end if;
  unit:=nullif(p_values->>'unitCode','');package:=nullif(p_values->>'packageId','')::uuid;version:=nullif(p_values->>'packageVersion','')::integer;preferred:=(p_values->>'preferred')::boolean;
  if product.measurement_status='legacy' then
   if unit is not null or package is not null or version is not null then raise exception 'LEGACY_MEASUREMENT_INPUT_DENIED' using errcode='22023';end if;
   input:=jsonb_build_object('product_id',product.id,'quantity','1','unit_cost','0');
  else
   if (package is null)=(unit is null) or (package is null)<>(version is null) then raise exception 'PURCHASE_UNIT_REQUIRED' using errcode='22023';end if;
   input:=jsonb_build_object('product_id',product.id,'quantity','1','unit_cost','0','measurement_revision',product.measurement_revision)||case when package is not null then jsonb_build_object('package_id',package,'package_version',version) else jsonb_build_object('unit_code',unit) end;
  end if;
  if not active and ref.id is not null then
   if (unit,package,version) is distinct from (ref.unit_code,ref.package_id,ref.package_version) then raise exception 'INACTIVE_REFERENCE_UNIT_IMMUTABLE' using errcode='55000';end if;
   resolved:=jsonb_build_object('measurement',ref.purchase_snapshot);
  else resolved:=shop_private.resolve_measured_line(p_shop_id,product.id,input,true);end if;
  previous:=case when ref.id is null then null else to_jsonb(ref) end;
  -- A different preferred mapping must be explicitly reviewed and demoted first.
  -- The partial unique index serializes against a concurrent second preference.
  if p_id is null then
   insert into public.supplier_product_references(id,shop_id,location_id,product_id,vendor_id,item_code,unit_code,package_id,package_version,measurement_revision,lead_days,review_days,preferred,active,purchase_snapshot)
   values(id,p_shop_id,p_location_id,product.id,(p_values->>'vendorId')::uuid,btrim(p_values->>'itemCode'),unit,package,version,product.measurement_revision,(p_values->>'leadDays')::integer,(p_values->>'reviewDays')::integer,preferred,active,resolved->'measurement') returning * into ref;
  else
   update public.supplier_product_references set item_code=btrim(p_values->>'itemCode'),unit_code=unit,package_id=package,package_version=version,measurement_revision=case when not planning.active then ref.measurement_revision else product.measurement_revision end,lead_days=(p_values->>'leadDays')::integer,review_days=(p_values->>'reviewDays')::integer,preferred=planning.preferred,active=planning.active,purchase_snapshot=resolved->'measurement',revision=revision+1,updated_at=clock_timestamp() where supplier_product_references.id=p_id returning * into ref;
  end if;
  snapshot:=to_jsonb(ref);rev:=ref.revision;
 end if;
 if p_kind='position' then snapshot:=snapshot||jsonb_build_object('product_name',product.name,'bin_code',b.code,'bin_name',b.name,'reel_barcode',reel.barcode);
 elsif p_kind='supplier' then snapshot:=snapshot||jsonb_build_object('product_name',product.name,'vendor_name',(select name from public.vendors where vendors.id=ref.vendor_id and shop_id=p_shop_id),'package_name',ref.purchase_snapshot->>'packageName');end if;
 insert into public.inventory_planning_events(shop_id,location_id,kind,record_id,revision,snapshot,reason,actor_profile_id) values(p_shop_id,p_location_id,p_kind,id,rev,jsonb_build_object('previous',previous,'current',snapshot),btrim(p_reason),actor);
 result:=jsonb_build_object('id',id,'revision',rev,'kind',p_kind);
 update shop_private.inventory_planning_requests set result=planning.result where shop_id=p_shop_id and request_id=p_request_id;
 perform shop_private.bump_realtime(p_shop_id,p_location_id,'inventory');
 return result;
end;$$;
revoke all on function public.inventory_planning_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.inventory_planning_command(uuid,uuid,uuid,text,uuid,integer,jsonb,text) to authenticated;

create function public.inventory_planning_context(p_shop_id uuid,p_location_id uuid,p_kind text,p_search text default null,p_page integer default 1,p_record_id uuid default null,p_history_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb;record jsonb;history jsonb;total bigint;history_total bigint;can_manage boolean;begin
 if p_kind is null or p_kind not in('bin','position','supplier') or p_page is null or p_page not between 1 and 1000000 or p_history_page is null or p_history_page not between 1 and 1000000 or length(coalesce(p_search,''))>120 then raise exception 'INVALID_PLANNING_QUERY' using errcode='22023';end if;
 if p_kind='supplier' then perform shop_private.assert_supplier_read_access(p_shop_id);can_manage:=shop_private.has_permission(p_shop_id,'vendors.manage');
 else perform shop_private.assert_inventory_read_access(p_shop_id);can_manage:=shop_private.has_permission(p_shop_id,'inventory.manage');end if;
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_kind='bin' then
  with records as(select b.* from public.storage_bins b where b.shop_id=p_shop_id and b.location_id=p_location_id and
   (nullif(btrim(p_search),'') is null or concat_ws(' ',b.code,b.name,b.aisle,b.shelf) ilike '%'||btrim(p_search)||'%'))
  select (select count(*) from records),coalesce((select jsonb_agg(to_jsonb(r) order by r.code,r.id) from(select * from records order by code,id offset(p_page-1)*20 limit 20)r),'[]'),
   (select to_jsonb(b) from public.storage_bins b where b.id=p_record_id and b.shop_id=p_shop_id and b.location_id=p_location_id) into total,rows,record;
 elsif p_kind='position' then
  with records as(select pos.*,p.name product_name,p.sku,b.code bin_code,b.name bin_name,b.aisle,b.shelf,r.barcode reel_barcode,r.revision reel_revision,r.status reel_status
   from public.inventory_positions pos join public.products p on p.id=pos.product_id and p.shop_id=pos.shop_id join public.storage_bins b on b.id=pos.bin_id and b.shop_id=pos.shop_id and b.location_id=pos.location_id left join public.inventory_reels r on r.id=pos.reel_id and r.shop_id=pos.shop_id and r.location_id=pos.location_id where pos.shop_id=p_shop_id and pos.location_id=p_location_id)
  select (select count(*) from records where nullif(btrim(p_search),'') is null or concat_ws(' ',product_name,sku,bin_code,bin_name,reel_barcode,notes) ilike '%'||btrim(p_search)||'%'),
   coalesce((select jsonb_agg(to_jsonb(r) order by r.product_name,r.id) from(select * from records where nullif(btrim(p_search),'') is null or concat_ws(' ',product_name,sku,bin_code,bin_name,reel_barcode,notes) ilike '%'||btrim(p_search)||'%' order by product_name,id offset(p_page-1)*20 limit 20)r),'[]'),(select to_jsonb(r) from records r where r.id=p_record_id) into total,rows,record;
 else
  with records as(select ref.*,p.name product_name,p.sku,v.name vendor_name,pack.name package_name,pack.active package_active,p.measurement_revision current_measurement_revision,p.base_unit_code
   from public.supplier_product_references ref join public.products p on p.id=ref.product_id and p.shop_id=ref.shop_id join public.vendors v on v.id=ref.vendor_id and v.shop_id=ref.shop_id left join public.product_packagings pack on pack.id=ref.package_id and pack.shop_id=ref.shop_id and pack.product_id=ref.product_id where ref.shop_id=p_shop_id and ref.location_id=p_location_id)
  select (select count(*) from records where nullif(btrim(p_search),'') is null or concat_ws(' ',product_name,sku,vendor_name,item_code) ilike '%'||btrim(p_search)||'%'),
   coalesce((select jsonb_agg(to_jsonb(r) order by r.product_name,r.id) from(select * from records where nullif(btrim(p_search),'') is null or concat_ws(' ',product_name,sku,vendor_name,item_code) ilike '%'||btrim(p_search)||'%' order by product_name,id offset(p_page-1)*20 limit 20)r),'[]'),(select to_jsonb(r) from records r where r.id=p_record_id) into total,rows,record;
 end if;
 if p_record_id is not null and record is null then raise exception 'PLANNING_RECORD_NOT_FOUND' using errcode='P0002';end if;
 select count(*) into history_total from public.inventory_planning_events e where e.shop_id=p_shop_id and e.location_id=p_location_id and e.kind=p_kind and e.record_id=p_record_id;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]') into history from(select e.id,e.revision,e.reason,e.snapshot,e.created_at,(select display_name from public.profiles where id=e.actor_profile_id) actor_name from public.inventory_planning_events e where e.shop_id=p_shop_id and e.location_id=p_location_id and e.kind=p_kind and e.record_id=p_record_id order by e.created_at desc,e.id offset(p_history_page-1)*20 limit 20)r;
 return jsonb_build_object('items',rows,'total',total,'page',p_page,'pageSize',20,'record',record,'history',history,'historyTotal',history_total,'historyPage',p_history_page,'canManage',can_manage);
end;$$;
revoke all on function public.inventory_planning_context(uuid,uuid,text,text,integer,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.inventory_planning_context(uuid,uuid,text,text,integer,uuid,integer) to authenticated;

-- Read the immutable ordinary purchase lines. Currencies and original units
-- remain separate; void invoices stay visible with their actual document state.
create function public.supplier_price_history(p_shop_id uuid,p_location_id uuid,p_product_id uuid default null,p_vendor_id uuid default null,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare total bigint;items jsonb;begin
 perform shop_private.assert_team_permission(p_shop_id,'vendor_invoices.view');perform shop_private.assert_supplier_read_access(p_shop_id);perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 if p_page is null or p_page not between 1 and 1000000 then raise exception 'INVALID_SUPPLIER_HISTORY_QUERY' using errcode='22023';end if;
 if p_product_id is not null and not exists(select 1 from public.products where id=p_product_id and shop_id=p_shop_id) then raise exception 'PRODUCT_NOT_FOUND' using errcode='P0002';end if;
 if p_vendor_id is not null and not exists(select 1 from public.vendors where id=p_vendor_id and shop_id=p_shop_id) then raise exception 'VENDOR_NOT_FOUND' using errcode='P0002';end if;
 with rows as(select item.id,i.id invoice_id,i.invoice_number,i.status,i.issued_at,i.currency,p.id product_id,p.name product_name,i.vendor_id,i.vendor_name_snapshot vendor_name,
  trim_scale(item.quantity)::text quantity,trim_scale(item.unit_cost)::text base_unit_cost,trim_scale(item.total_cost)::text total,
  coalesce(item.measurement_snapshot->>'baseUnitCode','legacy') base_unit_code,coalesce(item.measurement_snapshot->>'enteredQuantity',trim_scale(item.quantity)::text) entered_quantity,
  coalesce(item.measurement_snapshot->>'enteredUnitPrice',trim_scale(item.unit_cost)::text) entered_unit_cost,
  coalesce(item.measurement_snapshot->>'packageName',item.measurement_snapshot->>'enteredUnitCode','legacy') purchase_unit,item.measurement_snapshot
  from public.vendor_invoice_items item join public.vendor_invoices i on i.id=item.vendor_invoice_id join public.products p on p.id=item.product_id and p.shop_id=i.shop_id left join public.vendors v on v.id=i.vendor_id and v.shop_id=i.shop_id
  where i.shop_id=p_shop_id and i.location_id=p_location_id and i.status in('posted','void') and (p_product_id is null or p.id=p_product_id) and (p_vendor_id is null or v.id=p_vendor_id))
 select (select count(*) from rows),coalesce((select jsonb_agg(to_jsonb(r) order by r.issued_at desc,r.id) from(select * from rows order by issued_at desc,id offset(p_page-1)*20 limit 20)r),'[]') into total,items;
 return jsonb_build_object('items',items,'total',total,'page',p_page,'pageSize',20);
end;$$;
revoke all on function public.supplier_price_history(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.supplier_price_history(uuid,uuid,uuid,uuid,integer) to authenticated;

create function shop_private.reorder_suggestions(p_shop_id uuid,p_location_id uuid,p_from date,p_to date,p_page integer,p_page_size integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare start_day date;end_day date;days integer;items jsonb;total bigint;can_supplier boolean;begin
 perform shop_private.assert_team_permission(p_shop_id,'reports.view');perform shop_private.assert_inventory_read_access(p_shop_id);
 select coalesce(can_view,false) into can_supplier from shop_private.supplier_access(p_shop_id);
 if p_location_id is not null then perform shop_private.assert_location_access(p_shop_id,p_location_id,false);end if;
 end_day:=coalesce(p_to,(now() at time zone 'Africa/Cairo')::date);start_day:=coalesce(p_from,end_day-89);days:=end_day-start_day+1;
 if not isfinite(start_day) or not isfinite(end_day) or days not between 1 and 365 or end_day>(now() at time zone 'Africa/Cairo')::date or p_page is null or p_page not between 1 and 1000000 or p_page_size is null or p_page_size not between 1 and 500 then raise exception 'INVALID_REORDER_QUERY' using errcode='22023';end if;
 with locations as(select l.id,l.name from public.shop_locations l where l.shop_id=p_shop_id and l.status='active' and (p_location_id is null or l.id=p_location_id) and shop_private.user_can_access_location(p_shop_id,l.id)),
 -- Net demand follows original issued lines, excluding corrected documents and
 -- deducting returns only once by their original line identity.
 demand as(select i.location_id,line.product_id,sum(greatest(line.quantity-coalesce(returned.quantity,0),0)) quantity,count(*) line_count
  from public.invoice_items line join public.invoices i on i.id=line.invoice_id and i.shop_id=line.shop_id join locations loc on loc.id=i.location_id
  left join lateral(select sum(rl.quantity) quantity from public.sale_return_lines rl join public.sale_returns r on r.id=rl.return_id and r.shop_id=rl.shop_id where rl.line_id=line.id and rl.shop_id=p_shop_id and r.created_at<(end_day+1)::timestamp at time zone 'Africa/Cairo') returned on true
  where i.shop_id=p_shop_id and line.item_type='product' and i.status in('issued','paid') and not exists(select 1 from public.sale_corrections c where c.invoice_id=i.id)
  and i.issued_at>=start_day::timestamp at time zone 'Africa/Cairo' and i.issued_at<(end_day+1)::timestamp at time zone 'Africa/Cairo' group by i.location_id,line.product_id),
 -- Aggregate source holds/receipts in this same statement snapshot. The
 -- mutation helpers intentionally use volatile reads and are not report readers.
 held as(select h.batch_id,sum(h.remaining_quantity) quantity from public.trade_order_reservations h join locations loc on loc.id=h.location_id where h.shop_id=p_shop_id and h.status='active' and h.expires_at>statement_timestamp() group by h.batch_id),
 stock as(select batch.location_id,batch.product_id,sum(batch.remaining_quantity) on_hand,sum(coalesce(held.quantity,0)) held from public.inventory_batches batch join locations loc on loc.id=batch.location_id left join held on held.batch_id=batch.id where batch.shop_id=p_shop_id group by batch.location_id,batch.product_id),
 received as(select r.order_line_id,sum(r.quantity) quantity from public.supplier_order_receipt_items r join public.supplier_orders o on o.id=r.order_id and o.shop_id=r.shop_id join locations loc on loc.id=o.location_id where r.shop_id=p_shop_id and o.status in('issued','partially_received') group by r.order_line_id),
 incoming as(select o.location_id,line.product_id,sum(line.quantity-coalesce(received.quantity,0)) quantity from public.supplier_orders o join public.supplier_order_lines line on line.order_id=o.id and line.shop_id=o.shop_id join locations loc on loc.id=o.location_id left join received on received.order_line_id=line.id where o.shop_id=p_shop_id and o.status in('issued','partially_received') group by o.location_id,line.product_id),
 inputs as(select p.id product_id,loc.id location_id,loc.name location_name,p.name,p.sku,case when p.measurement_status='legacy' then 'legacy' else p.base_unit_code end base_unit_code,
  coalesce(d.quantity,0) demand_quantity,coalesce(d.line_count,0) demand_line_count,coalesce(s.on_hand,0) on_hand,coalesce(s.held,0) held,coalesce(inc.quantity,0) incoming_quantity,p.reorder_threshold,
  ref.id reference_id,ref.vendor_id,ref.item_code,ref.lead_days,ref.review_days,coalesce(v.name,'') vendor_name,ref.unit_code,pack.name package_name,
  coalesce(ref.measurement_revision=p.measurement_revision and v.is_active and (ref.package_id is null or pack.active),false) mapping_current,
  case when p.measurement_status='legacy' then 0.001::numeric else p.quantity_increment end increment,
  case when ref.package_id is not null then (ref.purchase_snapshot->>'baseQuantity')::numeric else case when p.measurement_status='legacy' then 0.001::numeric else p.quantity_increment end end round_step
  from public.products p cross join locations loc left join demand d on d.location_id=loc.id and d.product_id=p.id left join stock s on s.location_id=loc.id and s.product_id=p.id left join incoming inc on inc.location_id=loc.id and inc.product_id=p.id
  left join public.supplier_product_references ref on ref.shop_id=p.shop_id and ref.location_id=loc.id and ref.product_id=p.id and ref.active and ref.preferred and can_supplier
  left join public.vendors v on v.id=ref.vendor_id and v.shop_id=p.shop_id left join public.product_packagings pack on pack.id=ref.package_id and pack.shop_id=p.shop_id and pack.product_id=p.id
  where p.shop_id=p_shop_id and p.is_active and p.measurement_status<>'prepared'),
 calculated as(select *,greatest(on_hand-held,0) free,case when mapping_current then greatest(coalesce(reorder_threshold,0),demand_quantity/days*(lead_days+review_days)) end target from inputs),
 rows as(select product_id::text||':'||location_id::text id,product_id,location_id,location_name,name,sku,base_unit_code,
  start_day demand_from,end_day demand_to,days window_days,demand_line_count,trim_scale(demand_quantity)::text demand_quantity,
  trim_scale(on_hand)::text on_hand,trim_scale(held)::text reserved,trim_scale(free)::text available,trim_scale(incoming_quantity)::text incoming,
  trim_scale(coalesce(reorder_threshold,0))::text reorder_threshold,vendor_id,vendor_name,item_code,lead_days,review_days,mapping_current,
  case when mapping_current then trim_scale(ceil(greatest(target-free-incoming_quantity,0)/round_step)*round_step)::text end suggested_quantity,
  coalesce(package_name,unit_code,'legacy') purchase_unit,case when not can_supplier then 'supplier_access_required' when reference_id is null then 'no_preferred_supplier' when not mapping_current then 'stale_supplier_reference' when demand_line_count=0 then 'no_demand_history' else 'historical_net_demand' end basis,
  '/inventory?product='||product_id::text source_path from calculated)
 select (select count(*) from rows),coalesce((select jsonb_agg(to_jsonb(r) order by r.location_name,r.name,r.id) from(select * from rows order by location_name,name,id offset(p_page-1)*p_page_size limit p_page_size)r),'[]') into total,items;
 return jsonb_build_object('report','reorder','locationId',p_location_id,'fromDate',start_day,'toDate',end_day,'timezone','Africa/Cairo','canViewCosts',false,'operationalOnly',true,
  'summary',jsonb_build_object('productLocationCount',total,'demandWindowDays',days,'suggestionsOnly',true),'items',items,'total',total,'page',p_page,'pageSize',p_page_size,'asOf',clock_timestamp());
end;$$;
revoke all on function shop_private.reorder_suggestions(uuid,uuid,date,date,integer,integer) from public,anon,authenticated,service_role;

-- Extend the existing public report dispatcher; every original report still
-- delegates to the unchanged private implementation.
do $$begin if (select md5(prosrc) from pg_catalog.pg_proc where oid='public.shop_operational_report(uuid,text,uuid,date,date,integer,integer)'::regprocedure) is distinct from '2fa81c7857e3fe18a5334e9413bd1b1e' then raise exception 'PLANNING_REPORT_ROUTINE_REVIEW_REQUIRED' using errcode='55000';end if;end;$$;
create or replace function public.shop_operational_report(p_shop_id uuid,p_report text,p_location_id uuid default null,p_from date default null,p_to date default null,p_page integer default 1,p_page_size integer default 20) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when p_report='reorder' then shop_private.reorder_suggestions(p_shop_id,p_location_id,p_from,p_to,p_page,p_page_size)
 else shop_private.shop_operational_report(p_shop_id,p_report,p_location_id,p_from,p_to,p_page,p_page_size) end;
$$;
commit;
