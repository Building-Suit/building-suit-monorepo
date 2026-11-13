-- Customer-facing discovery and basket requests reuse explicit public disclosure.
-- These are inquiries for merchant confirmation, never paid orders or stock reservations.
create function public.shop_website_storefront_catalog(
  p_slug text, p_page integer default 1, p_search text default '',
  p_kind text default 'all', p_sort text default 'featured'
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare profile jsonb; shop uuid; result jsonb; booking boolean;
begin
  if p_page is null or p_page not between 1 and 100000 or p_search is null or length(p_search)>120
    or p_kind is null or p_kind not in ('all','product','service')
    or p_sort is null or p_sort not in ('featured','name','price_asc','price_desc') then
    raise exception 'INVALID_CATALOG_QUERY' using errcode='22023';
  end if;
  profile:=public.shop_website_public_profile(p_slug);
  if profile is null then return null; end if;
  select shop_id into shop from public.shop_website_slug_claims where slug=p_slug;
  booking:=shop_private.booking_shop(p_slug) is not null;
  with eligible as (
    select c.id,c.public_name,c.description,c.image_data_url,c.display_order,c.show_price,
      s.item_kind,s.price,sh.business_currency,
      booking and exists(select 1 from shop_private.booking_combinations(shop) b where b.service_ref=c.id) as bookable
    from public.shop_website_catalog_entries c
    join shop_private.website_catalog_sources(shop) s on s.item_id=coalesce(c.product_id,c.service_id)
      and s.item_kind=case when c.product_id is not null then 'product' else 'service' end
    join public.shops sh on sh.id=c.shop_id
    where c.shop_id=shop and c.published and s.active and (not c.show_price or (s.price is not null and s.price>=0))
  ), searched as (
    select * from eligible where btrim(p_search)='' or strpos(lower(public_name||' '||description),lower(btrim(p_search)))>0
  ), filtered as (
    select * from searched where p_kind='all' or item_kind=p_kind
  ), paged as (
    select * from filtered order by
      case when p_sort='name' then lower(public_name) end,
      case when p_sort='price_asc' and show_price then price end asc nulls last,
      case when p_sort='price_desc' and show_price then price end desc nulls last,
      display_order,id limit 20 offset (p_page-1)*20
  )
  select jsonb_build_object('canonicalSlug',profile->>'canonicalSlug','page',p_page,'pageSize',20,
    'total',(select count(*) from filtered),'bookingEnabled',booking,
    'counts',jsonb_build_object('all',(select count(*) from searched),'product',(select count(*) from searched where item_kind='product'),'service',(select count(*) from searched where item_kind='service')),
    'items',coalesce((select jsonb_agg(jsonb_build_object('publicId',id,'kind',item_kind,'name',public_name,
      'description',description,'image',image_data_url,'displayOrder',display_order,'bookable',bookable,
      'priceMode',case when show_price then 'shown' else 'contact' end)
      ||case when show_price then jsonb_build_object('price',price,'currency',business_currency) else '{}'::jsonb end
      order by case when p_sort='name' then lower(public_name) end,
        case when p_sort='price_asc' and show_price then price end asc nulls last,
        case when p_sort='price_desc' and show_price then price end desc nulls last,display_order,id) from paged),'[]'::jsonb)) into result;
  return result;
end;
$$;

-- Preserve the original SSR contract and enrich it additively for the storefront.
create or replace function public.shop_website_showcase(p_slug text,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; catalog jsonb;
begin
  profile:=public.shop_website_public_profile(p_slug);if profile is null then return null;end if;
  catalog:=public.shop_website_storefront_catalog(p_slug,p_page);if catalog is null then return null;end if;
  return jsonb_build_object('profile',profile,'catalog',catalog);
end;
$$;

create function public.shop_website_basket_request(
  p_slug text,p_name text,p_contact text,p_lines jsonb,p_message text,p_locale text,p_honeypot text default ''
) returns jsonb language plpgsql security definer set search_path='' as $$
declare shop uuid; line jsonb; item record; quantity numeric; summary text; seen uuid[]:='{}'; public_id uuid;
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
    select c.public_name,c.show_price,s.price,sh.business_currency into item
    from public.shop_website_catalog_entries c
    join shop_private.website_catalog_sources(shop) s on s.item_id=coalesce(c.product_id,c.service_id)
      and s.item_kind=case when c.product_id is not null then 'product' else 'service' end
    join public.shops sh on sh.id=c.shop_id
    where c.id=public_id and c.shop_id=shop and c.published and s.active
      and (not c.show_price or (s.price is not null and s.price>=0));
    if not found then raise exception 'BASKET_ITEM_UNAVAILABLE' using errcode='22023';end if;
    summary:=summary||E'\n'||quantity::text||' × '||left(item.public_name,90)||case when length(item.public_name)>90 then '…' else '' end||' — '||
      case when item.show_price then item.price::text||' '||item.business_currency::text
        else case when p_locale='ar' then 'تأكيد السعر مطلوب' else 'Price on request' end end;
  end loop;
  if btrim(p_message)<>'' then summary:=summary||E'\n\n'||p_message;end if;
  -- Existing immutable owner inbox, publication locks, contact/IP quotas and generic response.
  return public.shop_website_inquiry_submit(p_slug,p_name,p_contact,summary,p_locale,p_honeypot);
end;
$$;
revoke all on function public.shop_website_storefront_catalog(text,integer,text,text,text),public.shop_website_basket_request(text,text,text,jsonb,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.shop_website_storefront_catalog(text,integer,text,text,text),public.shop_website_basket_request(text,text,text,jsonb,text,text,text) to anon,authenticated;
notify pgrst,'reload schema';
