-- DOS-AE-003: quotas use the practice owner's bound immutable terms.
-- No plan, account, approval or live admission is created by this migration.
create index doctor_saas_active_clinics on public.locations(practice_id)where archived_at is null;
create index doctor_saas_active_staff on public.memberships(practice_id)where status='active';
create index doctor_saas_pending_staff on public.secretary_invitations(practice_id,expires_at)where status='pending';

create function doctor_private.saas_usage(p_practice uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare clinics bigint;members bigint;invitations bigint;moment timestamptz:=clock_timestamp();
begin
 select count(*)into clinics from public.locations where practice_id=p_practice and archived_at is null;
 select count(*)into members from public.memberships where practice_id=p_practice and status='active';
 select count(*)into invitations from public.secretary_invitations where practice_id=p_practice and status='pending'and expires_at>moment;
 return jsonb_build_object('clinics',clinics,'staff_members',members,'staff_invitations',invitations,'staff_total',members+invitations);
end $$;
create function doctor_private.saas_allocation_state(p_practice uuid,p_lock boolean)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare subscriber uuid;state jsonb;
begin
 -- A repeatable snapshot cannot refresh the count after a competing commit.
 if current_setting('transaction_isolation')<>'read committed'then
  raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 select owner_user_id into subscriber from public.practices where id=p_practice;
 if subscriber is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if p_lock then perform doctor_private.saas_lock_subscriber(subscriber);end if;
 -- Recheck provider identity/session/admission and the clock after any wait.
 perform doctor_private.current_actor();
 state:=doctor_private.saas_account_state(subscriber);
 if(state->>'period_active')is distinct from'true'then
  raise exception using errcode='DS006',message='DOCTOR_SAAS_PERIOD_INACTIVE';end if;
 return state;
end $$;

-- Use one trigger function for both the early check and the deferred final
-- check. Only increases need subscription authority; reductions stay usable.
create function doctor_private.saas_allocation_guard()returns trigger
language plpgsql volatile security definer set search_path=''as $$
declare increasing boolean:=false;still_allocated boolean;state jsonb;quota jsonb;usage jsonb;kind text;counted bigint;
begin
 if doctor_private.edition_mode()='synthetic_preview'then return new;end if;
 if tg_op='UPDATE'and new.practice_id is distinct from old.practice_id then
  raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_SCOPE_IMMUTABLE';end if;
 if tg_table_name='locations'then
  kind:='clinics';
  if tg_op='INSERT'then increasing:=true;else increasing:=old.archived_at is not null and new.archived_at is null;end if;
 elsif tg_table_name='memberships'then
  kind:='staff';
  if tg_op='INSERT'then increasing:=new.status='active';else increasing:=new.status='active'and old.status<>'active';end if;
 elsif tg_table_name='secretary_invitations'then
  kind:='staff';
  if tg_op='INSERT'then increasing:=new.status='pending';else increasing:=new.status='pending'and(old.status<>'pending'or new.expires_at>old.expires_at);end if;
 else raise exception using errcode='42501',message='DOCTOR_SAAS_ALLOCATION_UNAVAILABLE';end if;
 if not increasing then return new;end if;
 if tg_when='BEFORE'then perform doctor_private.saas_allocation_state(new.practice_id,false);return new;end if;
 -- Inspect the final row: insert-then-revoke/delete must remain a reduction.
 if tg_table_name='locations'then
  select archived_at is null into still_allocated from public.locations where id=new.id and practice_id=new.practice_id;
 elsif tg_table_name='memberships'then
  select status='active'into still_allocated from public.memberships where id=new.id and practice_id=new.practice_id;
 else
  select status='pending'and expires_at>clock_timestamp()into still_allocated from public.secretary_invitations where id=new.id and practice_id=new.practice_id;
 end if;
 if still_allocated is distinct from true then return new;end if;
 -- Acquire the subscriber lock only at the final check. No domain/FK row
 -- locks or writes follow it. Concurrent allocators then count fresh commits.
 state:=doctor_private.saas_allocation_state(new.practice_id,true);
 quota:=state->'terms'->kind;
 if quota->>'kind'='unlimited'then return new;end if;
 if quota->>'kind'is distinct from'limited'or jsonb_typeof(quota->'limit')is distinct from'number'or (quota->>'limit')::numeric<0 then
  raise exception using errcode='DS001',message='DOCTOR_SAAS_TERMS_UNCONFIGURED';end if;
 usage:=doctor_private.saas_usage(new.practice_id);
 counted:=(usage->>(case when kind='clinics'then'clinics'else'staff_total'end))::bigint;
 if counted>(quota->>'limit')::bigint then
  if kind='staff'then raise exception using errcode='DS002',message='DOCTOR_SAAS_STAFF_LIMIT';
  else raise exception using errcode='DS003',message='DOCTOR_SAAS_CLINIC_LIMIT';end if;
 end if;
 return new;
end $$;
create trigger doctor_saas_clinics_before before insert or update on public.locations
 for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();
create trigger doctor_saas_members_before before insert or update on public.memberships
 for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();
create trigger doctor_saas_invitations_before before insert or update on public.secretary_invitations
 for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();
-- WHEN is evaluated when each event is queued, including fixture preview mode.
create constraint trigger doctor_saas_clinics_final after insert or update on public.locations
 deferrable initially deferred for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();
create constraint trigger doctor_saas_members_final after insert or update on public.memberships
 deferrable initially deferred for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();
create constraint trigger doctor_saas_invitations_final after insert or update on public.secretary_invitations
 deferrable initially deferred for each row when(doctor_private.edition_mode()<>'synthetic_preview')execute function doctor_private.saas_allocation_guard();

create or replace function doctor_private.saas_status()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();practice uuid;
begin
 if not exists(select 1 from public.doctor_saas_accounts where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 select id into practice from public.practices where owner_user_id=actor;
 return doctor_private.saas_account_state(actor)||jsonb_build_object('subscriber_user_id',actor,'practice_id',practice,'usage',doctor_private.saas_usage(practice),
  'data_mode','synthetic','paid_activation_available',false,'live_activation',false);
end $$;
revoke all on function doctor_private.saas_usage(uuid),doctor_private.saas_allocation_state(uuid,boolean),doctor_private.saas_allocation_guard()from public,anon,authenticated,service_role;
