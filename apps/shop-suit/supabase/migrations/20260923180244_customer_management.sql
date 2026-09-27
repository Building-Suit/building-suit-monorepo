-- SS-CUST-001: expose the existing customer master as a supported, tenant-safe
-- capability. Receivable, payment, due-date and sale-finalization semantics
-- deliberately remain dormant.

alter table public.clients
  add column updated_by_profile_id uuid,
  add column archived_at timestamptz,
  add column archived_by_profile_id uuid;

alter table public.clients
  add constraint clients_updated_by_profile_id_fkey
    foreign key (updated_by_profile_id) references public.profiles (id)
    on delete restrict,
  add constraint clients_archived_by_profile_id_fkey
    foreign key (archived_by_profile_id) references public.profiles (id)
    on delete restrict,
  add constraint clients_archive_state_check check (
    (not is_active or (archived_at is null and archived_by_profile_id is null))
    and (archived_by_profile_id is null or archived_at is not null)
  ),
  add constraint clients_id_shop_unique unique (id, shop_id);

create index clients_shop_status_name_id_idx
  on public.clients (shop_id, is_active, lower(name), id);
create index clients_shop_email_idx
  on public.clients (shop_id, lower(email)) where email is not null;

-- Customer-linked operational records carry the tenant key in their foreign
-- key. RESTRICT preserves customer identity for any existing document/payment;
-- the supported customer lifecycle archives instead of deleting.
alter table public.invoices
  drop constraint invoices_client_id_fkey,
  add constraint invoices_client_shop_fk
    foreign key (client_id, shop_id)
    references public.clients (id, shop_id)
    on delete restrict
    not valid;
alter table public.payments
  drop constraint payments_client_id_fkey,
  add constraint payments_client_shop_fk
    foreign key (client_id, shop_id)
    references public.clients (id, shop_id)
    on delete restrict
    not valid;
alter table public.invoices validate constraint invoices_client_shop_fk;
alter table public.payments validate constraint payments_client_shop_fk;

-- Ensure delegated customer permissions are available in every Shop catalog.
insert into public.permissions (portal_id, key, description)
select p.id, permission.key, permission.description
from public.portals p
cross join (values
  ('clients.view', 'View customers'),
  ('clients.manage', 'Create, edit and archive customers')
) as permission(key, description)
where p.key = 'shop-crm'
on conflict (portal_id, key) do update
set description = excluded.description;

create function shop_private.customer_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    shop_private.has_permission(p_shop_id, 'clients.view') as can_view,
    shop_private.has_permission(p_shop_id, 'clients.manage') as can_manage
  where exists (
    select 1
    from public.shop_memberships m
    join public.profiles p on p.id = m.profile_id
    join public.shops s on s.id = m.shop_id and s.portal_id = p.portal_id
    where m.shop_id = p_shop_id
      and p.user_id = (select auth.uid())
      and p.status = 'active'::public.profile_status
      and m.status = 'active'::public.shop_membership_status
      and s.status = 'active'
  );
$$;

create function shop_private.assert_customer_read_access(p_shop_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_view boolean;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  select access.can_view into v_can_view
  from shop_private.customer_access(p_shop_id) access;
  if not coalesce(v_can_view, false) then
    raise exception 'SHOP_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return true;
end;
$$;

create function shop_private.list_customers(
  p_shop_id uuid,
  p_search text default null,
  p_is_active boolean default true,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(btrim(p_search), '');
  v_offset integer;
  v_total bigint;
  v_items jsonb;
  v_can_manage boolean;
begin
  perform shop_private.assert_customer_read_access(p_shop_id);
  if p_page is null or p_page < 1
    or p_page_size is null or p_page_size < 1 or p_page_size > 100
    or (v_search is not null and length(v_search) > 160) then
    raise exception 'INVALID_CUSTOMER_QUERY' using errcode = '22023';
  end if;
  v_offset := (p_page - 1) * p_page_size;
  select access.can_manage into v_can_manage
  from shop_private.customer_access(p_shop_id) access;

  select count(*) into v_total
  from public.clients c
  where c.shop_id = p_shop_id
    and (p_is_active is null or c.is_active = p_is_active)
    and (v_search is null
      or c.name ilike '%' || v_search || '%'
      or c.phone ilike '%' || v_search || '%'
      or c.email ilike '%' || v_search || '%');

  select coalesce(jsonb_agg((to_jsonb(page_rows) - 'name_key') order by page_rows.name_key, page_rows.id), '[]'::jsonb)
  into v_items
  from (
    select c.id, c.name, c.phone, c.email, c.address, c.notes, c.is_active,
      c.created_at, c.updated_at, c.archived_at, lower(c.name) as name_key
    from public.clients c
    where c.shop_id = p_shop_id
      and (p_is_active is null or c.is_active = p_is_active)
      and (v_search is null
        or c.name ilike '%' || v_search || '%'
        or c.phone ilike '%' || v_search || '%'
        or c.email ilike '%' || v_search || '%')
    order by lower(c.name), c.id
    offset v_offset limit p_page_size
  ) page_rows;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', p_page,
    'pageSize', p_page_size,
    'canManage', coalesce(v_can_manage, false)
  );
end;
$$;

create function shop_private.get_customer(p_shop_id uuid, p_customer_id uuid)
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  can_manage boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform shop_private.assert_customer_read_access(p_shop_id);
  return query
  select c.id, c.name, c.phone, c.email, c.address, c.notes, c.is_active,
    c.created_at, c.updated_at, c.archived_at, access.can_manage
  from public.clients c
  cross join shop_private.customer_access(p_shop_id) access
  where c.id = p_customer_id and c.shop_id = p_shop_id;
end;
$$;

create function shop_private.save_customer(
  p_shop_id uuid,
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_customer_id uuid;
  v_email text := nullif(btrim(p_email), '');
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'clients.manage'
  );
  if p_name is null or length(btrim(p_name)) < 2 or length(btrim(p_name)) > 160
    or (p_phone is not null and length(btrim(p_phone)) > 50)
    or (v_email is not null and (length(v_email) > 254 or position('@' in v_email) <= 1))
    or (p_address is not null and length(btrim(p_address)) > 500)
    or (p_notes is not null and length(btrim(p_notes)) > 2000) then
    raise exception 'INVALID_CUSTOMER' using errcode = '22023';
  end if;

  if p_customer_id is null then
    insert into public.clients (
      shop_id, name, phone, email, address, notes,
      created_by_profile_id, updated_by_profile_id
    ) values (
      p_shop_id, btrim(p_name), nullif(btrim(p_phone), ''), v_email,
      nullif(btrim(p_address), ''), nullif(btrim(p_notes), ''),
      v_profile_id, v_profile_id
    ) returning clients.id into v_customer_id;
  else
    update public.clients
    set name = btrim(p_name), phone = nullif(btrim(p_phone), ''),
      email = v_email, address = nullif(btrim(p_address), ''),
      notes = nullif(btrim(p_notes), ''), updated_at = now(),
      updated_by_profile_id = v_profile_id
    where clients.id = p_customer_id and shop_id = p_shop_id and is_active
    returning clients.id into v_customer_id;
    if v_customer_id is null then
      raise exception 'CUSTOMER_NOT_FOUND';
    end if;
  end if;
  return v_customer_id;
end;
$$;

create function shop_private.archive_customer(p_shop_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  v_profile_id := shop_private.assert_shop_write_access(
    p_shop_id, 'clients.manage'
  );
  update public.clients
  set is_active = false, archived_at = now(),
    archived_by_profile_id = v_profile_id,
    updated_at = now(), updated_by_profile_id = v_profile_id
  where id = p_customer_id and shop_id = p_shop_id and is_active;
  if not found then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;
end;
$$;

revoke all on function
  shop_private.customer_access(uuid),
  shop_private.assert_customer_read_access(uuid),
  shop_private.list_customers(uuid, text, boolean, integer, integer),
  shop_private.get_customer(uuid, uuid),
  shop_private.save_customer(uuid, uuid, text, text, text, text, text),
  shop_private.archive_customer(uuid, uuid)
from public, anon, authenticated, service_role;

create function public.customer_access(p_shop_id uuid)
returns table (can_view boolean, can_manage boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select * from shop_private.customer_access(p_shop_id);
$$;

create function public.list_customers(
  p_shop_id uuid,
  p_search text default null,
  p_is_active boolean default true,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select shop_private.list_customers(
    p_shop_id, p_search, p_is_active, p_page, p_page_size
  );
$$;

create function public.get_customer(p_shop_id uuid, p_customer_id uuid)
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  can_manage boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select * from shop_private.get_customer(p_shop_id, p_customer_id);
$$;

create function public.save_customer(
  p_shop_id uuid,
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_address text,
  p_notes text
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select shop_private.save_customer(
    p_shop_id, p_customer_id, p_name, p_phone, p_email, p_address, p_notes
  );
$$;

create function public.archive_customer(p_shop_id uuid, p_customer_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select shop_private.archive_customer(p_shop_id, p_customer_id);
$$;

revoke all on function
  public.customer_access(uuid),
  public.list_customers(uuid, text, boolean, integer, integer),
  public.get_customer(uuid, uuid),
  public.save_customer(uuid, uuid, text, text, text, text, text),
  public.archive_customer(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.customer_access(uuid),
  public.list_customers(uuid, text, boolean, integer, integer),
  public.get_customer(uuid, uuid),
  public.save_customer(uuid, uuid, text, text, text, text, text),
  public.archive_customer(uuid, uuid)
to authenticated;

revoke insert, update, delete, truncate on table public.clients
from anon, authenticated;

notify pgrst, 'reload schema';
