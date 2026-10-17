-- DOS-M1-017. Read-only administrative audit projections; no retention/export/erasure policy.
create or replace function doctor_private.administrative_capabilities() returns text[]
language sql immutable security invoker set search_path='' as $$select array[
 'dashboard.read','locations.read','locations.manage','patients.read','patients.write','documents.read','documents.write',
 'availability.manage','appointments.read','appointments.write','queue.manage','audit.read']::text[]$$;
alter table public.memberships drop constraint memberships_capabilities_check;
alter table public.memberships add constraint memberships_capabilities_check check(capabilities <@ doctor_private.administrative_capabilities());
alter table public.membership_locations drop constraint membership_locations_capabilities_check;
alter table public.membership_locations add constraint membership_locations_capabilities_check check(capabilities is null or capabilities <@ doctor_private.administrative_capabilities());
-- New capability is opt-in for delegated memberships; existing rows are untouched.
create or replace function doctor_private.validate_grants(p_practice uuid,p_grants jsonb,p_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare item jsonb; location uuid; capabilities text[]; result jsonb:='[]'; seen uuid[]:='{}';
begin
 if p_grants is null or jsonb_typeof(p_grants)<>'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 if jsonb_array_length(p_grants) not between 1 and 100 then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
 for item in select value from jsonb_array_elements(p_grants) loop
  if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
   or not(item ? 'location_id' and item ? 'capabilities') or coalesce(item->>'location_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   or jsonb_typeof(item->'capabilities') is distinct from 'array' then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  location:=(item->>'location_id')::uuid;
  if location=any(seen) or not exists(select 1 from public.locations where id=location and practice_id=p_practice and (p_archived or archived_at is null)) then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  if jsonb_array_length(item->'capabilities') not between 1 and cardinality(doctor_private.administrative_capabilities()) or exists(select 1 from jsonb_array_elements(item->'capabilities') where jsonb_typeof(value)<>'string') then
   raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  select array_agg(distinct value order by value) into capabilities from jsonb_array_elements_text(item->'capabilities');
  if not capabilities <@ doctor_private.administrative_capabilities() then raise exception using errcode='22023',message='DOCTOR_GRANTS_INVALID'; end if;
  seen:=array_append(seen,location); result:=result||jsonb_build_array(jsonb_build_object('location_id',location,'capabilities',capabilities));
 end loop;
 return (select jsonb_agg(value order by value->>'location_id') from jsonb_array_elements(result));
end $$;
create function doctor_private.audit_event_locations(p_event public.audit_events) returns uuid[]
language sql immutable security invoker set search_path='' as $$
 select coalesce(array_agg(distinct value)filter(where value is not null),'{}'::uuid[]) from (
 select case when token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then token::uuid end value
 from unnest(array[(p_event).details->>'location_id',(p_event).details->>'from_location_id',(p_event).details->>'to_location_id',
 case when (p_event).event_type like 'location.%'or (p_event).event_type='availability.updated'then (p_event).entity_id::text end])token)candidates
$$;
create function doctor_private.audit_event_visible(p_event public.audit_events,p_location uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare places uuid[]:=doctor_private.audit_event_locations(p_event); place uuid;
begin
 if doctor_private.is_owner(p_event.practice_id)then return p_location is null or p_location=any(places);end if;
 if p_location is null or not(p_location=any(places))then return false;end if;
 -- Practice-wide ownership/invitation/grant events stay owner-only. Every clinic
 -- represented by a cross-clinic event must independently admit this reader.
 foreach place in array places loop
  if not doctor_private.has_access(p_event.practice_id,'audit.read',place)then return false;end if;
  if p_event.event_type like 'patient.%'and not doctor_private.has_access(p_event.practice_id,'patients.read',place)then return false;end if;
  if p_event.event_type like 'document.%'and not(doctor_private.has_access(p_event.practice_id,'documents.read',place)and doctor_private.has_access(p_event.practice_id,'patients.read',place))then return false;end if;
  if p_event.event_type like 'appointment.%'and not doctor_private.has_access(p_event.practice_id,'appointments.read',place)then return false;end if;
  if p_event.event_type like 'location.%'and not doctor_private.has_access(p_event.practice_id,'locations.read',place)then return false;end if;
  if p_event.event_type='availability.updated'and not(doctor_private.has_access(p_event.practice_id,'availability.manage',place)or doctor_private.has_access(p_event.practice_id,'appointments.read',place))then return false;end if;
 end loop;
 return p_event.event_type like 'patient.%'or p_event.event_type like 'document.%'or p_event.event_type like 'appointment.%'or p_event.event_type like 'location.%'or p_event.event_type='availability.updated';
end $$;
create function doctor_private.administrative_audit(p_practice uuid,p_location uuid,p_query text,p_page integer)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); result jsonb; needle text;
begin
 if p_page is null or p_page not between 0 and 100000 or p_query is null or length(p_query)>120 or p_query ~ '[[:cntrl:]]'then raise exception using errcode='22023',message='DOCTOR_AUDIT_QUERY_INVALID';end if;
 if not doctor_private.is_owner(p_practice)then
  if p_location is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  perform doctor_private.require_access(p_practice,'audit.read',p_location);
  if not exists(select 1 from public.locations where id=p_location and practice_id=p_practice and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 if p_location is not null and not exists(select 1 from public.locations where id=p_location and practice_id=p_practice)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 needle:=lower(btrim(p_query));
 with visible as materialized(
  select id,actor_user_id,event_type,entity_id,happened_at from public.audit_events e
  where e.practice_id=p_practice and e.event_type=any(array['practice.created','practice.profile_updated','location.created','location.updated','location.archived','secretary.invited','secretary.accepted','secretary.invitation_cancelled','secretary.grants_changed','secretary.status_changed','patient.created','patient.corrected','patient.archived','document.uploaded','document.replaced','document.archived','document.download_requested','availability.updated','appointment.booked','appointment.checked_in','appointment.cancelled','appointment.no_show','appointment.in_progress','appointment.completed','appointment.rescheduled']) and doctor_private.audit_event_visible(e,p_location)
   and(needle=''or strpos(lower(e.event_type||' '||e.actor_user_id::text||' '||e.entity_id::text||' '||e.id::text),needle)>0)
 ),page as(select * from visible order by happened_at desc,id desc limit 20 offset p_page*20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('id',page.id::text)order by happened_at desc,id desc)from page),'[]'::jsonb),'total',(select count(*)from visible),'page',p_page)into result;
 return result;
end $$;
create function doctor_private.personal_account_audit(p_query text,p_page integer)returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); result jsonb; needle text;
begin
 if p_page is null or p_page not between 0 and 100000 or p_query is null or length(p_query)>120 or p_query ~ '[[:cntrl:]]'then raise exception using errcode='22023',message='DOCTOR_AUDIT_QUERY_INVALID';end if;
 needle:=lower(btrim(p_query));
 with visible as materialized(
  select id,actor_user_id,'account.settings_updated'::text event_type,actor_user_id entity_id,happened_at
  from doctor_private.account_events where actor_user_id=actor
   and(needle=''or strpos(lower('account.settings_updated '||actor_user_id::text||' '||id::text),needle)>0)
 ),page as(select * from visible order by happened_at desc,id desc limit 20 offset p_page*20)
 select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('id',page.id::text)order by happened_at desc,id desc)from page),'[]'::jsonb),'total',(select count(*)from visible),'page',p_page)into result;
 return result;
end $$;
revoke all on function doctor_private.audit_event_locations(public.audit_events),doctor_private.audit_event_visible(public.audit_events,uuid),doctor_private.administrative_audit(uuid,uuid,text,integer),doctor_private.personal_account_audit(text,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.administrative_audit(uuid,uuid,text,integer),doctor_private.personal_account_audit(text,integer)to authenticated;
create function public.doctor_administrative_audit(p_practice uuid,p_location uuid default null,p_query text default '',p_page integer default 0)returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.administrative_audit(p_practice,p_location,p_query,p_page)$$;
create function public.doctor_personal_account_audit(p_query text default '',p_page integer default 0)returns jsonb
language sql stable security invoker set search_path='' as $$select doctor_private.personal_account_audit(p_query,p_page)$$;
revoke all on function public.doctor_administrative_audit(uuid,uuid,text,integer),public.doctor_personal_account_audit(text,integer)from public,anon,service_role;
grant execute on function public.doctor_administrative_audit(uuid,uuid,text,integer),public.doctor_personal_account_audit(text,integer)to authenticated;
-- Raw audit RLS remains owner-only; this does not grant delegated raw payload access.
-- Client UPDATE/DELETE remain denied. Linked histories and archival blockers remain intact.

create policy audit_owner_guard on public.audit_events as restrictive for select to authenticated using(doctor_private.is_owner(practice_id));
create policy audit_no_client_insert on public.audit_events as restrictive for insert to authenticated with check(false);
create policy audit_no_client_update on public.audit_events as restrictive for update to authenticated using(false)with check(false);
create policy audit_no_client_delete on public.audit_events as restrictive for delete to authenticated using(false);
