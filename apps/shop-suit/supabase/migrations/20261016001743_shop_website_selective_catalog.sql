-- SS-WEB-CATALOG-001. No backfill or automatic publication of operational items.
create table public.shop_website_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  product_id uuid unique,
  service_id uuid unique,
  public_name text not null check(length(btrim(public_name)) between 1 and 160 and public_name !~ '[[:cntrl:]]'),
  description text not null default '' check(length(description)<=2000),
  image_data_url text check(image_data_url is null or shop_private.valid_website_logo(image_data_url)),
  display_order integer not null default 0 check(display_order between 0 and 999999),
  show_price boolean not null default false,
  published boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  unique(id,shop_id),
  constraint shop_website_catalog_product_shop_fk foreign key(product_id,shop_id) references public.products(id,shop_id) on delete restrict,
  constraint shop_website_catalog_service_shop_fk foreign key(service_id,shop_id) references public.services(id,shop_id) on delete restrict,
  check(num_nonnulls(product_id,service_id)=1)
);
create index shop_website_catalog_shop_order on public.shop_website_catalog_entries(shop_id,published,display_order,id);
create table public.shop_website_catalog_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  entry_id uuid not null,
  actor_user_id uuid not null,
  action text not null check(action in ('save','publish','unpublish')),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint shop_website_catalog_event_shop_fk foreign key(entry_id,shop_id) references public.shop_website_catalog_entries(id,shop_id) on delete restrict
);
alter table public.shop_website_catalog_entries enable row level security;
alter table public.shop_website_catalog_events enable row level security;
revoke all on public.shop_website_catalog_entries,public.shop_website_catalog_events from public,anon,authenticated,service_role;

-- Minimal product-owned source adapter. No stock/cost/FIFO/supplier/staff data.
create function shop_private.website_catalog_sources(p_shop_id uuid)
returns table(item_id uuid,item_kind text,name text,active boolean,price numeric)
language sql stable set search_path='' as $$
  select p.id,'product'::text,p.name,p.is_active,case when p.sale_price::text not in ('NaN','Infinity','-Infinity') then p.sale_price end from public.products p where p.shop_id=p_shop_id
  union all
  select s.id,'service'::text,s.name,s.is_active,case when s.base_sale_price::text not in ('NaN','Infinity','-Infinity') then s.base_sale_price end from public.services s where s.shop_id=p_shop_id;
$$;
create function shop_private.website_catalog_owner(p_shop_id uuid)
returns void language plpgsql stable set search_path='' as $$
begin
  if auth.uid() is null or not shop_private.is_owner(p_shop_id)
    or not exists(select 1 from public.shops where id=p_shop_id and status='active') then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode='42501';
  end if;
end;
$$;
create function shop_private.website_catalog_items(p_shop_id uuid,p_page integer default 1)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(payload order by display_order,id),'[]'::jsonb) from (
  select
    jsonb_build_object('publicId',c.id,'kind',s.item_kind,'name',c.public_name,'description',c.description,
      'image',c.image_data_url,'displayOrder',c.display_order,'priceMode',case when c.show_price then 'shown' else 'contact' end)
    || case when c.show_price then jsonb_build_object('price',s.price,'currency',sh.business_currency) else '{}'::jsonb end
    as payload,c.display_order,c.id
  from public.shop_website_catalog_entries c
  join shop_private.website_catalog_sources(p_shop_id) s on s.item_id=coalesce(c.product_id,c.service_id)
    and s.item_kind=case when c.product_id is not null then 'product' else 'service' end
  join public.shops sh on sh.id=c.shop_id
  where c.shop_id=p_shop_id and c.published and s.active
    and (not c.show_price or (s.price is not null and s.price>=0))
  order by c.display_order,c.id limit 20 offset (p_page-1)*20) paged;
$$;
create or replace function shop_private.website_catalog_readiness(p_shop_id uuid)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('integration','ready','publishedItemCount',count(*))
  from public.shop_website_catalog_entries c join shop_private.website_catalog_sources(p_shop_id) s
    on s.item_id=coalesce(c.product_id,c.service_id) and (c.product_id is not null)=(s.item_kind='product')
  where c.shop_id=p_shop_id and c.published and s.active and (not c.show_price or (s.price is not null and s.price>=0));
$$;

create function public.shop_website_catalog(p_shop_id uuid,p_search text default '',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform shop_private.website_catalog_owner(p_shop_id);
  if p_page is null or p_page not between 1 and 100000 or p_search is null or length(p_search)>160 then raise exception 'INVALID_CATALOG_QUERY' using errcode='22023'; end if;
  with filtered as (
    select s.item_id,s.item_kind,s.name,s.active,s.price,c.id,c.public_name,c.description,c.image_data_url,c.display_order,c.show_price,c.published
    from shop_private.website_catalog_sources(p_shop_id) s left join public.shop_website_catalog_entries c on c.shop_id=p_shop_id
      and coalesce(c.product_id,c.service_id)=s.item_id and (c.product_id is not null)=(s.item_kind='product')
    where p_search='' or position(lower(p_search) in lower(s.name))>0 or position(lower(p_search) in lower(coalesce(c.public_name,'')))>0
  ), paged as (select * from filtered order by name,item_kind,item_id limit 20 offset (p_page-1)*20)
  select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('itemId',item_id,'kind',item_kind,'operationalName',name,
    'active',active,'price',price,'configured',id is not null,'publicName',coalesce(public_name,''),'description',coalesce(description,''),
    'image',image_data_url,'displayOrder',coalesce(display_order,0),'showPrice',coalesce(show_price,false),'published',coalesce(published,false)) order by name,item_kind,item_id) from paged),'[]'::jsonb),
    'total',(select count(*) from filtered),'page',p_page,'pageSize',20,'catalog',shop_private.website_catalog_readiness(p_shop_id)) into result;
  return result;
end;
$$;

create function public.shop_website_catalog_save(p_shop_id uuid,p_kind text,p_item_id uuid,p_entry jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare entry_id uuid; source record;
begin
  perform shop_private.website_catalog_owner(p_shop_id);
  perform 1 from public.shops where id=p_shop_id for update;
  perform shop_private.website_catalog_owner(p_shop_id);
  perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
  select * into source from shop_private.website_catalog_sources(p_shop_id) where item_id=p_item_id and item_kind=p_kind;
  if not found then raise exception 'CATALOG_ITEM_NOT_FOUND' using errcode='42501'; end if;
  if jsonb_typeof(p_entry) is distinct from 'object' or octet_length(p_entry::text)>200000
    or exists(select 1 from jsonb_object_keys(p_entry) k where k not in ('publicName','description','image','displayOrder','showPrice'))
    or jsonb_typeof(p_entry->'publicName') is distinct from 'string'
    or length(btrim(p_entry->>'publicName')) not between 1 and 160 or (p_entry->>'publicName') ~ '[[:cntrl:]]'
    or jsonb_typeof(p_entry->'description') is distinct from 'string' or length(p_entry->>'description')>2000
    or jsonb_typeof(p_entry->'showPrice') is distinct from 'boolean'
    or jsonb_typeof(p_entry->'displayOrder') is distinct from 'number' or (p_entry->>'displayOrder') !~ '^[0-9]{1,6}$'
    or (p_entry->'image' is distinct from 'null'::jsonb and (jsonb_typeof(p_entry->'image') is distinct from 'string' or not shop_private.valid_website_logo(p_entry->>'image')))
    or not(p_entry ? 'image') then raise exception 'INVALID_PUBLIC_CATALOG_ENTRY' using errcode='22023'; end if;
  -- Serialize with publication/readiness mutations; preserve publication state.
  select id into entry_id from public.shop_website_catalog_entries where shop_id=p_shop_id
    and coalesce(product_id,service_id)=p_item_id and (product_id is not null)=(p_kind='product') for update;
  if entry_id is null then
    insert into public.shop_website_catalog_entries(shop_id,product_id,service_id,public_name,description,image_data_url,display_order,show_price)
    values(p_shop_id,case when p_kind='product' then p_item_id end,case when p_kind='service' then p_item_id end,
      btrim(p_entry->>'publicName'),p_entry->>'description',p_entry->>'image',(p_entry->>'displayOrder')::integer,(p_entry->>'showPrice')::boolean) returning id into entry_id;
  else
    update public.shop_website_catalog_entries set public_name=btrim(p_entry->>'publicName'),description=p_entry->>'description',image_data_url=p_entry->>'image',
      display_order=(p_entry->>'displayOrder')::integer,show_price=(p_entry->>'showPrice')::boolean,updated_at=clock_timestamp() where id=entry_id;
  end if;
  insert into public.shop_website_catalog_events(shop_id,entry_id,actor_user_id,action) values(p_shop_id,entry_id,auth.uid(),'save');
end;
$$;

create function public.shop_website_catalog_publish(p_shop_id uuid,p_kind text,p_item_id uuid,p_published boolean)
returns void language plpgsql security definer set search_path='' as $$
declare entry_id uuid; source record; config public.shop_website_catalog_entries;
begin
  perform shop_private.website_catalog_owner(p_shop_id);
  -- Revocation is available even when a subscription no longer permits writes.
  if p_published is null then raise exception 'INVALID_PUBLICATION' using errcode='22023'; end if;
  perform 1 from public.shops where id=p_shop_id for update;
  perform shop_private.website_catalog_owner(p_shop_id);
  if p_published then perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage'); end if;
  select * into source from shop_private.website_catalog_sources(p_shop_id) where item_id=p_item_id and item_kind=p_kind;
  if not found then raise exception 'CATALOG_ITEM_NOT_FOUND' using errcode='42501'; end if;
  select * into config from public.shop_website_catalog_entries where shop_id=p_shop_id and coalesce(product_id,service_id)=p_item_id
    and (product_id is not null)=(p_kind='product') for update;
  if not found then raise exception 'SAVE_PUBLIC_CATALOG_ENTRY_FIRST' using errcode='22023'; end if;
  if p_published and (not source.active or (config.show_price and (source.price is null or source.price<0))) then raise exception 'PUBLIC_CATALOG_ITEM_NOT_READY' using errcode='22023'; end if;
  update public.shop_website_catalog_entries set published=p_published,updated_at=clock_timestamp() where id=config.id;
  insert into public.shop_website_catalog_events(shop_id,entry_id,actor_user_id,action)
    values(p_shop_id,config.id,auth.uid(),case when p_published then 'publish' else 'unpublish' end);
end;
$$;

-- PUBLIC implements rendering later. Every anonymous read checks immediate site
-- unpublish/suspension/readiness; there is no cached public materialized copy.
create function public.shop_website_public_catalog(p_slug text,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; shop uuid;
begin
  if p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_CATALOG_QUERY' using errcode='22023'; end if;
  profile:=public.shop_website_public_profile(p_slug);
  if profile is null then return null; end if;
  select shop_id into shop from public.shop_website_slug_claims where slug=p_slug;
  return jsonb_build_object('canonicalSlug',profile->>'canonicalSlug','items',shop_private.website_catalog_items(shop,p_page),
    'total',(shop_private.website_catalog_readiness(shop)->>'publishedItemCount')::integer,'page',p_page,'pageSize',20);
end;
$$;
revoke all on function shop_private.website_catalog_sources(uuid),shop_private.website_catalog_owner(uuid),shop_private.website_catalog_items(uuid,integer),shop_private.website_catalog_readiness(uuid) from public,anon,authenticated,service_role;
revoke all on function public.shop_website_catalog(uuid,text,integer),public.shop_website_catalog_save(uuid,text,uuid,jsonb),public.shop_website_catalog_publish(uuid,text,uuid,boolean),public.shop_website_public_catalog(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.shop_website_catalog(uuid,text,integer),public.shop_website_catalog_save(uuid,text,uuid,jsonb),public.shop_website_catalog_publish(uuid,text,uuid,boolean) to authenticated;
grant execute on function public.shop_website_public_catalog(text,integer) to anon,authenticated;
notify pgrst,'reload schema';
