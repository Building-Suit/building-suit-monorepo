-- DOS-M2-012: bound recipient picker with explicit immutable account identity.
create or replace function doctor_private.clinical_detail(p_practice uuid,p_location uuid,p_encounter uuid,p_page integer) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare encounter public.clinical_encounters; versions jsonb; events jsonb; releases jsonb; recipients jsonb; total bigint; event_total bigint; recipient_total bigint;
begin
 perform pg_advisory_xact_lock_shared(hashtextextended(p_practice::text,1));
 perform doctor_private.clinical_scope(p_practice,p_location,'read');
 if p_page is null or p_page not between 0 and 10000 then raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 select * into encounter from public.clinical_encounters where practice_id=p_practice and location_id=p_location and id=p_encounter;
 if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select count(*) into total from public.clinical_versions where encounter_id=encounter.id;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into versions from (select id,revision,kind,source_version_id,snapshot,snapshot::text as canonical_snapshot,snapshot_sha256,reason,actor_user_id,happened_at,
  case when id=encounter.active_version_id then 'active' when kind='finalized' then case when encounter.status='withdrawn' then 'withdrawn' else 'superseded' end else 'draft' end as version_status,
  true as synthetic_attestation,false as professional_signature
  from public.clinical_versions where encounter_id=encounter.id order by revision desc limit 20 offset p_page::bigint*20) r;
 select count(*) into event_total from public.clinical_events where encounter_id=encounter.id;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into events from (select id,version_id,action,actor_user_id,happened_at from public.clinical_events where encounter_id=encounter.id order by id desc limit 100) r;
 select coalesce(jsonb_agg(to_jsonb(r)),'[]') into releases from (select r.id,r.version_id,r.recipient_user_id,r.released_at,r.expires_at,
  (x.release_id is not null or r.version_id is distinct from encounter.active_version_id or r.expires_at<=clock_timestamp()) as unavailable
  from public.clinical_releases r left join public.clinical_release_revocations x on x.release_id=r.id where r.encounter_id=encounter.id order by r.released_at desc,r.id limit 100) r;
 with allowed as materialized (
  select g.user_id,p.display_name||' · '||g.user_id::text as name,row_number() over(order by g.user_id) as ordinal
  from doctor_private.clinical_recipient_grants g join public.practice_patients p on p.practice_id=g.practice_id and p.id=g.patient_id join auth.users u on u.id=g.user_id
  where g.practice_id=p_practice and g.patient_id=encounter.patient_id and g.revoked_at is null and g.valid_until>clock_timestamp()
   and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 ) select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',name) order by user_id) filter(where ordinal<=100),'[]'),count(*) into recipients,recipient_total from allowed;
 return jsonb_build_object('encounter',to_jsonb(encounter),'versions',versions,'versions_total',total,'events',events,'events_total',event_total,'releases',releases,'recipients',recipients,'recipients_total',recipient_total,'recipient_limit',100,
  'data_mode','synthetic','clinical_approval',false,'live_prescribing',false);
end $$;
