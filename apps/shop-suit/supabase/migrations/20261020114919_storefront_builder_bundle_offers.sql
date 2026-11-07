-- Shop-owned storefront composition and automatically matched counter bundles.
-- Existing stock, tax, issuance, payment, return and receipt authorities stay in place.
create table public.shop_storefront_layouts (
 shop_id uuid primary key references public.shops(id) on delete restrict,
 draft jsonb not null default '{}'::jsonb, published jsonb,
 revision integer not null default 0, updated_at timestamptz not null default clock_timestamp()
);
create table public.shop_catalog_offers (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 120), description text not null default '' check(length(description)<=320),
 price numeric(12,2) not null check(price>0), priority integer not null default 0 check(priority between 0 and 999999),
 active boolean not null default true, website_visible boolean not null default false,
 starts_at timestamptz, ends_at timestamptz, lines jsonb not null,
 revision integer not null default 1, created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(), unique(id,shop_id),
 check(starts_at is null or ends_at is null or ends_at>starts_at)
);
create index shop_catalog_offers_order on public.shop_catalog_offers(shop_id,priority,created_at,id);
create table public.shop_storefront_events (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id),
 actor_user_id uuid not null, action text not null, record_id uuid, occurred_at timestamptz not null default clock_timestamp()
);
alter table public.shop_storefront_layouts enable row level security;
alter table public.shop_catalog_offers enable row level security;
alter table public.shop_storefront_events enable row level security;
revoke all on public.shop_storefront_layouts,public.shop_catalog_offers,public.shop_storefront_events from public,anon,authenticated,service_role;

create function shop_private.storefront_builder_allowed(p_shop_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select plan_slug in ('team','multi') and writes_allowed from shop_private.resolve_plan_entitlement(p_shop_id)),false);
$$;
create function shop_private.empty_storefront_layout() returns jsonb language sql immutable set search_path='' as $$
 select '{"banner":null,"gallery":[],"staff":[],"showOffers":true,"showGallery":true,"showStaff":true}'::jsonb;
$$;
create function shop_private.validate_storefront_layout(p_layout jsonb) returns void
language plpgsql immutable set search_path='' as $$
declare entry jsonb; field text;
begin
 if jsonb_typeof(p_layout) is distinct from 'object' or octet_length(p_layout::text)>5500000
 or not(p_layout ?& array['banner','gallery','staff','showOffers','showGallery','showStaff'])
 or (p_layout-array['banner','gallery','staff','showOffers','showGallery','showStaff'])<>'{}'::jsonb
 or jsonb_typeof(p_layout->'gallery') is distinct from 'array' or jsonb_array_length(p_layout->'gallery')>8
 or jsonb_typeof(p_layout->'staff') is distinct from 'array' or jsonb_array_length(p_layout->'staff')>20 then
 raise exception 'INVALID_STOREFRONT_LAYOUT' using errcode='22023'; end if;
 foreach field in array array['showOffers','showGallery','showStaff'] loop
 if jsonb_typeof(p_layout->field) is distinct from 'boolean' then raise exception 'INVALID_STOREFRONT_LAYOUT' using errcode='22023'; end if;
 end loop;
 if p_layout->'banner' is distinct from 'null'::jsonb then
 entry:=p_layout->'banner';
 if jsonb_typeof(entry) is distinct from 'object' or (entry-array['image','alt','title','subtitle'])<>'{}'::jsonb
 or not shop_private.valid_website_logo(entry->>'image') then raise exception 'INVALID_STOREFRONT_BANNER' using errcode='22023'; end if;
 foreach field in array array['alt','title','subtitle'] loop
 if jsonb_typeof(entry->field) is distinct from 'string' or length(entry->>field)>320 or (entry->>field)~'[[:cntrl:]]' then raise exception 'INVALID_STOREFRONT_BANNER' using errcode='22023'; end if;
 end loop;
 end if;
 for entry in select value from jsonb_array_elements(p_layout->'gallery') loop
 if jsonb_typeof(entry) is distinct from 'object' or (entry-array['image','caption'])<>'{}'::jsonb
 or not shop_private.valid_website_logo(entry->>'image') or jsonb_typeof(entry->'caption') is distinct from 'string'
 or length(entry->>'caption')>160 then raise exception 'INVALID_STOREFRONT_GALLERY' using errcode='22023'; end if;
 end loop;
 for entry in select value from jsonb_array_elements(p_layout->'staff') loop
 if jsonb_typeof(entry) is distinct from 'object' or (entry-array['image','name','role','bio'])<>'{}'::jsonb
 or (entry->'image'='null'::jsonb or shop_private.valid_website_logo(entry->>'image')) is distinct from true then raise exception 'INVALID_STOREFRONT_STAFF' using errcode='22023'; end if;
 foreach field in array array['name','role','bio'] loop
 if jsonb_typeof(entry->field) is distinct from 'string' or length(entry->>field)>320 or (entry->>field)~'[[:cntrl:]]' then raise exception 'INVALID_STOREFRONT_STAFF' using errcode='22023'; end if;
 end loop;
 if length(btrim(entry->>'name')) not between 1 and 120 or length(entry->>'role')>120 then raise exception 'INVALID_STOREFRONT_STAFF' using errcode='22023'; end if;
 end loop;
end; $$;
create function public.shop_storefront_builder(p_shop_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not shop_private.has_permission(p_shop_id,'settings.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
 return jsonb_build_object('eligible',shop_private.storefront_builder_allowed(p_shop_id),'owner',shop_private.is_owner(p_shop_id),
 'revision',coalesce((select revision from public.shop_storefront_layouts where shop_id=p_shop_id),0),
 'draft',case when shop_private.storefront_builder_allowed(p_shop_id) then coalesce((select draft from public.shop_storefront_layouts where shop_id=p_shop_id),shop_private.empty_storefront_layout()) else null end,
 'published',case when shop_private.storefront_builder_allowed(p_shop_id) then (select published from public.shop_storefront_layouts where shop_id=p_shop_id) else null end,
 'websitePublished',exists(select 1 from public.shop_websites where shop_id=p_shop_id and publication_state='published'));
end; $$;
create function public.shop_storefront_builder_save(p_shop_id uuid,p_layout jsonb,p_revision integer,p_publish boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare current_revision integer;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
 perform 1 from public.shops where id=p_shop_id for update;
 if not shop_private.storefront_builder_allowed(p_shop_id) then raise exception 'WEBSITE_BUILDER_TEAM_MULTI_REQUIRED' using errcode='42501'; end if;
 if p_publish is null or p_publish and not shop_private.is_owner(p_shop_id) then raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501'; end if;
 perform shop_private.validate_storefront_layout(p_layout);
 select coalesce((select revision from public.shop_storefront_layouts where shop_id=p_shop_id),0) into current_revision;
 if p_revision is distinct from current_revision then raise exception 'STOREFRONT_CHANGED_RELOAD' using errcode='40001'; end if;
 if p_publish and not exists(select 1 from public.shop_websites where shop_id=p_shop_id and publication_state='published') then raise exception 'PUBLISH_SHOP_PROFILE_FIRST' using errcode='22023'; end if;
 insert into public.shop_storefront_layouts(shop_id,draft,published,revision) values(p_shop_id,p_layout,case when p_publish then p_layout end,1)
 on conflict(shop_id) do update set draft=excluded.draft,published=case when p_publish then excluded.draft else public.shop_storefront_layouts.published end,revision=current_revision+1,updated_at=clock_timestamp();
 insert into public.shop_storefront_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),case when p_publish then 'layout_publish' else 'layout_draft_save' end);
 return public.shop_storefront_builder(p_shop_id);
end; $$;

-- Offer source prices mirror counter defaults, including a service's unit discount.
create function shop_private.offer_sources(p_shop_id uuid) returns table(id uuid,kind text,name text,price numeric,discount numeric)
language sql stable set search_path='' as $$
 select p.id,'product',p.name,p.sale_price,0::numeric from public.products p join public.shops s on s.id=p.shop_id
 where p.shop_id=p_shop_id and p.is_active and s.business_mode in ('product','mixed')
 union all
 select v.id,'service',v.name,v.base_sale_price,case v.default_discount_type when 'percent' then round(v.base_sale_price*v.default_discount_value/100,2) else v.default_discount_value end
 from public.services v join public.shops s on s.id=v.shop_id where v.shop_id=p_shop_id and v.is_active and s.business_mode in ('service','mixed');
$$;
create function shop_private.offer_projection(p_shop_id uuid,p_offer_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select to_jsonb(o)-array['shop_id','created_at','updated_at'] || jsonb_build_object('oldPrice',
 (select sum(round((s.price-s.discount)*(l->>'quantity')::numeric,2)) from jsonb_array_elements(o.lines) l join shop_private.offer_sources(p_shop_id) s on s.id::text=l->>'sourceId' and s.kind=l->>'kind'),
 'lines',(select jsonb_agg(l||jsonb_build_object('name',coalesce(s.name,'Unavailable item'),'available',s.id is not null,'unitPrice',s.price,'discount',s.discount) order by n)
 from jsonb_array_elements(o.lines) with ordinality a(l,n) left join shop_private.offer_sources(p_shop_id) s on s.id::text=l->>'sourceId' and s.kind=l->>'kind'))
 from public.shop_catalog_offers o where o.shop_id=p_shop_id and o.id=p_offer_id;
$$;
create function public.shop_offers(p_shop_id uuid,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 if p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_OFFER_PAGE' using errcode='22023'; end if;
 return jsonb_build_object('canManage',shop_private.has_permission(p_shop_id,'sales.manage'),'canPublish',shop_private.has_permission(p_shop_id,'settings.manage'),
 'total',(select count(*) from public.shop_catalog_offers where shop_id=p_shop_id),
 'items',coalesce((select jsonb_agg(shop_private.offer_projection(p_shop_id,o.id) order by o.priority,o.created_at,o.id) from
 (select * from public.shop_catalog_offers where shop_id=p_shop_id order by priority,created_at,id limit 20 offset(p_page-1)*20) o),'[]'::jsonb));
end; $$;
create function public.shop_offer_sources(p_shop_id uuid,p_search text default '',p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not shop_private.has_permission(p_shop_id,'sales.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
 if p_search is null or length(p_search)>120 or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_OFFER_SEARCH' using errcode='22023'; end if;
 return jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('key',s.kind||':'||s.id) order by s.name,s.id) from
 (select * from shop_private.offer_sources(p_shop_id) where strpos(lower(name),lower(btrim(p_search)))>0 order by name,id limit 20 offset(p_page-1)*20) s),'[]'::jsonb),
 'total',(select count(*) from shop_private.offer_sources(p_shop_id) where strpos(lower(name),lower(btrim(p_search)))>0));
end; $$;
create function public.shop_offer_save(p_shop_id uuid,p_id uuid,p_revision integer,p_offer jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; existing public.shop_catalog_offers%rowtype; line jsonb; old_price numeric:=0; source record; seen text[]:='{}'; qty numeric; unavailable boolean:=false;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 perform 1 from public.shops where id=p_shop_id for update;
 if jsonb_typeof(p_offer) is distinct from 'object' or octet_length(p_offer::text)>16000
 or not(p_offer ?& array['name','description','price','priority','active','websiteVisible','startsAt','endsAt','lines'])
 or (p_offer-array['name','description','price','priority','active','websiteVisible','startsAt','endsAt','lines'])<>'{}'::jsonb
 or jsonb_typeof(p_offer->'name') is distinct from 'string' or length(btrim(p_offer->>'name')) not between 1 and 120
 or jsonb_typeof(p_offer->'description') is distinct from 'string' or length(p_offer->>'description')>320
 or jsonb_typeof(p_offer->'price') is distinct from 'number' or (p_offer->>'price')::numeric<=0 or (p_offer->>'price')::numeric>9999999999.99
 or round((p_offer->>'price')::numeric,2)<>(p_offer->>'price')::numeric
 or jsonb_typeof(p_offer->'priority') is distinct from 'number' or (p_offer->>'priority')::numeric not between 0 and 999999 or trunc((p_offer->>'priority')::numeric)<>(p_offer->>'priority')::numeric
 or jsonb_typeof(p_offer->'active') is distinct from 'boolean' or jsonb_typeof(p_offer->'websiteVisible') is distinct from 'boolean'
 or jsonb_typeof(p_offer->'lines') is distinct from 'array' or jsonb_array_length(p_offer->'lines') not between 1 and 20
 or not(p_offer->'startsAt'='null'::jsonb or jsonb_typeof(p_offer->'startsAt')='string')
 or not(p_offer->'endsAt'='null'::jsonb or jsonb_typeof(p_offer->'endsAt')='string') then raise exception 'INVALID_CATALOG_OFFER' using errcode='22023'; end if;
 if p_id is not null then
 select * into existing from public.shop_catalog_offers where id=p_id and shop_id=p_shop_id for update;
 if not found then raise exception 'OFFER_NOT_FOUND' using errcode='P0002'; end if;
 if p_revision is distinct from existing.revision then raise exception 'OFFER_CHANGED_RELOAD' using errcode='40001'; end if;
 elsif (select count(*) from public.shop_catalog_offers where shop_id=p_shop_id)>=100 then raise exception 'OFFER_LIMIT_REACHED' using errcode='22023'; end if;
 if (p_offer->>'websiteVisible')::boolean is distinct from coalesce(existing.website_visible,false)
 and not shop_private.has_permission(p_shop_id,'settings.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
 -- Editing public copy/recipes is also a publication action.
 if (p_offer->>'websiteVisible')::boolean and not shop_private.storefront_builder_allowed(p_shop_id) then raise exception 'WEBSITE_BUILDER_TEAM_MULTI_REQUIRED' using errcode='42501'; end if;
 if (p_offer->>'websiteVisible')::boolean and not shop_private.has_permission(p_shop_id,'settings.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
 if p_id is null and p_revision is distinct from 0 then raise exception 'OFFER_CHANGED_RELOAD' using errcode='40001'; end if;
 for line in select value from jsonb_array_elements(p_offer->'lines') loop
 if jsonb_typeof(line) is distinct from 'object' or (line-array['kind','sourceId','quantity'])<>'{}'::jsonb
 or coalesce(line->>'kind','') not in ('product','service') or jsonb_typeof(line->'sourceId') is distinct from 'string'
 or jsonb_typeof(line->'quantity') is distinct from 'number' then raise exception 'INVALID_OFFER_LINE' using errcode='22023'; end if;
 qty:=(line->>'quantity')::numeric;
 if qty not between 0.001 and 999 or round(qty,3)<>qty or ((line->>'kind')||':'||(line->>'sourceId'))=any(seen) then raise exception 'INVALID_OFFER_LINE' using errcode='22023'; end if;
 seen:=array_append(seen,(line->>'kind')||':'||(line->>'sourceId'));
 select * into source from shop_private.offer_sources(p_shop_id) where id=(line->>'sourceId')::uuid and kind=line->>'kind';
 if not found then
 if p_id is not null and (p_offer->>'active')::boolean=false and existing.lines @> jsonb_build_array(line) then unavailable:=true;continue;end if;
 raise exception 'OFFER_ITEM_UNAVAILABLE' using errcode='22023'; end if;
 old_price:=old_price+round((source.price-source.discount)*qty,2);
 end loop;
 if not unavailable and (p_offer->>'price')::numeric>=old_price then raise exception 'OFFER_PRICE_MUST_BE_BELOW_ITEMS' using errcode='22023'; end if;
 if p_offer->>'startsAt' is not null and not isfinite((p_offer->>'startsAt')::timestamptz) or p_offer->>'endsAt' is not null and not isfinite((p_offer->>'endsAt')::timestamptz) then raise exception 'INVALID_OFFER_DATES' using errcode='22023'; end if;
 result:=coalesce(p_id,gen_random_uuid());
 insert into public.shop_catalog_offers(id,shop_id,name,description,price,priority,active,website_visible,starts_at,ends_at,lines)
 values(result,p_shop_id,btrim(p_offer->>'name'),p_offer->>'description',(p_offer->>'price')::numeric,(p_offer->>'priority')::integer,(p_offer->>'active')::boolean,(p_offer->>'websiteVisible')::boolean,(p_offer->>'startsAt')::timestamptz,(p_offer->>'endsAt')::timestamptz,p_offer->'lines')
 on conflict(id) do update set name=excluded.name,description=excluded.description,price=excluded.price,priority=excluded.priority,active=excluded.active,website_visible=excluded.website_visible,starts_at=excluded.starts_at,ends_at=excluded.ends_at,lines=excluded.lines,revision=existing.revision+1,updated_at=clock_timestamp();
 insert into public.shop_storefront_events(shop_id,actor_user_id,action,record_id) values(p_shop_id,auth.uid(),'offer_save',result);
 return result;
end; $$;

-- Eligible active offers, sorted by explicit merchant priority then stable creation order.
-- A quantity participates in at most one bundle; incomplete bundles retain ordinary prices.
create function shop_private.match_catalog_offers(p_shop_id uuid,p_lines jsonb,p_allowed uuid[] default null) returns jsonb
language plpgsql stable set search_path='' as $$
declare remaining jsonb:='{}'; entry jsonb; recipe jsonb; offer public.shop_catalog_offers%rowtype; source record;
 key text; qty numeric; count_sets numeric; old_price numeric; savings numeric; discount numeric:=0; matched jsonb:='[]'; eligible boolean;
begin
 if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
 for entry in select value from jsonb_array_elements(p_lines) loop
 qty:=(entry->>'quantity')::numeric; key:=(entry->>'item_type')||':'||(entry->>'source_id');
 if key is null or qty is null or qty not between 0.001 and 1000000 or round(qty,5)<>qty then raise exception 'INVALID_OFFER_CART' using errcode='22023'; end if;
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
create function public.quote_pos_sale(p_shop_id uuid,p_location_id uuid,p_lines jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; matched jsonb; policy jsonb; priced jsonb;
begin
 base:=public.quote_sale_tax(p_shop_id,p_location_id,p_lines); -- Existing item/location authorization and validation.
 matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);
 if (matched->>'discount')::numeric=0 then return base||matched; end if;
 select p.policy into policy from public.tax_policy_versions p where shop_id=p_shop_id and effective_at<=statement_timestamp() order by effective_at desc,created_at desc,id desc limit 1;
 select jsonb_agg(jsonb_build_object('itemType',l->>'item_type','sourceId',l->>'source_id','quantity',(l->>'quantity')::numeric,'unitPrice',s.price,
 'lineDiscount',round(s.discount*(l->>'quantity')::numeric,2)) order by n) into priced
 from jsonb_array_elements(p_lines) with ordinality a(l,n) join shop_private.offer_sources(p_shop_id) s on s.id=(l->>'source_id')::uuid and s.kind=l->>'item_type';
 return shop_private.calculate_tax(priced,policy,(matched->>'discount')::numeric)||matched;
end; $$;
-- New POS saves use the same idempotent draft command, then attach the authoritative
-- matched bundle discount. Retrying an already completed save never reprices it.
alter table public.invoices add column offer_snapshot jsonb not null default '[]'::jsonb check(jsonb_typeof(offer_snapshot)='array');
create or replace function shop_private.save_pos_sale_draft(
  p_request_id uuid, p_shop_id uuid, p_location_id uuid, p_invoice_id uuid,
  p_staff_membership_id uuid, p_appointment_id uuid, p_customer_id uuid,
  p_notes text, p_lines jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor uuid; v_hash text; v_request public.pos_sale_requests%rowtype;
  v_invoice uuid; v_staff_name text; v_customer_name text; matched jsonb;
begin
  v_actor := shop_private.assert_shop_write_access(p_shop_id, 'sales.manage');
  perform shop_private.assert_location_access(p_shop_id, p_location_id, true);
  if p_request_id is null or p_staff_membership_id is null then raise exception 'INVALID_POS_CONTEXT'; end if;
  select coalesce(profile.display_name, profile.email_snapshot) into v_staff_name
  from public.shop_memberships member join public.profiles profile on profile.id = member.profile_id
  where member.id = p_staff_membership_id and member.shop_id = p_shop_id
    and member.status = 'active' and member.removed_at is null and profile.status = 'active'
    and (member.role = 'owner' or exists (select 1 from public.membership_location_assignments assignment
      where assignment.membership_id = member.id and assignment.location_id = p_location_id));
  if v_staff_name is null then raise exception 'INVALID_POS_STAFF' using errcode = '23514'; end if;
  if p_customer_id is not null then select name into v_customer_name from public.clients
    where id = p_customer_id and shop_id = p_shop_id and is_active; end if;
  if p_customer_id is not null and v_customer_name is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if p_appointment_id is not null and not shop_private.has_permission(p_shop_id, 'appointments.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_appointment_id is not null and not exists (select 1 from public.appointments appointment
    where appointment.id = p_appointment_id and appointment.shop_id = p_shop_id
      and appointment.location_id = p_location_id and appointment.assigned_membership_id = p_staff_membership_id
      and appointment.client_id is not distinct from p_customer_id
      and (appointment.sale_id is null or appointment.sale_id = p_invoice_id)
      and appointment.status in ('booked','arrived','waiting','in_service','completed')) then
    raise exception 'INVALID_POS_APPOINTMENT' using errcode = '23514';
  end if;
  v_hash := md5(jsonb_build_object('location', p_location_id, 'invoice', p_invoice_id,
    'staff', p_staff_membership_id, 'appointment', p_appointment_id, 'customer', p_customer_id,
    'notes', nullif(btrim(p_notes), ''), 'lines', p_lines)::text);
  insert into public.pos_sale_requests(request_id, shop_id, operation, payload_hash, actor_profile_id)
    values (p_request_id, p_shop_id, 'save', v_hash, v_actor) on conflict do nothing;
  select * into v_request from public.pos_sale_requests where request_id = p_request_id for update;
  if v_request.shop_id <> p_shop_id or v_request.operation <> 'save' or v_request.payload_hash <> v_hash
    or v_request.actor_profile_id <> v_actor then raise exception 'POS_REQUEST_CONFLICT' using errcode = '23505'; end if;
  if v_request.completed_at is not null then return v_request.invoice_id; end if;
  perform set_config('shop.location_id', p_location_id::text, true);
  v_invoice := shop_private.save_location_sale_draft(p_request_id, p_shop_id, p_location_id,
    p_invoice_id, p_customer_id, null, p_notes, p_lines);
  insert into public.pos_sale_contexts(invoice_id, shop_id, location_id, staff_membership_id,
    appointment_id, customer_name_snapshot, staff_name_snapshot)
  values (v_invoice, p_shop_id, p_location_id, p_staff_membership_id, p_appointment_id,
    v_customer_name, v_staff_name)
  on conflict (invoice_id) do update set staff_membership_id = excluded.staff_membership_id,
    appointment_id = excluded.appointment_id, customer_name_snapshot = excluded.customer_name_snapshot,
    staff_name_snapshot = excluded.staff_name_snapshot, updated_at = clock_timestamp();
  matched:=shop_private.match_catalog_offers(p_shop_id,p_lines);
  update public.invoices set tax_order_discount=(matched->>'discount')::numeric,offer_snapshot=matched->'offers' where id=v_invoice and shop_id=p_shop_id and status='draft';
  update public.pos_sale_requests set invoice_id = v_invoice, completed_at = clock_timestamp()
    where request_id = p_request_id;
  return v_invoice;
end;
$$;

create function shop_private.freeze_offer_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status<>'draft' and new.offer_snapshot is distinct from old.offer_snapshot then raise exception 'ISSUED_OFFER_IMMUTABLE' using errcode='23514'; end if;
 return new;
end; $$;
create trigger freeze_offer_snapshot before update on public.invoices for each row execute function shop_private.freeze_offer_snapshot();
create function shop_private.capture_receipt_offers() returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.snapshot:=new.snapshot||jsonb_build_object('offers',coalesce((select offer_snapshot from public.invoices where id=new.invoice_id and shop_id=new.shop_id),'[]'::jsonb));
 return new;
end; $$;
create trigger capture_receipt_offers before insert on public.sale_receipt_issue_snapshots for each row execute function shop_private.capture_receipt_offers();
create trigger capture_receipt_offers before insert on public.sale_receipts for each row execute function shop_private.capture_receipt_offers();

create function public.pos_catalog_offers(p_shop_id uuid,p_location_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare items jsonb;
begin
 perform shop_private.assert_sale_read_access(p_shop_id);
 perform shop_private.assert_location_access(p_shop_id,p_location_id,false);
 select coalesce(jsonb_agg(shop_private.offer_projection(p_shop_id,o.id)||jsonb_build_object('lines',(select jsonb_agg(l||jsonb_build_object('stock',case when l->>'kind'='product' then coalesce((select sum(b.remaining_quantity) from public.inventory_batches b where b.shop_id=p_shop_id and b.location_id=p_location_id and b.product_id=(l->>'sourceId')::uuid),0) else null end) order by n) from jsonb_array_elements(shop_private.offer_projection(p_shop_id,o.id)->'lines') with ordinality a(l,n))) order by priority,created_at,id),'[]'::jsonb) into items from public.shop_catalog_offers o
 where shop_id=p_shop_id and active and (starts_at is null or starts_at<=statement_timestamp()) and (ends_at is null or ends_at>statement_timestamp())
 and not exists(select 1 from jsonb_array_elements(o.lines) l where not exists(select 1 from shop_private.offer_sources(p_shop_id) s where s.id::text=l->>'sourceId' and s.kind=l->>'kind'));
 return items;
end; $$;
create function shop_private.public_storefront_offers(p_shop_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(payload order by priority,created_at,id),'[]'::jsonb) from (
 select o.id,o.priority,o.created_at,jsonb_build_object('id',o.id,'name',o.name,'description',o.description,'price',o.price,'oldPrice',
 (select sum(round((s.price-s.discount)*(l->>'quantity')::numeric,2)) from jsonb_array_elements(o.lines) l join shop_private.offer_sources(p_shop_id) s on s.id::text=l->>'sourceId' and s.kind=l->>'kind'),
 'currency',sh.business_currency,'lines',(select jsonb_agg(jsonb_build_object('id',c.id,'quantity',(l->>'quantity')::numeric,'name',c.public_name,'kind',l->>'kind','image',c.image_data_url,'price',s.price) order by n)
 from jsonb_array_elements(o.lines) with ordinality a(l,n) join public.shop_website_catalog_entries c on c.shop_id=o.shop_id and coalesce(c.product_id,c.service_id)::text=l->>'sourceId' and (case when c.product_id is not null then 'product' else 'service' end)=l->>'kind'
 join shop_private.offer_sources(p_shop_id) s on s.id::text=l->>'sourceId' and s.kind=l->>'kind')) payload
 from public.shop_catalog_offers o join public.shops sh on sh.id=o.shop_id
 where o.shop_id=p_shop_id and jsonb_array_length(o.lines)<=10 and o.active and o.website_visible and (o.starts_at is null or o.starts_at<=statement_timestamp()) and (o.ends_at is null or o.ends_at>statement_timestamp())
 and not exists(select 1 from jsonb_array_elements(o.lines) l where not exists(
 select 1 from public.shop_website_catalog_entries c join shop_private.offer_sources(p_shop_id) s on s.id=coalesce(c.product_id,c.service_id) and s.kind=l->>'kind'
 where c.shop_id=o.shop_id and c.published and c.show_price and (case when c.product_id is not null then 'product' else 'service' end)=l->>'kind' and coalesce(c.product_id,c.service_id)::text=l->>'sourceId'))
 and o.price<(select sum(round((s.price-s.discount)*(l->>'quantity')::numeric,2)) from jsonb_array_elements(o.lines) l join shop_private.offer_sources(p_shop_id) s on s.id::text=l->>'sourceId' and s.kind=l->>'kind')
 order by o.priority,o.created_at,o.id limit 20) offers;
$$;
create or replace function public.shop_website_showcase(p_slug text,p_page integer default 1) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; catalog jsonb; shop uuid; layout jsonb;
begin
 profile:=public.shop_website_public_profile(p_slug); if profile is null then return null; end if;
 catalog:=public.shop_website_storefront_catalog(p_slug,p_page); if catalog is null then return null; end if;
 select shop_id into shop from public.shop_website_slug_claims where slug=p_slug;
 if shop_private.storefront_builder_allowed(shop) then select published into layout from public.shop_storefront_layouts where shop_id=shop; end if;
 layout:=coalesce(layout,shop_private.empty_storefront_layout());
 -- Hidden sections are removed from the anonymous projection, not merely CSS-hidden.
 layout:=layout||jsonb_build_object('gallery',case when (layout->>'showGallery')::boolean then layout->'gallery' else '[]'::jsonb end,'staff',case when (layout->>'showStaff')::boolean then layout->'staff' else '[]'::jsonb end);
 return jsonb_build_object('profile',profile,'catalog',catalog,'storefront',layout||jsonb_build_object('offers',case when shop_private.storefront_builder_allowed(shop) and (layout->>'showOffers')::boolean then shop_private.public_storefront_offers(shop) else '[]'::jsonb end));
end; $$;
create or replace function public.shop_website_basket_request(
  p_slug text,p_name text,p_contact text,p_lines jsonb,p_message text,p_locale text,p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare shop uuid; line jsonb; item record; quantity numeric; summary text; seen uuid[]:='{}'; public_id uuid; requested jsonb:='[]'; matched jsonb; allowed_offers uuid[]:='{}'; offer_text text;
begin
  select shop_id into shop from public.shop_website_slug_claims where slug=p_slug;
  if shop is null then raise exception 'WEBSITE_UNAVAILABLE' using errcode='P0002';end if;
  perform 1 from public.shops where id=shop for update;
  if public.shop_website_public_profile(p_slug) is null then raise exception 'WEBSITE_UNAVAILABLE' using errcode='P0002';end if;
  if p_honeypot is null or length(p_honeypot)>200 or p_locale is null or p_locale not in ('ar','en') then raise exception 'INVALID_WEBSITE_INQUIRY' using errcode='22023';end if;
  if p_honeypot<>'' then return '{"ok":true}'::jsonb;end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 10
    or p_message is null or length(p_message)>400 then raise exception 'INVALID_BASKET_REQUEST' using errcode='22023';end if;
  summary:=case when p_locale='ar' then 'طلب من سلة الموقع — يحتاج تأكيد المتجر. لا يوجد دفع أو حجز مخزون.' else 'Website basket request — merchant confirmation required. No payment or stock reservation.' end;
  for line in select value from jsonb_array_elements(p_lines) loop
    if jsonb_typeof(line) is distinct from 'object' or (select count(*) from jsonb_object_keys(line))<>2
      or not (line ? 'id' and line ? 'quantity') or jsonb_typeof(line->'id') is distinct from 'string'
      or (line->>'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or jsonb_typeof(line->'quantity') is distinct from 'number' then raise exception 'INVALID_BASKET_REQUEST' using errcode='22023';end if;
    public_id:=(line->>'id')::uuid;quantity:=(line->>'quantity')::numeric;
    if public_id=any(seen) or quantity<0.001 or quantity>999 or round(quantity,3)<>quantity then raise exception 'INVALID_BASKET_REQUEST' using errcode='22023';end if;
    seen:=array_append(seen,public_id);
    -- Never trust a browser-supplied name, price, source ID, currency or visibility.
    select c.public_name,c.show_price,s.price,sh.business_currency,s.item_id,s.item_kind into item
    from public.shop_website_catalog_entries c
    join shop_private.website_catalog_sources(shop) s on s.item_id=coalesce(c.product_id,c.service_id)
      and s.item_kind=case when c.product_id is not null then 'product' else 'service' end
    join public.shops sh on sh.id=c.shop_id
    where c.id=public_id and c.shop_id=shop and c.published and s.active
      and (not c.show_price or (s.price is not null and s.price>=0));
    if not found then raise exception 'BASKET_ITEM_UNAVAILABLE' using errcode='22023';end if;
    requested:=requested||jsonb_build_array(jsonb_build_object('item_type',item.item_kind,'source_id',item.item_id,'quantity',quantity));
    summary:=summary||E'\n'||quantity::text||' × '||left(item.public_name,50)||case when length(item.public_name)>50 then '…' else '' end||' — '||
      case when item.show_price then item.price::text||' '||item.business_currency::text
        else case when p_locale='ar' then 'تأكيد السعر مطلوب' else 'Price on request' end end;
  end loop;
  if shop_private.storefront_builder_allowed(shop) and coalesce((select (published->>'showOffers')::boolean from public.shop_storefront_layouts where shop_id=shop),true) then
    select coalesce(array_agg((v->>'id')::uuid),'{}'::uuid[]) into allowed_offers from jsonb_array_elements(shop_private.public_storefront_offers(shop)) v;
    matched:=shop_private.match_catalog_offers(shop,requested,allowed_offers);
    select string_agg((v->>'name')||' × '||(v->>'quantity')||' — '||(v->>'price'),E'\n') into offer_text from jsonb_array_elements(matched->'offers') v;
    if offer_text is not null then summary:=summary||E'\n'||case when p_locale='ar' then 'الباقات: ' else 'Bundles: ' end||left(offer_text,500);end if;
  end if;
  if btrim(p_message)<>'' then summary:=summary||E'\n\n'||p_message;end if;
  -- Existing immutable owner inbox, publication locks, contact/IP quotas and generic response.
  return public.shop_website_inquiry_submit(p_slug,p_name,p_contact,summary,p_locale,p_honeypot);
end;
$$;

-- Explicit privileges for every new API/helper; no table is client-readable.
do $$ declare f record; begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','shop_private') and p.proname=any(array['storefront_builder_allowed','empty_storefront_layout','validate_storefront_layout','shop_storefront_builder','shop_storefront_builder_save','offer_sources','offer_projection','shop_offers','shop_offer_sources','shop_offer_save','match_catalog_offers','quote_pos_sale','save_pos_sale_draft','freeze_offer_snapshot','capture_receipt_offers','pos_catalog_offers','public_storefront_offers']) loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end $$;
grant execute on function public.save_pos_sale_draft(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb),public.shop_storefront_builder(uuid),public.shop_storefront_builder_save(uuid,jsonb,integer,boolean),public.shop_offers(uuid,integer),public.shop_offer_sources(uuid,text,integer),public.shop_offer_save(uuid,uuid,integer,jsonb),public.quote_pos_sale(uuid,uuid,jsonb),public.pos_catalog_offers(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
