-- SS-WEB-PUBLIC-001. No existing site is opted in or published.
create function public.shop_website_showcase(p_slug text,p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare profile jsonb; catalog jsonb;
begin
 profile:=public.shop_website_public_profile(p_slug);
 if profile is null then return null;end if;
 catalog:=public.shop_website_public_catalog(p_slug,p_page);
 if catalog is null then return null;end if;
 return jsonb_build_object('profile',profile,'catalog',catalog);
end;
$$;
-- Alias/asset resolution must now include actual opt-in and live readiness.
create or replace function public.shop_website_host_resolve(p_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('canonicalSlug',w.slug,'isAlias',c.slug<>w.slug)
 from public.shop_website_slug_claims c join public.shop_websites w on w.shop_id=c.shop_id
 where c.slug=p_slug and public.shop_website_public_profile(p_slug) is not null;
$$;

create table public.shop_website_inquiries (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.shops(id) on delete restrict,
 sender_name text not null check(length(sender_name) between 1 and 120),
 sender_contact text not null check(length(sender_contact) between 1 and 254),
 contact_key text not null,
 message text not null check(length(message) between 1 and 2000),
 locale text not null check(locale in ('ar','en')),
 status text not null default 'new' check(status in ('new','read','closed')),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(id,shop_id)
);
create index website_inquiries_shop_created on public.shop_website_inquiries(shop_id,created_at desc,id);
create index website_inquiries_contact_rate on public.shop_website_inquiries(shop_id,contact_key,created_at desc);
create table public.shop_website_inquiry_events (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id) on delete restrict,
 inquiry_id uuid not null,actor_user_id uuid not null,previous_status text not null,new_status text not null,
 occurred_at timestamptz not null default clock_timestamp(),
 foreign key(inquiry_id,shop_id) references public.shop_website_inquiries(id,shop_id) on delete restrict
);
alter table public.shop_website_inquiries enable row level security;
alter table public.shop_website_inquiry_events enable row level security;
revoke all on public.shop_website_inquiries,public.shop_website_inquiry_events from public,anon,authenticated,service_role;

create function shop_private.website_inquiry_immutable()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'WEBSITE_INQUIRY_IMMUTABLE' using errcode='42501';end if;
 if (new.id,new.shop_id,new.sender_name,new.sender_contact,new.contact_key,new.message,new.locale,new.created_at)
   is distinct from (old.id,old.shop_id,old.sender_name,old.sender_contact,old.contact_key,old.message,old.locale,old.created_at) then
   raise exception 'WEBSITE_INQUIRY_IMMUTABLE' using errcode='42501';end if;
 return new;
end;
$$;
create trigger website_inquiry_immutable before update or delete on public.shop_website_inquiries for each row execute function shop_private.website_inquiry_immutable();

create function public.shop_website_inquiry_submit(p_slug text,p_name text,p_contact text,p_message text,p_locale text,p_honeypot text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare shop uuid; contact text:=btrim(p_contact); identity text; key text;
begin
 select shop_id into shop from public.shop_website_slug_claims where slug=p_slug;
 if shop is null then raise exception 'WEBSITE_UNAVAILABLE' using errcode='P0002';end if;
 -- Shared lock serializes rate checks and publication/owner revocation writes.
 perform 1 from public.shops where id=shop for update;
 if public.shop_website_public_profile(p_slug) is null then raise exception 'WEBSITE_UNAVAILABLE' using errcode='P0002';end if;
 if p_honeypot is null or length(p_honeypot)>200 then raise exception 'INVALID_WEBSITE_INQUIRY' using errcode='22023';end if;
 if p_honeypot<>'' then return '{"ok":true}'::jsonb;end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_name ~ '[[:cntrl:]]'
   or p_contact is null or length(contact)>254 or contact ~ '[[:cntrl:]]'
   or p_message is null or length(btrim(p_message)) not between 1 and 2000
   or p_locale is null or p_locale not in ('ar','en') then raise exception 'INVALID_WEBSITE_INQUIRY' using errcode='22023';end if;
 if contact ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$' then identity:=lower(contact);
 elsif contact ~ '^\+?[0-9][0-9 ()-]{5,30}$' then
   identity:=regexp_replace(contact,'[^0-9]','','g');
   if length(identity) not between 7 and 15 then raise exception 'INVALID_WEBSITE_INQUIRY' using errcode='22023';end if;
 else raise exception 'INVALID_WEBSITE_INQUIRY' using errcode='22023';end if;
 key:=encode(extensions.digest(convert_to(identity,'UTF8'),'sha256'),'hex');
 -- These database caps also apply to callers bypassing the HTTP/IP limiter.
 if exists(select from public.shop_website_inquiries q where q.shop_id=shop and q.contact_key=key and q.created_at>clock_timestamp()-interval '10 minutes')
   or (select count(*) from public.shop_website_inquiries q where q.shop_id=shop and q.created_at>clock_timestamp()-interval '1 hour')>=40 then
   raise exception 'WEBSITE_INQUIRY_RATE_LIMITED' using errcode='P0001';end if;
 insert into public.shop_website_inquiries(shop_id,sender_name,sender_contact,contact_key,message,locale)
 values(shop,btrim(p_name),contact,key,btrim(p_message),p_locale);
 -- No row IDs, contacts or ownership identifiers are returned anonymously.
 return '{"ok":true}'::jsonb;
end;
$$;

create function public.shop_website_inquiries(p_shop_id uuid,p_status text default 'all',p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform shop_private.website_catalog_owner(p_shop_id);
 if p_status is null or p_status not in ('all','new','read','closed') or p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_INQUIRY_QUERY' using errcode='22023';end if;
 with filtered as (select * from public.shop_website_inquiries where shop_id=p_shop_id and (p_status='all' or status=p_status)),
 paged as (select * from filtered order by created_at desc,id limit 20 offset (p_page-1)*20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',sender_name,'contact',sender_contact,'message',message,'locale',locale,'status',status,'createdAt',created_at) order by created_at desc,id) from paged),'[]'::jsonb),
  'total',(select count(*) from filtered),'page',p_page,'pageSize',20) into result;
 return result;
end;
$$;
create function public.shop_website_inquiry_status(p_shop_id uuid,p_inquiry_id uuid,p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare previous text;
begin
 perform shop_private.website_catalog_owner(p_shop_id);
 perform 1 from public.shops where id=p_shop_id for update;
 perform shop_private.website_catalog_owner(p_shop_id);
 if p_status is null or p_status not in ('new','read','closed') then raise exception 'INVALID_INQUIRY_STATUS' using errcode='22023';end if;
 select status into previous from public.shop_website_inquiries where shop_id=p_shop_id and id=p_inquiry_id for update;
 if not found then raise exception 'INQUIRY_PERMISSION_DENIED' using errcode='42501';end if;
 update public.shop_website_inquiries set status=p_status,updated_at=clock_timestamp() where id=p_inquiry_id and shop_id=p_shop_id;
 insert into public.shop_website_inquiry_events(shop_id,inquiry_id,actor_user_id,previous_status,new_status) values(p_shop_id,p_inquiry_id,auth.uid(),previous,p_status);
end;
$$;
revoke all on function shop_private.website_inquiry_immutable() from public,anon,authenticated,service_role;
revoke all on function public.shop_website_showcase(text,integer),public.shop_website_inquiry_submit(text,text,text,text,text,text),public.shop_website_inquiries(uuid,text,integer),public.shop_website_inquiry_status(uuid,uuid,text),public.shop_website_host_resolve(text) from public,anon,authenticated,service_role;
grant execute on function public.shop_website_showcase(text,integer),public.shop_website_host_resolve(text),public.shop_website_inquiry_submit(text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.shop_website_inquiries(uuid,text,integer),public.shop_website_inquiry_status(uuid,uuid,text) to authenticated;
notify pgrst,'reload schema';
