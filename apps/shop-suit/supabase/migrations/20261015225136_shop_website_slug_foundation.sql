-- SS-WEB-SLUG-001. No existing Shop is published or assigned a URL by migration.
create function shop_private.valid_website_slug(p_slug text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(length(p_slug) between 3 and 50
    and p_slug collate "C" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and p_slug not like 'xn--%'
    and p_slug <> all(array['www','app','api','admin','auth','account','accounts','billing','blog','cdn','dashboard','docs','email','help','internal','login','logout','mail','manage','owner','preview','private','public','register','root','security','shop','shops','signup','staff','static','status','stg','staging','support','system','test','vercel','web','webmail','building-suit']), false);
$$;
revoke all on function shop_private.valid_website_slug(text) from public, anon, authenticated, service_role;

-- A claim is permanent, including after a rename, archive or suspension.
create table public.shop_website_slug_claims (
  slug text primary key check (shop_private.valid_website_slug(slug)),
  shop_id uuid not null references public.shops(id) on delete restrict,
  claimed_at timestamptz not null default clock_timestamp(),
  unique (slug, shop_id)
);
create unique index shop_website_slug_claims_case_insensitive on public.shop_website_slug_claims (lower(slug) collate "C");
create index shop_website_slug_claims_shop_idx on public.shop_website_slug_claims (shop_id);
create table public.shop_websites (
  shop_id uuid primary key references public.shops(id) on delete restrict,
  slug text not null,
  publication_state text not null default 'draft' check (publication_state in ('draft','published','suspended')),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (slug, shop_id) references public.shop_website_slug_claims(slug, shop_id) on delete restrict
);
alter table public.shop_website_slug_claims enable row level security;
alter table public.shop_websites enable row level security;
revoke all on public.shop_website_slug_claims, public.shop_websites from public, anon, authenticated, service_role;
-- Private settings are exposed only through authorized commands, not table grants.
create function shop_private.website_claim_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'WEBSITE_SLUG_CLAIM_IMMUTABLE' using errcode = '55000'; end;
$$;
revoke all on function shop_private.website_claim_immutable() from public, anon, authenticated, service_role;
create trigger website_claim_immutable before update or delete on public.shop_website_slug_claims
for each row execute function shop_private.website_claim_immutable();

create function public.shop_website_address(p_shop_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not shop_private.has_permission(p_shop_id, 'settings.manage') then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  select jsonb_build_object('slug', w.slug, 'state', w.publication_state,
    'aliases', coalesce((select jsonb_agg(c.slug order by c.slug) from public.shop_website_slug_claims c where c.shop_id = w.shop_id and c.slug <> w.slug), '[]'::jsonb))
    into v_result from public.shop_websites w join public.shops s on s.id = w.shop_id
    where w.shop_id = p_shop_id and s.status = 'active';
  return v_result;
end;
$$;

create function public.shop_website_address_save(p_shop_id uuid, p_slug text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_owner uuid;
begin
  perform shop_private.assert_shop_write_access(p_shop_id, 'settings.manage');
  if not shop_private.valid_website_slug(p_slug) then
    raise exception 'INVALID_WEBSITE_SLUG' using errcode = '22023';
  end if;
  -- Serialize explicit renames of a Shop, including its first claim.
  perform 1 from public.shops where id = p_shop_id and status = 'active' for update;
  if not found then raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501'; end if;
  insert into public.shop_website_slug_claims(slug,shop_id) values(p_slug,p_shop_id)
    on conflict do nothing;
  select shop_id into v_owner from public.shop_website_slug_claims where slug = p_slug;
  if v_owner is distinct from p_shop_id then
    raise exception 'WEBSITE_SLUG_UNAVAILABLE' using errcode = '23505';
  end if;
  insert into public.shop_websites(shop_id,slug) values(p_shop_id,p_slug)
    on conflict (shop_id) do update set slug = excluded.slug, updated_at = clock_timestamp();
  -- This operation never enables publication and never changes a display name.
  return public.shop_website_address(p_shop_id);
end;
$$;

-- Sanitized public lookup. No private name, membership or data is projected.
-- There is deliberately no command/grant to publish in this foundation task.
create function public.shop_website_host_resolve(p_slug text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('canonicalSlug', w.slug, 'isAlias', c.slug <> w.slug)
  from public.shop_website_slug_claims c
  join public.shop_websites w on w.shop_id = c.shop_id
  join public.shops s on s.id = w.shop_id
  where shop_private.valid_website_slug(p_slug) and c.slug = p_slug
    and w.publication_state = 'published' and s.status = 'active';
$$;
revoke all on function public.shop_website_address(uuid), public.shop_website_address_save(uuid,text), public.shop_website_host_resolve(text) from public, anon, authenticated, service_role;
grant execute on function public.shop_website_address(uuid), public.shop_website_address_save(uuid,text) to authenticated;
grant execute on function public.shop_website_host_resolve(text) to anon, authenticated;
notify pgrst, 'reload schema';
