-- SS-WEB-CUSTOMER-PORTAL-001. Read-only customer projection; no booking or finance.
create index appointments_customer_portal on public.appointments(shop_id,client_id,starts_at,id);
create function public.appointment_customer_portal(p_slug text,p_token text,p_bucket text default 'upcoming',p_page integer default 1)
returns jsonb language plpgsql security definer set search_path='' as $$
declare scope jsonb; result jsonb;
begin
 if p_bucket is null or p_bucket not in ('upcoming','past') or p_page is null or p_page not between 1 and 100000 then return '{"authenticated":false}'::jsonb;end if;
 scope:=shop_private.appointment_access_scope(p_slug,p_token);
 if scope is null then return '{"authenticated":false}'::jsonb;end if;
 with own as (
  select a.* from public.appointments a
  where a.shop_id=(scope->>'shopId')::uuid
   and ((scope->>'customerId' is not null and a.identity_kind='customer' and a.client_id=(scope->>'customerId')::uuid)
    or(scope->>'customerId' is null and a.identity_kind='walk_in' and a.client_id is null and a.id=(scope->>'appointmentId')::uuid))
 ), filtered as (
  select * from own where (ends_at>=statement_timestamp() and status not in ('completed','cancelled','no_show'))=(p_bucket='upcoming')
 ), paged as (
  select * from filtered order by case when p_bucket='upcoming' then starts_at end asc,case when p_bucket='past' then starts_at end desc,id
  limit 20 offset (p_page-1)*20
 ), projected as (
  select a.id,a.starts_at,jsonb_build_object(
   'startsAt',a.starts_at,'endsAt',a.ends_at,'status',a.status,
   'service',svc.name,'staff',p.display_name,
   'timeZone',coalesce((select h.timezone from public.appointment_working_hours h where h.shop_id=a.shop_id and h.location_id=a.location_id and h.membership_id=a.assigned_membership_id order by h.weekday limit 1),'UTC'),
   'location',(select jsonb_build_object('name',v->>'publicName','address',v->>'address')
     from public.shop_website_profiles profile cross join lateral jsonb_array_elements(profile.published->'locations') v
     join public.shop_locations l on l.id::text=v->>'id' and l.shop_id=profile.shop_id and l.status='active'
     where profile.shop_id=a.shop_id and v->>'id'=a.location_id::text and v->'visible'='true'::jsonb limit 1)
  ) payload
  from paged a join public.services svc on svc.id=a.service_id and svc.shop_id=a.shop_id
  join public.shop_memberships m on m.id=a.assigned_membership_id and m.shop_id=a.shop_id
  join public.shops s on s.id=a.shop_id
  join public.profiles p on p.id=m.profile_id and p.portal_id=s.portal_id
 )
 select jsonb_build_object('authenticated',true,'expiresAt',scope->'expiresAt','scope',case when scope->>'customerId' is null then 'appointment' else 'customer' end,
  'bucket',p_bucket,'page',p_page,'pageSize',20,'total',(select count(*) from filtered),
  'items',coalesce((select jsonb_agg(payload order by case when p_bucket='upcoming' then starts_at end asc,case when p_bucket='past' then starts_at end desc,id) from projected),'[]'::jsonb)) into result;
 return result;
exception when others then return '{"authenticated":false}'::jsonb;
end$$;
revoke all on function public.appointment_customer_portal(text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.appointment_customer_portal(text,text,text,integer) to anon,authenticated;
notify pgrst,'reload schema';
