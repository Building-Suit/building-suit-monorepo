-- SS-WEB-PROFILE-001: no backfill, automatic opt-in or customer publication.
create table public.shop_website_profiles (
  shop_id uuid primary key references public.shop_websites(shop_id) on delete restrict,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  owner_opted_in_at timestamptz,
  updated_at timestamptz not null default clock_timestamp()
);
-- Separate private assets: never accept a caller-supplied foreign asset identifier.
create table public.shop_website_logos (
  shop_id uuid primary key references public.shop_websites(shop_id) on delete restrict,
  data_url text not null,
  updated_at timestamptz not null default clock_timestamp()
);
create table public.shop_website_profile_events (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete restrict,
  actor_user_id uuid not null,
  action text not null check(action in ('save','logo_replace','logo_remove','publish','unpublish')),
  occurred_at timestamptz not null default clock_timestamp()
);
alter table public.shop_website_profiles enable row level security;
alter table public.shop_website_logos enable row level security;
alter table public.shop_website_profile_events enable row level security;
revoke all on public.shop_website_profiles, public.shop_website_logos, public.shop_website_profile_events from public, anon, authenticated, service_role;

-- Typed integration boundary for CATALOG. Never infer publication from operational
-- products/services, and never trust an item count supplied by a browser.
create function shop_private.website_catalog_readiness(p_shop_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('integration','pending','publishedItemCount',0);
$$;

create function shop_private.valid_website_logo(p_value text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare b bytea; w bigint; h bigint; pos integer; marker integer; segment_length integer; packed bigint;
begin
  if p_value is null or length(p_value) > 175000 or p_value !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$' then return false; end if;
  begin b := decode(split_part(p_value, ',', 2), 'base64'); exception when others then return false; end;
  if octet_length(b) < 20 or octet_length(b) > 131072 then return false; end if;
  -- Bound decoded dimensions on the command boundary too (not just the picker).
  if p_value like 'data:image/png;%' then
    if octet_length(b)<33 then return false; end if;
    w:=get_byte(b,16)::bigint*16777216+get_byte(b,17)*65536+get_byte(b,18)*256+get_byte(b,19);
    h:=get_byte(b,20)::bigint*16777216+get_byte(b,21)*65536+get_byte(b,22)*256+get_byte(b,23);
  elsif p_value like 'data:image/webp;%' then
    if octet_length(b)<25 or get_byte(b,4)::bigint+get_byte(b,5)*256+get_byte(b,6)*65536+get_byte(b,7)::bigint*16777216 <> octet_length(b)-8 then return false; end if;
    if substring(b from 13 for 4)=decode('5650384c','hex') and get_byte(b,20)=47 then
      packed:=get_byte(b,21)::bigint+get_byte(b,22)*256+get_byte(b,23)*65536+get_byte(b,24)::bigint*16777216;
      w:=1+(packed & 16383); h:=1+((packed >> 14) & 16383);
    elsif substring(b from 13 for 4)=decode('56503858','hex') and octet_length(b)>=30 then
      w:=1+get_byte(b,24)+get_byte(b,25)*256+get_byte(b,26)*65536;
      h:=1+get_byte(b,27)+get_byte(b,28)*256+get_byte(b,29)*65536;
    elsif substring(b from 13 for 4)=decode('56503820','hex') and octet_length(b)>=30 and substring(b from 24 for 3)=decode('9d012a','hex') then
      w:=(get_byte(b,26)+get_byte(b,27)*256) & 16383; h:=(get_byte(b,28)+get_byte(b,29)*256) & 16383;
    else return false; end if;
  else
    pos:=2;
    while pos+8<octet_length(b) loop
      if get_byte(b,pos)<>255 then return false; end if;
      marker:=get_byte(b,pos+1);
      if marker=255 then pos:=pos+1; continue; end if;
      if marker in (1,216,208,209,210,211,212,213,214,215) then pos:=pos+2; continue; end if;
      if marker in (217,218) then return false; end if;
      segment_length:=get_byte(b,pos+2)*256+get_byte(b,pos+3);
      if segment_length<2 or pos+2+segment_length>octet_length(b) then return false; end if;
      if marker in (192,193,194,195,197,198,199,201,202,203,205,206,207) then
        if segment_length<8 then return false; end if;
        h:=get_byte(b,pos+5)*256+get_byte(b,pos+6); w:=get_byte(b,pos+7)*256+get_byte(b,pos+8); exit;
      end if;
      pos:=pos+2+segment_length;
    end loop;
  end if;
  if w is null or h is null or w not between 1 and 2048 or h not between 1 and 2048 then return false; end if;
  return (p_value like 'data:image/png;%' and substring(b from 1 for 8) = decode('89504e470d0a1a0a','hex')
    and substring(b from 13 for 4) = decode('49484452','hex')
    and substring(b from octet_length(b)-7 for 8) = decode('49454e44ae426082','hex'))
    or (p_value like 'data:image/jpeg;%' and substring(b from 1 for 3) = decode('ffd8ff','hex') and substring(b from octet_length(b)-1 for 2) = decode('ffd9','hex'))
    or (p_value like 'data:image/webp;%' and substring(b from 1 for 4) = decode('52494646','hex')
      and substring(b from 9 for 4) = decode('57454250','hex') and substring(b from 13 for 4) in (decode('56503820','hex'),decode('5650384c','hex'),decode('56503858','hex')));
end;
$$;
alter table public.shop_website_logos add constraint safe_website_logo check(shop_private.valid_website_logo(data_url));

create function shop_private.website_profile_missing(p_shop_id uuid, p_profile jsonb)
returns jsonb language plpgsql stable set search_path = '' as $$
declare missing jsonb := '[]'; catalog jsonb := shop_private.website_catalog_readiness(p_shop_id);
begin
  if not exists(select 1 from public.shop_websites where shop_id=p_shop_id) then missing := missing || '"address"'::jsonb; end if;
  if length(btrim(coalesce(p_profile->>'publicName',''))) < 2 then missing := missing || '"publicName"'::jsonb; end if;
  if length(btrim(coalesce(p_profile->>'description',''))) < 1 then missing := missing || '"description"'::jsonb; end if;
  if not (case when p_profile ? 'logoDataUrl' then shop_private.valid_website_logo(p_profile->>'logoDataUrl') else exists(select 1 from public.shop_website_logos where shop_id=p_shop_id) end) then missing := missing || '"logo"'::jsonb; end if;
  if coalesce(p_profile->>'phone','') = '' and coalesce(p_profile->>'whatsapp','') = '' and coalesce(p_profile->>'email','') = '' then missing := missing || '"contact"'::jsonb; end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(p_profile->'locations','[]')) v
    join public.shop_locations l on l.id::text=v->>'id' and l.shop_id=p_shop_id and l.status='active'
    where v->'visible'='true'::jsonb and length(btrim(v->>'publicName'))>0 and length(btrim(v->>'address'))>0) then missing := missing || '"location"'::jsonb; end if;
  if catalog->>'integration' <> 'ready' or (catalog->>'publishedItemCount')::integer < 1 then missing := missing || '"publishedItem"'::jsonb; end if;
  return missing;
end;
$$;

create function public.shop_website_profile(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; v_draft jsonb;
begin
  if auth.uid() is null or not shop_private.has_permission(p_shop_id,'settings.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
  select coalesce(p.draft,'{}') into v_draft from public.shops s left join public.shop_website_profiles p on p.shop_id=s.id where s.id=p_shop_id and s.status='active';
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
  select jsonb_build_object('draft',v_draft,'state',coalesce(w.publication_state,'draft'),'slug',w.slug,
    'logoDataUrl',(select data_url from public.shop_website_logos where shop_id=p_shop_id),
    'catalog',shop_private.website_catalog_readiness(p_shop_id), 'missing',shop_private.website_profile_missing(p_shop_id,v_draft),
    'ownerOptedIn',coalesce(p.owner_opted_in_at is not null,false)) into result
    from public.shops s left join public.shop_websites w on w.shop_id=s.id left join public.shop_website_profiles p on p.shop_id=s.id where s.id=p_shop_id;
  return result;
end;
$$;

create function public.shop_website_profile_save(p_shop_id uuid, p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare entry jsonb; field text;
begin
  perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
  perform 1 from public.shops where id=p_shop_id and status='active' for update;
  if not exists(select 1 from public.shop_websites where shop_id=p_shop_id) then raise exception 'WEBSITE_ADDRESS_REQUIRED' using errcode='22023'; end if;
  if jsonb_typeof(p_profile) is distinct from 'object' or octet_length(p_profile::text)>20000
    or exists(select 1 from jsonb_object_keys(p_profile) k where k not in ('publicName','description','phone','whatsapp','email','openingHours','seoTitle','seoDescription','locations'))
    or jsonb_typeof(p_profile->'locations') is distinct from 'array' or jsonb_array_length(p_profile->'locations')>50 then raise exception 'INVALID_WEBSITE_PROFILE' using errcode='22023'; end if;
  foreach field in array array['publicName','description','phone','whatsapp','email','openingHours','seoTitle','seoDescription'] loop
    if jsonb_typeof(p_profile->field) is distinct from 'string' or (p_profile->>field) ~ '[[:cntrl:]]' and field <> 'openingHours'
      or length(p_profile->>field)>(case field when 'description' then 320 when 'openingHours' then 1000 when 'seoTitle' then 70 when 'seoDescription' then 170 when 'publicName' then 120 else 254 end) then raise exception 'INVALID_WEBSITE_PROFILE' using errcode='22023'; end if;
  end loop;
  if (p_profile->>'phone' <> '' and p_profile->>'phone' !~ '^\+?[0-9][0-9 ()-]{5,29}$')
    or (p_profile->>'whatsapp' <> '' and p_profile->>'whatsapp' !~ '^\+?[0-9]{7,15}$')
    or (p_profile->>'email' <> '' and p_profile->>'email' !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$') then raise exception 'INVALID_PUBLIC_CONTACT' using errcode='22023'; end if;
  for entry in select value from jsonb_array_elements(p_profile->'locations') loop
    if jsonb_typeof(entry) is distinct from 'object'
      or exists(select 1 from jsonb_object_keys(entry) k where k not in ('id','visible','publicName','address'))
      or jsonb_typeof(entry->'visible') is distinct from 'boolean'
      or jsonb_typeof(entry->'publicName') is distinct from 'string' or length(entry->>'publicName')>120
      or jsonb_typeof(entry->'address') is distinct from 'string' or length(entry->>'address')>500
      or (entry->>'publicName') ~ '[[:cntrl:]]' or (entry->>'address') ~ '[[:cntrl:]]'
      or not exists(select 1 from public.shop_locations l where l.id::text=entry->>'id' and l.shop_id=p_shop_id
        and (entry->'visible'='false'::jsonb or l.status='active')) then raise exception 'INVALID_PUBLIC_LOCATION' using errcode='22023'; end if;
  end loop;
  if (select count(*)<>count(distinct v->>'id') from jsonb_array_elements(p_profile->'locations') v) then raise exception 'INVALID_PUBLIC_LOCATION' using errcode='22023'; end if;
  insert into public.shop_website_profiles(shop_id,draft) values(p_shop_id,p_profile)
    on conflict(shop_id) do update set draft=excluded.draft,updated_at=clock_timestamp();
  insert into public.shop_website_profile_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),'save');
  return public.shop_website_profile(p_shop_id);
end;
$$;

create function public.shop_website_logo_replace(p_shop_id uuid, p_data_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
  perform 1 from public.shops where id=p_shop_id and status='active' for update;
  if not exists(select 1 from public.shop_websites where shop_id=p_shop_id) then raise exception 'WEBSITE_ADDRESS_REQUIRED' using errcode='22023'; end if;
  if p_data_url is null then delete from public.shop_website_logos where shop_id=p_shop_id;
  else
    if not shop_private.valid_website_logo(p_data_url) then raise exception 'INVALID_WEBSITE_LOGO' using errcode='22023'; end if;
    insert into public.shop_website_logos(shop_id,data_url) values(p_shop_id,p_data_url)
      on conflict(shop_id) do update set data_url=excluded.data_url,updated_at=clock_timestamp();
  end if;
  insert into public.shop_website_profile_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),case when p_data_url is null then 'logo_remove' else 'logo_replace' end);
  return public.shop_website_profile(p_shop_id);
end;
$$;

create function public.shop_website_profile_publish(p_shop_id uuid, p_owner_opt_in boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_draft jsonb; logo text;
begin
  perform shop_private.assert_shop_write_access(p_shop_id,'settings.manage');
  if not shop_private.is_owner(p_shop_id) or p_owner_opt_in is distinct from true then raise exception 'WEBSITE_OWNER_OPT_IN_REQUIRED' using errcode='42501'; end if;
  perform 1 from public.shops where id=p_shop_id and status='active' for update;
  if exists(select 1 from public.shop_websites where shop_id=p_shop_id and publication_state='suspended') then raise exception 'WEBSITE_SUSPENDED' using errcode='42501'; end if;
  select p.draft into v_draft from public.shop_website_profiles p where shop_id=p_shop_id;
  if jsonb_array_length(shop_private.website_profile_missing(p_shop_id,coalesce(v_draft,'{}')))>0 then raise exception 'WEBSITE_NOT_READY' using errcode='22023'; end if;
  select data_url into logo from public.shop_website_logos where shop_id=p_shop_id;
  -- Explicit snapshot: unpublished edits/replacements never alter public content.
  update public.shop_website_profiles set published=v_draft || jsonb_build_object('logoDataUrl',logo), owner_opted_in_at=clock_timestamp() where shop_id=p_shop_id;
  update public.shop_websites set publication_state='published',updated_at=clock_timestamp() where shop_id=p_shop_id;
  insert into public.shop_website_profile_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),'publish');
  return public.shop_website_profile(p_shop_id);
end;
$$;

create function public.shop_website_profile_unpublish(p_shop_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Revocation remains possible without a paid/write-enabled subscription.
  if auth.uid() is null or not shop_private.has_permission(p_shop_id,'settings.manage') then raise exception 'SHOP_PERMISSION_DENIED' using errcode='42501'; end if;
  perform 1 from public.shops where id=p_shop_id for update;
  update public.shop_websites set publication_state=case when publication_state='suspended' then 'suspended' else 'draft' end,updated_at=clock_timestamp() where shop_id=p_shop_id;
  update public.shop_website_profiles set published=null,owner_opted_in_at=null where shop_id=p_shop_id;
  insert into public.shop_website_profile_events(shop_id,actor_user_id,action) values(p_shop_id,auth.uid(),'unpublish');
  return public.shop_website_profile(p_shop_id);
end;
$$;

-- Public projection contains ONLY explicit published fields, never operational
-- contacts/addresses. Recheck live locations and catalog on every uncached read.
create function public.shop_website_public_profile(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select (p.published - 'locations') || jsonb_build_object('canonicalSlug',w.slug,'locations',
    (select jsonb_agg(v - 'id' - 'visible') from jsonb_array_elements(p.published->'locations') v
      join public.shop_locations l on l.id::text=v->>'id' and l.shop_id=p.shop_id and l.status='active' where v->'visible'='true'::jsonb))
  from public.shop_website_slug_claims c join public.shop_websites w on w.shop_id=c.shop_id
  join public.shop_website_profiles p on p.shop_id=w.shop_id join public.shops s on s.id=w.shop_id
  where c.slug=p_slug and w.publication_state='published' and s.status='active' and p.owner_opted_in_at is not null
    and p.published is not null and jsonb_array_length(shop_private.website_profile_missing(p.shop_id,p.published))=0;
$$;
revoke all on function shop_private.website_catalog_readiness(uuid), shop_private.valid_website_logo(text), shop_private.website_profile_missing(uuid,jsonb) from public, anon, authenticated, service_role;
revoke all on function public.shop_website_profile(uuid), public.shop_website_profile_save(uuid,jsonb), public.shop_website_logo_replace(uuid,text), public.shop_website_profile_publish(uuid,boolean), public.shop_website_profile_unpublish(uuid), public.shop_website_public_profile(text) from public, anon, authenticated, service_role;
grant execute on function public.shop_website_profile(uuid), public.shop_website_profile_save(uuid,jsonb), public.shop_website_logo_replace(uuid,text), public.shop_website_profile_publish(uuid,boolean), public.shop_website_profile_unpublish(uuid) to authenticated;
grant execute on function public.shop_website_public_profile(text) to anon, authenticated;
notify pgrst, 'reload schema';
