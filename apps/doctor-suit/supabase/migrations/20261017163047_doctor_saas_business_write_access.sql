-- DOS-AE-003: administrative writes require current owner-bound authority.
-- Historical reads, personal account settings and security reductions remain.
create function doctor_private.saas_owner_business_state(p_subscriber uuid,p_lock boolean,p_allocation boolean)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare state jsonb;usage jsonb;practice uuid;staff jsonb;clinics jsonb;over_staff boolean;over_clinics boolean;policy text;
begin
 if p_subscriber is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if current_setting('transaction_isolation')<>'read committed'then
  raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 if p_lock then perform doctor_private.saas_lock_subscriber(p_subscriber);end if;
 perform doctor_private.current_actor();
 state:=doctor_private.saas_account_state(p_subscriber);
 if(state->>'period_active')is distinct from'true'then raise exception using errcode='DS006',message='DOCTOR_SAAS_PERIOD_INACTIVE';end if;
 select id into practice from public.practices where owner_user_id=p_subscriber;
 usage:=doctor_private.saas_usage(practice);staff:=state->'terms'->'staff';clinics:=state->'terms'->'clinics';policy:=state#>>'{terms,over_limit_policy}';
 if (staff->>'kind')not in('limited','unlimited')or(staff->>'kind')is null
  or(clinics->>'kind')not in('limited','unlimited')or(clinics->>'kind')is null
  or policy not in('block_new_allocation','read_only_until_within_limit')or policy is null then
  raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 over_staff:=staff->>'kind'='limited'and(usage->>'staff_total')::bigint>(staff->>'limit')::bigint;
 over_clinics:=clinics->>'kind'='limited'and(usage->>'clinics')::bigint>(clinics->>'limit')::bigint;
 if p_allocation and(over_staff or over_clinics)then
  if over_staff then raise exception using errcode='DS002',message='DOCTOR_SAAS_STAFF_LIMIT';
  else raise exception using errcode='DS003',message='DOCTOR_SAAS_CLINIC_LIMIT';end if;
 end if;
 if(over_staff or over_clinics)and policy='read_only_until_within_limit'then
  raise exception using errcode='DS007',message='DOCTOR_SAAS_OVER_LIMIT_READ_ONLY';end if;
 return state||jsonb_build_object('usage',usage,'over_limit',over_staff or over_clinics);
end $$;
create function doctor_private.saas_business_access(p_practice uuid,p_lock boolean,p_allocation boolean)returns void
language plpgsql volatile security definer set search_path=''as $$
declare subscriber uuid;
begin
 select owner_user_id into subscriber from public.practices where id=p_practice;
 perform doctor_private.saas_owner_business_state(subscriber,p_lock,p_allocation);
end $$;

create function doctor_private.saas_business_guard()returns trigger
language plpgsql volatile security definer set search_path=''as $$
declare item jsonb;practice uuid;subscriber uuid;allocation boolean:=false;old_caps text[];new_caps text[];parent_caps text[];
begin
 if doctor_private.edition_mode()='synthetic_preview'then
  if tg_op='DELETE'then return old;else return new;end if;
 end if;
 item:=case when tg_op='DELETE'then to_jsonb(old)else to_jsonb(new)end;
 if tg_op='UPDATE'then
  if item->'id'is distinct from to_jsonb(old)->'id'then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
 end if;
 if tg_table_name='patient_identities'then
  if tg_op<>'INSERT'then raise exception using errcode='42501',message='DOCTOR_PATIENT_IDENTITY_IMMUTABLE';end if;
  if tg_when='BEFORE'then perform doctor_private.current_actor();return new;end if;
  select practice_id into practice from public.practice_patients where patient_identity_id=new.id;
  if practice is null then raise exception using errcode='42501',message='DOCTOR_PATIENT_LINK_REQUIRED';end if;
 elsif tg_table_name='doctor_profiles'then
  subscriber:=(item->>'user_id')::uuid;
  if tg_op='UPDATE'and new.user_id is distinct from old.user_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
 elsif tg_table_name='practices'then
  subscriber:=(item->>'owner_user_id')::uuid;
  if tg_op='UPDATE'and new.owner_user_id is distinct from old.owner_user_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
 else
  practice:=(item->>'practice_id')::uuid;
  if tg_op='UPDATE'and new.practice_id is distinct from old.practice_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
  if tg_table_name='location_schedules'and tg_op='UPDATE'then
   if new.location_id is distinct from old.location_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
  end if;
  if tg_table_name='locations'then
   if tg_op='UPDATE'and new.archived_at is not null and(old.archived_at is null or new.archived_at is not distinct from old.archived_at)
    and(to_jsonb(new)-array['archived_at','version'])=(to_jsonb(old)-array['archived_at','version'])then return new;end if;
   allocation:=tg_op='INSERT';
   if tg_op='UPDATE'then allocation:=old.archived_at is not null and new.archived_at is null;end if;
  elsif tg_table_name='memberships'then
   if tg_op='DELETE'then return old;end if;
   if tg_op='UPDATE'then
    if new.user_id is distinct from old.user_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
    if new.capabilities<@old.capabilities and(new.status<>'active'or old.status='active')then return new;end if;
   end if;
   allocation:=new.status='active';
  elsif tg_table_name='membership_locations'then
   if tg_op='DELETE'then return old;end if;
   if tg_op='UPDATE'then
    if new.membership_id is distinct from old.membership_id or new.location_id is distinct from old.location_id then raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
    select capabilities into parent_caps from public.memberships where id=new.membership_id and practice_id=new.practice_id;
    old_caps:=coalesce(old.capabilities,parent_caps);new_caps:=coalesce(new.capabilities,parent_caps);
    if new_caps<@old_caps then return new;end if;
   end if;
  elsif tg_table_name='secretary_invitations'then
   if tg_op='DELETE'then return old;end if;
   if tg_op='UPDATE'and new.status in('accepted','cancelled','expired')and
    (to_jsonb(new)-array['status','version','accepted_user_id','accepted_membership_id'])=(to_jsonb(old)-array['status','version','accepted_user_id','accepted_membership_id'])then return new;end if;
   allocation:=new.status='pending';
  end if;
 end if;
 -- Deferred allocation events whose final row was removed/reduced have no
 -- remaining authority to grant. Ordinary edits/deletes still need authority.
 if tg_when='AFTER'and allocation then
  if tg_table_name='locations'and not exists(select 1 from public.locations where id=new.id and archived_at is null)then return new;end if;
  if tg_table_name='memberships'and not exists(select 1 from public.memberships where id=new.id and status='active')then return new;end if;
  if tg_table_name='secretary_invitations'and not exists(select 1 from public.secretary_invitations where id=new.id and status='pending'and expires_at>clock_timestamp())then return new;end if;
 end if;
 if subscriber is not null then perform doctor_private.saas_owner_business_state(subscriber,tg_when='AFTER',allocation);
 else perform doctor_private.saas_business_access(practice,tg_when='AFTER',allocation);end if;
 if tg_op='DELETE'then return old;else return new;end if;
end $$;
do $$declare target text;begin
 foreach target in array array['doctor_profiles','practices','locations','memberships','membership_locations','secretary_invitations','patient_identities','practice_patients','location_schedules','appointments']loop
  execute format('create trigger %I before insert or update or delete on public.%I for each row when(doctor_private.edition_mode()<>''synthetic_preview'')execute function doctor_private.saas_business_guard()','doctor_saas_business_'||target||'_before',target);
  execute format('create constraint trigger %I after insert or update or delete on public.%I deferrable initially deferred for each row when(doctor_private.edition_mode()<>''synthetic_preview'')execute function doctor_private.saas_business_guard()','doctor_saas_business_'||target||'_final',target);
 end loop;
end $$;
revoke all on function doctor_private.saas_owner_business_state(uuid,boolean,boolean),doctor_private.saas_business_access(uuid,boolean,boolean),doctor_private.saas_business_guard()from public,anon,authenticated,service_role;

-- Apply only changed grants. A security reduction must not delete/reinsert
-- unchanged rows and accidentally require a new paid permission allocation.
create or replace function doctor_private.set_membership_grants(p_practice uuid,p_membership uuid,p_version integer,p_grants jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();item public.memberships;grants jsonb;previous jsonb;approved_caps text[];
 request jsonb:=jsonb_build_object('command','membership.grants','practice',p_practice,'membership',p_membership,'version',p_version,'grants',p_grants);result jsonb;
begin
 result:=doctor_private.owner_command(p_practice,p_key,request);if result is not null then return result;end if;
 select * into item from public.memberships where id=p_membership and practice_id=p_practice for update;
 if not found or item.user_id=actor then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if item.version is distinct from p_version then raise exception using errcode='40001',message='DOCTOR_MEMBERSHIP_CONFLICT';end if;
 if p_grants='[]'::jsonb then grants:='[]';else grants:=doctor_private.validate_grants(p_practice,p_grants,true);end if;
 select coalesce(jsonb_agg(jsonb_build_object('location_id',location_id,'capabilities',coalesce(ml.capabilities,item.capabilities))order by location_id),'[]')into previous
  from public.membership_locations ml where membership_id=item.id and practice_id=p_practice;
 select coalesce(array_agg(distinct c.value order by c.value),'{}')into approved_caps
  from jsonb_array_elements(grants)g cross join lateral jsonb_array_elements_text(g.value->'capabilities')c;
 update public.memberships set capabilities=approved_caps,version=version+1 where id=item.id returning version into item.version;
 delete from public.membership_locations ml where ml.membership_id=item.id and ml.practice_id=p_practice
  and not exists(select 1 from jsonb_array_elements(grants)g where(g.value->>'location_id')::uuid=ml.location_id);
 update public.membership_locations ml set capabilities=array(select jsonb_array_elements_text(g.value->'capabilities'))
  from jsonb_array_elements(grants)g where ml.practice_id=p_practice and ml.membership_id=item.id and ml.location_id=(g.value->>'location_id')::uuid
   and ml.capabilities is distinct from array(select jsonb_array_elements_text(g.value->'capabilities'));
 insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)
  select p_practice,item.id,(g.value->>'location_id')::uuid,array(select jsonb_array_elements_text(g.value->'capabilities'))from jsonb_array_elements(grants)g
   where not exists(select 1 from public.membership_locations ml where ml.practice_id=p_practice and ml.membership_id=item.id and ml.location_id=(g.value->>'location_id')::uuid);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)
  values(p_practice,actor,'secretary.grants_changed',item.id,jsonb_build_object('before',previous,'after',grants));
 result:=jsonb_build_object('membership_id',item.id,'version',item.version);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
end $$;
