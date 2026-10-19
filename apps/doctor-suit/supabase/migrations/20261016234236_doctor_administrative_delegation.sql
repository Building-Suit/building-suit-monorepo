-- DOS-M1-010. Explicit administrative grants; ownership and clinical authority are not delegable.
create function doctor_private.set_membership_grants(p_practice uuid,p_membership uuid,p_version integer,p_grants jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); item public.memberships; grants jsonb; previous jsonb; approved_caps text[];
 request jsonb:=jsonb_build_object('command','membership.grants','practice',p_practice,'membership',p_membership,'version',p_version,'grants',p_grants); result jsonb;
begin
 result:=doctor_private.owner_command(p_practice,p_key,request); if result is not null then return result; end if;
 select * into item from public.memberships where id=p_membership and practice_id=p_practice for update;
 if not found or item.user_id=actor then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED'; end if;
 if item.version is distinct from p_version then raise exception using errcode='40001',message='DOCTOR_MEMBERSHIP_CONFLICT'; end if;
 -- An explicit empty set removes every location grant without changing another membership.
 if p_grants='[]'::jsonb then grants:='[]'; else grants:=doctor_private.validate_grants(p_practice,p_grants,true); end if;
 select coalesce(jsonb_agg(jsonb_build_object('location_id',location_id,'capabilities',coalesce(ml.capabilities,item.capabilities)) order by location_id),'[]') into previous
  from public.membership_locations ml where membership_id=item.id and practice_id=p_practice;
 select coalesce(array_agg(distinct c.value order by c.value),'{}') into approved_caps
  from jsonb_array_elements(grants)g cross join lateral jsonb_array_elements_text(g.value->'capabilities')c;
 update public.memberships set capabilities=approved_caps,version=version+1 where id=item.id returning version into item.version;
 delete from public.membership_locations where membership_id=item.id and practice_id=p_practice;
 insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)
  select p_practice,item.id,(g.value->>'location_id')::uuid,array(select jsonb_array_elements_text(g.value->'capabilities')) from jsonb_array_elements(grants)g;
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
  values(p_practice,actor,'secretary.grants_changed',item.id,jsonb_build_object('before',previous,'after',grants));
 result:=jsonb_build_object('membership_id',item.id,'version',item.version);
 insert into doctor_private.command_receipts values(actor,p_key,request,result); return result;
end $$;
create function public.doctor_set_membership_grants(p_practice uuid,p_membership uuid,p_version integer,p_grants jsonb,p_key uuid) returns jsonb
language sql security invoker set search_path='' as $$select doctor_private.set_membership_grants(p_practice,p_membership,p_version,p_grants,p_key)$$;
create function public.doctor_administrative_capabilities() returns text[]
language plpgsql stable security definer set search_path='' as $$begin perform doctor_private.current_actor(); return doctor_private.administrative_capabilities(); end$$;
revoke all on function doctor_private.set_membership_grants(uuid,uuid,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function doctor_private.set_membership_grants(uuid,uuid,integer,jsonb,uuid) to authenticated;
revoke all on function public.doctor_set_membership_grants(uuid,uuid,integer,jsonb,uuid),public.doctor_administrative_capabilities() from public,anon,authenticated;
grant execute on function public.doctor_set_membership_grants(uuid,uuid,integer,jsonb,uuid),public.doctor_administrative_capabilities() to authenticated;
