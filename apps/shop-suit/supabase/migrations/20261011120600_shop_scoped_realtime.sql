-- Draft SOURCE only. No hosted execution is implied by publication.
-- Bounded invalidation signals contain no record IDs, amounts, names or evidence.
create table public.shop_realtime_versions (
 scope_key text primary key,
 shop_id uuid not null references public.shops(id) on delete cascade,
 location_id uuid references public.shop_locations(id) on delete cascade,
 feature text not null check(feature in ('appointments','sales','cash-shifts','team','customers','billing','products','services','inventory','pos')),
 revision bigint not null default 1
);
alter table public.shop_realtime_versions enable row level security;
revoke all on public.shop_realtime_versions from public,anon,authenticated;
grant select on public.shop_realtime_versions to authenticated;
create policy shop_realtime_read on public.shop_realtime_versions for select to authenticated using (
 shop_private.is_member(shop_id)
 and (location_id is null or shop_private.user_can_access_location(shop_id,location_id))
 and case feature
  when 'billing' then shop_private.is_owner(shop_id)
  when 'customers' then shop_private.has_permission(shop_id,'clients.view')
  when 'sales' then shop_private.has_permission(shop_id,'sales.view')
  when 'products' then shop_private.has_permission(shop_id,'products.view')
  when 'inventory' then shop_private.has_permission(shop_id,'inventory.view')
  when 'services' then shop_private.has_permission(shop_id,'services.view')
  else true end
);
-- Private trigger-only helper; browser roles cannot write or invoke it.
create function shop_private.bump_realtime(p_shop uuid,p_location uuid,p_feature text) returns void
language sql security definer set search_path='' as $$
 insert into public.shop_realtime_versions(scope_key,shop_id,location_id,feature)
 select p_shop::text||':'||coalesce(p_location::text,'all')||':'||p_feature,p_shop,p_location,p_feature
 where exists(select 1 from public.shops where id=p_shop)
 on conflict(scope_key) do update set revision=public.shop_realtime_versions.revision+1;
$$;
revoke all on function shop_private.bump_realtime(uuid,uuid,text) from public,anon,authenticated;
create function shop_private.realtime_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; s uuid; l uuid; f text; features text[];
begin
 row_data:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 if TG_TABLE_NAME='subscriptions' then
  for s in select shop_id from public.shop_memberships where profile_id=(row_data->>'profile_id')::uuid and role='owner' loop
   perform shop_private.bump_realtime(s,null,'billing');
  end loop;
 else
  s:=(row_data->>'shop_id')::uuid; l:=(row_data->>'location_id')::uuid;
  features:=case TG_TABLE_NAME
   when 'appointments' then array['appointments','pos']
   when 'appointment_schedule_blocks' then array['appointments']
   when 'appointment_working_hours' then array['appointments']
   when 'invoices' then array['sales','customers']
   when 'payments' then array['sales','customers','cash-shifts']
   when 'clients' then array['customers','sales','pos']
   when 'cash_sessions' then array['cash-shifts','pos']
   when 'cash_drawer_events' then array['cash-shifts']
   when 'shop_memberships' then array['team']
   when 'roles' then array['team']
   when 'membership_location_assignments' then array['team']
   when 'products' then array['products','inventory','pos']
   when 'catalog_categories' then array['products','services']
   when 'services' then array['services','pos']
   when 'service_location_availability' then array['services']
   when 'service_staff_eligibility' then array['services']
   when 'inventory_batches' then array['inventory']
   when 'inventory_movements' then array['inventory']
   when 'shop_billing_submissions' then array['billing']
  end;
  foreach f in array features loop perform shop_private.bump_realtime(s,l,f); end loop;
 end if;
 return null;
end $$;
revoke all on function shop_private.realtime_changed() from public,anon,authenticated;
do $$
declare t text;
begin
 foreach t in array array['subscriptions','appointments','appointment_schedule_blocks','appointment_working_hours','invoices','payments','clients','cash_sessions','cash_drawer_events','shop_memberships','roles','membership_location_assignments','products','catalog_categories','services','service_location_availability','service_staff_eligibility','inventory_batches','inventory_movements','shop_billing_submissions'] loop
  execute format('create trigger shop_realtime_changed after insert or update or delete on public.%I for each row execute function shop_private.realtime_changed()',t);
 end loop;
end $$;
alter publication supabase_realtime add table public.shop_realtime_versions;
