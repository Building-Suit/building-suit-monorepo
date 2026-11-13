begin;

-- The Shop project owns assignments. HQ stores a bounded, non-operational
-- projection for its founder's office, separate from the canonical HQ roster.
create table hq_private.shop_suit_staff_snapshot (
  singleton boolean primary key default true check (singleton),
  observed_at timestamptz not null,
  staff jsonb check (staff is null or (jsonb_typeof(staff) = 'array' and jsonb_array_length(staff) <= 2000))
);
alter table hq_private.shop_suit_staff_snapshot enable row level security;
revoke all on table hq_private.shop_suit_staff_snapshot from public, anon, authenticated, service_role;

create function public.hq_worker_sync_shop_staff(p_worker_id uuid, p_staff jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_staff jsonb;
  v_count integer := 0;
  v_uuid constant text := '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$';
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then
    raise exception 'HQ_WORKER_REQUIRED' using errcode = '42501';
  end if;
  -- NULL explicitly reports a roster exceeding the transport cap; never
  -- replace the founder's complete roster with the first arbitrary page(s).
  if p_staff is not null then
    if jsonb_typeof(p_staff) is distinct from 'array' or octet_length(p_staff::text) > 2000000 then
      raise exception 'HQ_INVALID_SHOP_STAFF' using errcode = '22023';
    end if;
    v_count := jsonb_array_length(p_staff);
    if v_count > 2000 or exists (
      select 1 from jsonb_array_elements(p_staff) as item(value)
      where case when jsonb_typeof(item.value) is distinct from 'object' then true else
        (item.value - array['employeeId','shopName','state']) <> '{}'::jsonb
        or jsonb_typeof(item.value->'employeeId') is distinct from 'string'
        or coalesce(item.value->>'employeeId', '') !~ v_uuid
        or jsonb_typeof(item.value->'shopName') is distinct from 'string'
        or char_length(item.value->>'shopName') not between 1 and 200
        or (item.value->>'shopName') !~ '[^[:space:]]'
        or (item.value->>'shopName') ~ '[[:cntrl:]]'
        or jsonb_typeof(item.value->'state') is distinct from 'string'
        or item.value->>'state' not in ('idle','busy') end
    ) or v_count <> (select count(distinct item.value->>'employeeId') from jsonb_array_elements(p_staff) item(value)) then
      raise exception 'HQ_INVALID_SHOP_STAFF' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(item.value order by (item.value->>'employeeId')::uuid), '[]'::jsonb)
      into v_staff from jsonb_array_elements(p_staff) item(value);
  end if;
  insert into hq_private.shop_suit_staff_snapshot (observed_at, staff)
  values (clock_timestamp(), v_staff)
  on conflict (singleton) do update set observed_at = excluded.observed_at, staff = excluded.staff
  where shop_suit_staff_snapshot.observed_at <= excluded.observed_at
    and shop_suit_staff_snapshot.staff is distinct from excluded.staff;
  if found then perform hq_private.live_emit('company'); end if;
  return jsonb_build_object('accepted', true, 'count', v_count,
    'status', case when v_staff is null then 'overflow' else 'ready' end);
end;
$$;

create function public.hq_shop_suit_staff(p_after uuid default null, p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_snapshot hq_private.shop_suit_staff_snapshot%rowtype;
  v_status text;
  v_page jsonb;
  v_limit integer := coalesce(p_limit, 100);
  v_next uuid;
begin
  if hq_private.founder_uid() is null then
    raise exception 'HQ_FOUNDER_REQUIRED' using errcode = '42501';
  end if;
  if v_limit not between 1 and 100 then
    raise exception 'HQ_INVALID_SHOP_STAFF_PAGE' using errcode = '22023';
  end if;
  select * into v_snapshot from hq_private.shop_suit_staff_snapshot where singleton;
  v_status := case when not found then 'unconfigured'
    when v_snapshot.staff is null then 'overflow' else 'ready' end;
  if v_status <> 'ready' then
    return jsonb_build_object('status', v_status, 'staff', '[]'::jsonb, 'next', null, 'observedAt', v_snapshot.observed_at);
  end if;
  select coalesce(jsonb_agg(page.value order by page.id), '[]'::jsonb) into v_page from (
    select item.value, (item.value->>'employeeId')::uuid id
    from jsonb_array_elements(v_snapshot.staff) item(value)
    where p_after is null or (item.value->>'employeeId')::uuid > p_after
    order by id limit v_limit + 1
  ) page;
  if jsonb_array_length(v_page) > v_limit then
    v_next := (v_page->(v_limit - 1)->>'employeeId')::uuid;
    v_page := v_page - v_limit;
  end if;
  return jsonb_build_object('status', 'ready', 'staff', v_page, 'next', v_next, 'observedAt', v_snapshot.observed_at);
end;
$$;

revoke all on function public.hq_worker_sync_shop_staff(uuid, jsonb), public.hq_shop_suit_staff(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.hq_worker_sync_shop_staff(uuid, jsonb), public.hq_shop_suit_staff(uuid, integer)
  to authenticated;
notify pgrst, 'reload schema';
commit;
