-- DOS-AE-003: minimal practice-owner entitlement metadata, without billing data.
create function doctor_private.saas_entitlement_context(p_practice uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare subscriber uuid;state jsonb;usage jsonb;staff jsonb;clinics jsonb;selected text;moment timestamptz;ending timestamptz;
 active boolean;over_limit boolean:=false;writable boolean:=false;staff_room boolean:=false;clinic_room boolean:=false;policy text;
begin
 select owner_user_id into subscriber from public.practices where id=p_practice;
 if subscriber is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if doctor_private.edition_mode()='synthetic_preview'then
  return jsonb_build_object('state','preview','revision',0,'writes_allowed',true,'can_add_staff',true,'can_add_clinic',true,'over_limit',false,'valid_until',null,'observed_at',clock_timestamp());end if;
 state:=doctor_private.saas_account_state(subscriber);selected:=state->>'state';ending:=(state#>>'{period,ends_at}')::timestamptz;moment:=clock_timestamp();
 -- Derive clock state and observation from the same instant, even at expiry.
 if selected in('trial','scheduled','expired')then
  selected:=case when moment<(state#>>'{period,started_at}')::timestamptz then'scheduled'when moment>=ending then'expired'else'trial'end;
 end if;
 active:=selected='trial';
 if selected<>'unconfigured'then
  usage:=doctor_private.saas_usage(p_practice);staff:=state->'terms'->'staff';clinics:=state->'terms'->'clinics';policy:=state#>>'{terms,over_limit_policy}';
  if(staff->>'kind')not in('limited','unlimited')or(staff->>'kind')is null or(clinics->>'kind')not in('limited','unlimited')or(clinics->>'kind')is null
   or policy not in('block_new_allocation','read_only_until_within_limit')or policy is null then raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
  over_limit:=(staff->>'kind'='limited'and(usage->>'staff_total')::bigint>(staff->>'limit')::bigint)
   or(clinics->>'kind'='limited'and(usage->>'clinics')::bigint>(clinics->>'limit')::bigint);
  writable:=active and(not over_limit or policy='block_new_allocation');
  staff_room:=active and not over_limit and(staff->>'kind'='unlimited'or(usage->>'staff_total')::bigint<(staff->>'limit')::bigint);
  clinic_room:=active and not over_limit and(clinics->>'kind'='unlimited'or(usage->>'clinics')::bigint<(clinics->>'limit')::bigint);
 end if;
 return jsonb_build_object('state',selected,'revision',(state->>'revision')::integer,'writes_allowed',writable,'can_add_staff',staff_room,'can_add_clinic',clinic_room,
  'over_limit',over_limit,'valid_until',ending,'observed_at',moment);
end $$;
revoke all on function doctor_private.saas_entitlement_context(uuid)from public,anon,authenticated,service_role;

create or replace function doctor_private.contexts()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();result jsonb;
begin
 with admitted as materialized(
  select p.id as practice_id,p.name as practice_name,d.display_name as doctor_name,l.id as location_id,l.name as location_name,l.timezone,
   case when p.owner_user_id=actor then'doctor'else'secretary'end as portal,
   case when p.owner_user_id=actor then p.version else m.version end as grants_version,l.version as location_version,
   doctor_private.edition_filter_capabilities(case when p.owner_user_id=actor then doctor_private.administrative_capabilities()else coalesce(ml.capabilities,m.capabilities)end)as capabilities
  from public.practices p join public.doctor_profiles d on d.user_id=p.owner_user_id join public.locations l on l.practice_id=p.id and l.archived_at is null
  left join public.memberships m on m.practice_id=p.id and m.user_id=actor and m.status='active'
  left join public.membership_locations ml on ml.practice_id=p.id and ml.membership_id=m.id and ml.location_id=l.id
  where p.owner_user_id=actor or(ml.membership_id is not null and cardinality(doctor_private.edition_filter_capabilities(coalesce(ml.capabilities,m.capabilities)))>0)
 ),practices as(select distinct practice_id from admitted),entitlements as materialized(
  select practice_id,doctor_private.saas_entitlement_context(practice_id)as entitlement from practices
 )select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('edition',doctor_private.edition_mode(),
  'edition_revision',(select revision from public.doctor_edition_policy where singleton),'entitlement',e.entitlement)
  order by a.practice_name,a.practice_id,a.location_name,a.location_id),'[]'::jsonb)into result
 from admitted a join entitlements e using(practice_id);
 return result;
end $$;
