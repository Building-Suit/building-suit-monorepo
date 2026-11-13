-- DOS-M2-013: synthetic implementation only; no fixture grants or clinical approval seeded.
create function doctor_private.clinical_export(p_practice uuid,p_location uuid,p_encounter uuid,p_key uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; encounter public.clinical_encounters; versions jsonb; documents jsonb; events jsonb; manifest jsonb; result jsonb; prior doctor_private.command_receipts; request jsonb; latest uuid;
begin
 if p_key is null then raise exception using errcode='22023',message='DOCTOR_COMMAND_KEY_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));actor:=doctor_private.clinical_scope(p_practice,p_location,'export');
 select * into encounter from public.clinical_encounters where id=p_encounter and practice_id=p_practice and location_id=p_location;
 if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
 request:=jsonb_build_object('command','clinical.export','practice',p_practice,'location',p_location,'encounter',p_encounter,'version',encounter.version,'session',auth.jwt()->>'session_id');
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if (select count(*) from public.clinical_versions where encounter_id=encounter.id)>500 or (select count(*) from public.clinical_events where encounter_id=encounter.id)>5000 then
  raise exception using errcode='54000',message='DOCTOR_CLINICAL_EXPORT_TOO_LARGE';end if;
 select jsonb_agg(jsonb_build_object('id',id,'revision',revision,'kind',kind,'source_version_id',source_version_id,'canonical_snapshot',snapshot::text,'sha256',snapshot_sha256,'reason',reason,'actor_user_id',actor_user_id,'happened_at',happened_at) order by revision) into versions from public.clinical_versions where encounter_id=encounter.id;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') into documents from (
  select distinct d.id,d.document_id,d.revision,d.filename,d.mime_type,d.byte_size,d.sha256,d.uploaded_by,d.uploaded_at,d.location_id,d.location_name,d.timezone
  from public.clinical_versions v cross join lateral jsonb_array_elements(v.snapshot->'results') x join public.patient_document_versions d on d.id::text=x->>'document_version_id'
  where v.encounter_id=encounter.id and d.practice_id=p_practice and d.patient_id=encounter.patient_id) r;
 if jsonb_array_length(documents)>0 then perform doctor_private.document_scope(p_practice,p_location,encounter.patient_id);end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'version_id',version_id,'action',action,'actor_user_id',actor_user_id,'happened_at',happened_at) order by id),'[]') into events from public.clinical_events where encounter_id=encounter.id;
 manifest:=jsonb_build_object('exported_at',clock_timestamp(),'events_through_id',coalesce((select max(id) from public.clinical_events where encounter_id=encounter.id),0),'format','doctor-clinical-export-v1','data_mode','synthetic','encounter',to_jsonb(encounter),'versions',versions,'document_provenance',documents,'events',events,
  'versions_total',jsonb_array_length(versions),'documents_total',jsonb_array_length(documents),'events_total',jsonb_array_length(events),
  'storage_bytes_included',false,'retention_policy','unapproved_no_erasure','clinical_approval',false,'live_prescribing',false);
 if octet_length(manifest::text)>8388608 then raise exception using errcode='54000',message='DOCTOR_CLINICAL_EXPORT_TOO_LARGE';end if;
 result:=jsonb_build_object('canonical_manifest',manifest::text,'sha256',encode(sha256(convert_to(manifest::text,'UTF8')),'hex'));
 select id into latest from public.clinical_versions where encounter_id=encounter.id order by revision desc limit 1;
 insert into public.clinical_events(practice_id,encounter_id,version_id,action,actor_user_id) values(p_practice,encounter.id,latest,'export',actor);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(p_practice,actor,'clinical.export',encounter.id);
 insert into doctor_private.command_receipts(actor_user_id,command_key,request,result) values(actor,p_key,request,result);
 return result;
end $$;
create function public.doctor_clinical_export(p_practice uuid,p_location uuid,p_encounter uuid,p_key uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$select doctor_private.clinical_export(p_practice,p_location,p_encounter,p_key)$$;
revoke all on function doctor_private.clinical_export(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function doctor_private.clinical_export(uuid,uuid,uuid,uuid) to authenticated;
revoke all on function public.doctor_clinical_export(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.doctor_clinical_export(uuid,uuid,uuid,uuid) to authenticated;
