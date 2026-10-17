-- Owner-only subscription/onboarding presentation. No payment route or live activation.
create or replace function doctor_private.saas_status()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();practice uuid;state jsonb;moment timestamptz;kind text;writable boolean:=false;
begin
 if not exists(select 1 from public.doctor_saas_accounts where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 select id into practice from public.practices where owner_user_id=actor;
 state:=doctor_private.saas_account_state(actor);moment:=clock_timestamp();kind:=state->>'state';
 if kind in('trial','expired','scheduled')then
  kind:=case when moment<(state#>>'{period,started_at}')::timestamptz then'scheduled'when moment>=(state#>>'{period,ends_at}')::timestamptz then'expired'else'trial'end;
 end if;
 if kind='trial'then
  if practice is not null then writable:=(doctor_private.saas_entitlement_context(practice)->>'writes_allowed')::boolean;
  else writable:=state#>>'{terms,clinics,kind}'='unlimited'or(state#>>'{terms,clinics,limit}')::integer>0;end if;
 end if;
 return state||jsonb_build_object('business_writes_allowed',writable,'state',kind,'period_active',kind='trial','observed_at',moment,'subscriber_user_id',actor,'practice_id',practice,'usage',doctor_private.saas_usage(practice),
  'data_mode','synthetic','paid_activation_available',false,'live_activation',false);
end $$;

create or replace function doctor_private.practice_setup() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=doctor_private.current_actor(); practice public.practices; location public.locations;
  profile public.doctor_profiles; draft public.onboarding_drafts; owner boolean; required boolean:=false; state jsonb;
begin
  select * into practice from public.practices where owner_user_id=actor;
  select * into profile from public.doctor_profiles where user_id=actor;
  select * into location from public.locations where practice_id=practice.id and archived_at is null order by created_at,id limit 1;
  select * into draft from public.onboarding_drafts where user_id=actor;
  owner:=practice.id is not null or not exists(select 1 from public.memberships where user_id=actor);
  if owner and doctor_private.edition_mode()='administrative_candidate'then
    if practice.id is not null then required:=not(doctor_private.saas_entitlement_context(practice.id)->>'writes_allowed')::boolean;
    else
      state:=doctor_private.saas_account_state(actor);
      required:=(state->>'period_active')is distinct from'true' or(state#>>'{terms,clinics,kind}'='limited'and(state#>>'{terms,clinics,limit}')::integer<1);
    end if;
  end if;
  return jsonb_build_object('edition',doctor_private.edition_mode(),'subscription_required',required,
    'enrollment',case when practice.id is not null or not exists(select 1 from public.memberships where user_id=actor) then 'owner' else 'delegated-only' end,
    'profile',case when profile.user_id is null then null else jsonb_build_object('display_name',profile.display_name,'professional_verification',profile.professional_verification) end,
    'practice',case when practice.id is null then null else jsonb_build_object('id',practice.id,'name',practice.name,'version',practice.version) end,
    'location',case when location.id is null then null else jsonb_build_object('id',location.id,'name',location.name,'timezone',location.timezone,'version',location.version) end,
    'draft',case when draft.user_id is null then null else jsonb_build_object('command_key',draft.command_key,'display_name',draft.display_name,'practice_name',draft.practice_name,'location_name',draft.location_name,'timezone',draft.timezone,'version',draft.version) end
  );
end $$;
