-- Fresh clinical authority requires Read Committed; a frozen snapshot cannot prove current revocation.
create function doctor_private.clinical_actor() returns uuid
language plpgsql volatile security definer set search_path='' as $$declare actor uuid;begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25001',message='DOCTOR_CLINICAL_ISOLATION_REQUIRED';end if;
 actor:=doctor_private.current_actor();
 if not exists(select 1 from auth.users where id=actor and deleted_at is null) then raise exception using errcode='42501',message='DOCTOR_AUTH_REQUIRED';end if;
 return actor;
end $$;
revoke all on function doctor_private.clinical_actor() from public,anon,authenticated,service_role;
create or replace function doctor_private.clinical_scope(p_practice uuid,p_location uuid,p_capability text,p_write boolean default false) returns uuid
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=doctor_private.clinical_actor(); owner_id uuid;
begin
 -- Administrative candidate never acquires clinical capabilities. Neither
 -- ownership, metadata, email verification nor SaaS payment supplies a fixture grant.
 if doctor_private.edition_mode()<>'synthetic_preview'
  or not doctor_private.has_access(p_practice,'patients.read',p_location)
  or not exists(select 1 from doctor_private.clinical_fixture_grants g
    where g.practice_id=p_practice and g.location_id=p_location and g.user_id=actor
     and g.purpose='synthetic_fixture' and g.policy_version='synthetic-engineering-v1'
     and p_capability=any(g.capabilities) and 'read'=any(g.capabilities)
     and g.issued_at<=clock_timestamp() and g.valid_until>clock_timestamp() and g.revoked_at is null) then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE'; end if;
 select owner_user_id into owner_id from public.practices where id=p_practice;
 if p_capability=any(array['review','sign','release']) and actor<>owner_id then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_SIGNER_REQUIRED'; end if;
 if p_write and exists(select 1 from public.locations where id=p_location and archived_at is not null) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_ARCHIVED'; end if;
 return actor;
end $$;
-- DOS-M2-008: synthetic implementation only; no fixture grants or clinical approval seeded.
create or replace function doctor_private.clinical_command(p_practice uuid,p_location uuid,p_encounter uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare actor uuid; sid uuid; prior doctor_private.command_receipts; request jsonb; result jsonb;
 encounter public.clinical_encounters; latest public.clinical_versions; written public.clinical_versions;
 place public.locations; patient uuid; snapshot jsonb; reason text; capability text; release public.clinical_releases; old_item jsonb; new_item jsonb; stages text[]:=array['requested','uploaded','received','reviewed','released'];
begin
 if p_key is null or p_input is null or jsonb_typeof(p_input)<>'object' or p_action is null
  or p_action<>all(array['create','save','start','finalize','amend','withdraw']) then
  raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 capability:=case when p_action in('finalize','withdraw') then 'sign' when p_action='amend' then 'review'
  when p_action in('release','revoke_release') then 'release' else 'draft' end;
 actor:=doctor_private.clinical_scope(p_practice,p_location,capability,true);sid:=(auth.jwt()->>'session_id')::uuid;
 request:=jsonb_build_object('command','clinical.'||p_action,'practice',p_practice,'location',p_location,'encounter',p_encounter,'version',p_expected_version,'input',p_input,'session',sid);
 if p_action='create' then
  perform doctor_private.clinical_shape(p_input,array['patient_id','snapshot']);
  if p_encounter is not null or p_expected_version is not null or coalesce(p_input->>'patient_id','')!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
   raise exception using errcode='22023',message='DOCTOR_CLINICAL_INVALID';end if;
  patient:=(p_input->>'patient_id')::uuid;
 else
  select * into encounter from public.clinical_encounters where practice_id=p_practice and location_id=p_location and id=p_encounter for update;
  if not found then raise exception using errcode='42501',message='DOCTOR_CLINICAL_UNAVAILABLE';end if;
  patient:=encounter.patient_id;
 end if;
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=patient and archived_at is null) then
  raise exception using errcode='42501',message='DOCTOR_CLINICAL_PATIENT_DENIED';end if;
 -- Authority and patient/archive status are checked even on a receipt replay.
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result;
 end if;
 if p_action<>'create' then
  if encounter.version is distinct from p_expected_version then raise exception using errcode='40001',message='DOCTOR_CLINICAL_CONFLICT';end if;
  select * into latest from public.clinical_versions where encounter_id=encounter.id order by revision desc limit 1;
  snapshot:=latest.snapshot;
 end if;
 if p_action='create' then
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  snapshot:=doctor_private.clinical_snapshot(p_input->'snapshot',p_practice,p_location,patient);
  insert into public.clinical_encounters(practice_id,patient_id,location_id,responsible_doctor,location_name,timezone,status,created_by)
   select p_practice,patient,p_location,p.owner_user_id,place.name,place.timezone,'draft',actor from public.practices p where p.id=p_practice returning * into encounter;
 elsif p_action='save' then
  perform doctor_private.clinical_shape(p_input,array['snapshot']);
  if encounter.status not in('draft','in_progress','amended') then raise exception using errcode='22023',message='DOCTOR_CLINICAL_IMMUTABLE';end if;
  snapshot:=doctor_private.clinical_snapshot(p_input->'snapshot',p_practice,p_location,patient);
  reason:=latest.reason;
 elsif p_action='start' then
  perform doctor_private.clinical_shape(p_input,'{}');
  if encounter.status<>'draft' then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TRANSITION_INVALID';end if;
  encounter.status:='in_progress';
 elsif p_action='finalize' then
  perform doctor_private.clinical_shape(p_input,array['reviewed_version_id','reviewed_sha256']);
  if p_input->>'reviewed_version_id' is distinct from latest.id::text or p_input->>'reviewed_sha256' is distinct from latest.snapshot_sha256 then
   raise exception using errcode='40001',message='DOCTOR_CLINICAL_REVIEW_CONFLICT';end if;
  if encounter.status not in('in_progress','amended') then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TRANSITION_INVALID';end if;
  snapshot:=doctor_private.clinical_snapshot(snapshot,p_practice,p_location,patient,true);
  encounter.status:='finalized';reason:=latest.reason;
 elsif p_action in('amend','withdraw') then
  perform doctor_private.clinical_shape(p_input,array['reason']);perform doctor_private.clinical_text(p_input->'reason',500);
  if encounter.status<>'finalized' or encounter.active_version_id is null then raise exception using errcode='22023',message='DOCTOR_CLINICAL_TRANSITION_INVALID';end if;
  reason:=p_input->>'reason';encounter.status:=case p_action when 'amend' then 'amended' else 'withdrawn' end;
 end if;
 if p_action in('create','save') then
  for new_item in select value from jsonb_array_elements(snapshot->'orders') loop
   select x into old_item from jsonb_array_elements(coalesce(latest.snapshot->'orders','[]')) x where x->>'id'=new_item->>'id';
   if (old_item is null and new_item->>'state'<>'requested') or (old_item->>'state'='cancelled' and new_item->>'state'<>'cancelled') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_ORDER_TRANSITION_INVALID';end if;
  end loop;
  for old_item in select value from jsonb_array_elements(coalesce(latest.snapshot->'orders','[]')) loop
   if old_item->>'state'<>'cancelled' and not exists(select 1 from jsonb_array_elements(snapshot->'orders') x where x->>'id'=old_item->>'id') then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_ORDER_REASON_REQUIRED';end if;
  end loop;
  for new_item in select value from jsonb_array_elements(snapshot->'results') loop
   select x into old_item from jsonb_array_elements(coalesce(latest.snapshot->'results','[]')) x where x->>'id'=new_item->>'id';
   if old_item is null then
    if new_item->>'stage' not in('requested','uploaded') then raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';end if;
   elsif old_item->>'order_id' is distinct from new_item->>'order_id' then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';
   elsif old_item->>'document_version_id' is distinct from new_item->>'document_version_id' then
    if new_item->>'stage'<>'uploaded' then raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_REVIEW_REQUIRED';end if;
   elsif array_position(stages,new_item->>'stage') not in(array_position(stages,old_item->>'stage'),array_position(stages,old_item->>'stage')+1) then
    raise exception using errcode='22023',message='DOCTOR_CLINICAL_RESULT_TRANSITION_INVALID';
   end if;
  end loop;
 end if;
 if p_action not in('release','revoke_release') then
  if p_action<>'create' then encounter.version:=encounter.version+1;end if;
  insert into public.clinical_versions(practice_id,encounter_id,revision,kind,source_version_id,snapshot,snapshot_sha256,reason,actor_user_id,actor_session_id)
   values(p_practice,encounter.id,encounter.version,encounter.status,latest.id,snapshot,encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'),reason,actor,sid) returning * into written;
  if p_action='finalize' then encounter.active_version_id:=written.id;elsif p_action='withdraw' then encounter.active_version_id:=null;end if;
  update public.clinical_encounters set version=encounter.version,status=encounter.status,active_version_id=encounter.active_version_id,updated_at=clock_timestamp() where id=encounter.id;
 else
  written:=latest;
 end if;
 insert into public.clinical_events(practice_id,encounter_id,version_id,action,actor_user_id) values(p_practice,encounter.id,written.id,p_action,actor);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id) values(p_practice,actor,'clinical.'||p_action,encounter.id);
 result:=jsonb_build_object('encounter_id',encounter.id,'version',encounter.version,'version_id',written.id,'status',encounter.status,'release_id',release.id,'data_mode','synthetic','clinical_approval',false,'live_prescribing',false);
 insert into doctor_private.command_receipts(actor_user_id,command_key,request,result) values(actor,p_key,request,result);
 return result;
end $$;
