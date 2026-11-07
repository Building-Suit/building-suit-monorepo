-- DOS-M2-009: fresh issuer account/ownership checks for synthetic delivery.
create or replace function doctor_private.clinical_released(p_release uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=doctor_private.clinical_actor(); r public.clinical_releases; e public.clinical_encounters; v public.clinical_versions; results jsonb; orders jsonb; documents jsonb; signer_until timestamptz; recipient_until timestamptz;
begin
 if doctor_private.edition_mode()<>'synthetic_preview' then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select * into r from public.clinical_releases where id=p_release and recipient_user_id=actor and expires_at>clock_timestamp();
 if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(r.practice_id::text,1));
 actor:=doctor_private.clinical_actor();
 if doctor_private.edition_mode()<>'synthetic_preview' then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select * into r from public.clinical_releases where id=p_release and recipient_user_id=actor and expires_at>clock_timestamp();
 if not found or exists(select 1 from public.clinical_release_revocations where release_id=p_release) then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 if not exists(select 1 from doctor_private.clinical_recipient_grants g where g.practice_id=r.practice_id and g.patient_id=r.recipient_patient_id and g.user_id=actor
  and g.purpose='synthetic_fixture' and g.revoked_at is null and g.valid_until>clock_timestamp()) then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select * into e from public.clinical_encounters where id=r.encounter_id and active_version_id=r.version_id and status='finalized';
 if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 -- Fixture delivery also ends when its issuing responsible account is disabled or ownership changes.
 if not exists(select 1 from public.practices p join auth.users u on u.id=p.owner_user_id
  where p.id=e.practice_id and p.owner_user_id=e.responsible_doctor and r.released_by=e.responsible_doctor
   and u.deleted_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
   and (u.banned_until is null or u.banned_until<=clock_timestamp())) then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 -- A withdrawn fixture signer or administrative edition cannot sustain sharing.
 if not exists(select 1 from doctor_private.clinical_fixture_grants g where g.practice_id=e.practice_id and g.location_id=e.location_id and g.user_id=r.released_by
  and 'release'=any(g.capabilities) and g.revoked_at is null and g.issued_at<=clock_timestamp() and g.valid_until>clock_timestamp()) then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 select * into v from public.clinical_versions where id=r.version_id and kind='finalized';
 select coalesce(jsonb_agg(x),'[]') into results from jsonb_array_elements(v.snapshot->'results') x where x->>'stage'='released';
 select coalesce(jsonb_agg(x),'[]') into orders from jsonb_array_elements(v.snapshot->'orders') x where exists(select 1 from jsonb_array_elements(results) y where y->>'order_id'=x->>'id');
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'filename',d.filename,'mime',d.mime_type,'size',d.byte_size,'sha256',d.sha256) order by d.id),'[]') into documents
  from public.patient_document_versions d where d.practice_id=r.practice_id and d.patient_id=r.recipient_patient_id and exists(select 1 from jsonb_array_elements(results) x where x->>'document_version_id'=d.id::text);
 select max(g.valid_until) into signer_until from doctor_private.clinical_fixture_grants g where g.practice_id=e.practice_id and g.location_id=e.location_id and g.user_id=r.released_by
  and 'release'=any(g.capabilities) and 'read'=any(g.capabilities) and g.revoked_at is null and g.issued_at<=clock_timestamp() and g.valid_until>clock_timestamp();
 select g.valid_until into recipient_until from doctor_private.clinical_recipient_grants g where g.practice_id=r.practice_id and g.patient_id=r.recipient_patient_id and g.user_id=actor and g.revoked_at is null and g.valid_until>clock_timestamp();
 if signer_until is null or recipient_until is null then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;

 -- Private working notes, intake and unreleased results never enter this view.
 return jsonb_build_object('release_id',r.id,'version_id',v.id,'revision',v.revision,'snapshot_sha256',v.snapshot_sha256,
  'responsible_doctor',e.responsible_doctor,'patient_id',e.patient_id,'location_name',e.location_name,'timezone',e.timezone,
  'finalized_at',v.happened_at,'expires_at',least(r.expires_at,signer_until,recipient_until),'prescriptions',v.snapshot->'prescriptions','results',results,'orders',orders,'documents',documents,
  'doctor_name',(select display_name from public.doctor_profiles where user_id=e.responsible_doctor),'patient_name',(select display_name from public.practice_patients where practice_id=r.practice_id and id=r.recipient_patient_id),
  'data_mode','synthetic','clinical_approval',false,'professional_signature',false,'live_prescribing',false);
end $$;
