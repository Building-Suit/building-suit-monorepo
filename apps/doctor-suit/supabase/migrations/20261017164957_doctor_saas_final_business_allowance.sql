-- Keep identity/period checks before each write. Allowance checks must inspect
-- the final transaction: invitation acceptance inserts a member and location
-- grants before consuming its already reserved invitation seat.
create or replace function doctor_private.saas_owner_business_state(p_subscriber uuid,p_lock boolean,p_allocation boolean)returns jsonb
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
 -- p_lock is true only in the deferred physical guard. No transient count is
 -- used as policy authority, and no quota/over-limit exemption is introduced.
 if not p_lock then return state;end if;
 select id into practice from public.practices where owner_user_id=p_subscriber;
 usage:=doctor_private.saas_usage(practice);staff:=state->'terms'->'staff';clinics:=state->'terms'->'clinics';policy:=state#>>'{terms,over_limit_policy}';
 if(staff->>'kind')not in('limited','unlimited')or(staff->>'kind')is null
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
revoke all on function doctor_private.saas_owner_business_state(uuid,boolean,boolean)from public,anon,authenticated,service_role;
