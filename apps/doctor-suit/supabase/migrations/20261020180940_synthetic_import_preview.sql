-- DOS-M3-009. Persisted synthetic staging only; no canonical patient/appointment writes.
create table public.synthetic_import_batches(
 practice_id uuid not null references public.practices(id),location_id uuid not null,id uuid not null,
 mapping_version text not null check(mapping_version='patient-appointment-v1'),source_ref text not null check(length(btrim(source_ref))between 1 and 200),
 source_rows jsonb not null check(jsonb_typeof(source_rows)='array'and jsonb_array_length(source_rows)between 1 and 500),source_sha256 text not null check(source_sha256~'^[0-9a-f]{64}$'),
 expected_rows integer not null check(expected_rows between 1 and 500),cursor integer not null default 0 check(cursor>=0 and cursor<=expected_rows),
 state text not null default'previewing'check(state in('previewing','validated','review_required','discarded')),version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id)
);
create table public.synthetic_import_rows(
 practice_id uuid not null,batch_id uuid not null,ordinal integer not null check(ordinal between 1 and 500),source_id text not null,kind text not null,
 state text not null check(state in('valid','invalid','review')),errors text[]not null,preview_target jsonb,
 primary key(practice_id,batch_id,ordinal),foreign key(practice_id,batch_id)references public.synthetic_import_batches(practice_id,id)
);
create table public.synthetic_import_events(
 practice_id uuid not null,batch_id uuid not null,version integer not null,action text not null,cursor integer not null,state text not null,
 actor_user_id uuid not null references auth.users(id),happened_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,batch_id,version),foreign key(practice_id,batch_id)references public.synthetic_import_batches(practice_id,id)
);
alter table public.synthetic_import_batches enable row level security;alter table public.synthetic_import_rows enable row level security;alter table public.synthetic_import_events enable row level security;
revoke all on public.synthetic_import_batches,public.synthetic_import_rows,public.synthetic_import_events from public,anon,authenticated,service_role;
create trigger import_events_immutable before update or delete on public.synthetic_import_events for each row execute function doctor_private.contact_history_immutable();
create function doctor_private.import_row_errors(r jsonb)returns text[] language plpgsql stable set search_path=''as $$
declare errors text[]:='{}';dob date;instant timestamptz;
begin
 if jsonb_typeof(r)is distinct from'object'then return array['invalid_shape'];end if;
 if not(r?&array['source_id','kind','patient_source_id','display_name','birth_date','phone','email','starts_at','state'])or(select count(*)from jsonb_object_keys(r))<>9 then return array['invalid_shape'];end if;
 if jsonb_typeof(r->'source_id')is distinct from'string'or r->>'source_id'!~'^[A-Za-z0-9_-]{1,64}$'then errors:=array_append(errors,'invalid_source_id');end if;
 if r->>'kind'='patient'then
  if r->'patient_source_id'<>'null'::jsonb or r->'starts_at'<>'null'::jsonb or r->'state'<>'null'::jsonb or jsonb_typeof(r->'display_name')is distinct from'string'or r->>'display_name'!~'^Synthetic .{1,150}$'or r->>'display_name'~'[[:cntrl:]]'then errors:=array_append(errors,'synthetic_shape_required');end if;
  if jsonb_typeof(r->'phone')is distinct from'string'or(r->>'phone'<>''and r->>'phone'!~'^\+1555000[0-9]{4}$')or jsonb_typeof(r->'email')is distinct from'string'or(r->>'email'<>''and r->>'email'!~*'^[a-z0-9._+-]+@example\.test$')then errors:=array_append(errors,'synthetic_contact_required');end if;
  if r->'birth_date'<>'null'::jsonb then
   begin
    if jsonb_typeof(r->'birth_date')is distinct from'string'or r->>'birth_date'!~'^\d{4}-\d{2}-\d{2}$'then errors:=array_append(errors,'invalid_date');else dob:=(r->>'birth_date')::date;if dob<'1900-01-01'::date or dob>current_date then errors:=array_append(errors,'invalid_date');end if;end if;
   exception when invalid_datetime_format or datetime_field_overflow then errors:=array_append(errors,'invalid_date');end;
  end if;
 elsif r->>'kind'='appointment'then
  if jsonb_typeof(r->'patient_source_id')is distinct from'string'or r->>'patient_source_id'!~'^[A-Za-z0-9_-]{1,64}$'or r->'display_name'<>'null'::jsonb or r->'birth_date'<>'null'::jsonb or r->>'phone'<>''or r->>'email'<>''then errors:=array_append(errors,'invalid_reference_shape');end if;
  if jsonb_typeof(r->'state')is distinct from'string'or r->>'state'not in('booked','cancelled','completed','no_show')then errors:=array_append(errors,'invalid_state');end if;
  begin
   if jsonb_typeof(r->'starts_at')is distinct from'string'or r->>'starts_at'!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'then errors:=array_append(errors,'invalid_date');else instant:=(r->>'starts_at')::timestamptz;end if;
  exception when invalid_datetime_format or datetime_field_overflow then errors:=array_append(errors,'invalid_date');end;
 else errors:=array_append(errors,'invalid_kind');end if;
 return errors;
end $$;
create function doctor_private.import_command(p_practice uuid,p_location uuid,p_batch uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;b public.synthetic_import_batches;prior doctor_private.command_receipts;request jsonb;result jsonb;row_value jsonb;row_errors text[];n integer;size integer;bad integer;review integer;target jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));actor:=doctor_private.current_actor();
 perform 1 from public.memberships m join public.membership_locations ml on ml.practice_id=m.practice_id and ml.membership_id=m.id where m.practice_id=p_practice and m.user_id=actor and ml.location_id=p_location order by m.id for share of m,ml;
 if doctor_private.edition_mode()<>'synthetic_preview'then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 perform doctor_private.patient_scope(p_practice,p_location,true);
 if p_batch is null or p_key is null or p_version is null or p_action is null or p_action not in('create','next','reconcile','discard')then raise exception using errcode='22023',message='DOCTOR_IMPORT_INVALID';end if;
 if p_action='create'then
  perform doctor_private.contact_shape(p_input,array['mapping_version','synthetic','source_ref','rows']);perform doctor_private.contact_text(p_input->'source_ref');
  if p_version<>0 or p_input->>'mapping_version'is distinct from'patient-appointment-v1'or p_input->'synthetic'is distinct from'true'::jsonb or jsonb_typeof(p_input->'rows')is distinct from'array'or jsonb_array_length(p_input->'rows')not between 1 and 500 or octet_length(p_input::text)>262144 then raise exception using errcode='22023',message='DOCTOR_IMPORT_INVALID';end if;
 else
  select * into b from public.synthetic_import_batches where practice_id=p_practice and location_id=p_location and id=p_batch for update;
  if b.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  perform doctor_private.contact_shape(p_input,case when p_action='next'then array['limit']else array[]::text[]end);
  if p_action='next'and(jsonb_typeof(p_input->'limit')is distinct from'number'or p_input->>'limit'!~'^[0-9]{1,2}$'or(p_input->>'limit')::integer not between 1 and 50)then raise exception using errcode='22023',message='DOCTOR_IMPORT_INVALID';end if;
 end if;
 request:=jsonb_build_object('command','import.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'batch',p_batch,'version',p_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='create'then
  insert into public.synthetic_import_batches(practice_id,location_id,id,mapping_version,source_ref,source_rows,source_sha256,expected_rows,created_by)values(p_practice,p_location,p_batch,'patient-appointment-v1',btrim(p_input->>'source_ref'),p_input->'rows',encode(sha256(convert_to((p_input->'rows')::text,'UTF8')),'hex'),jsonb_array_length(p_input->'rows'),actor)returning * into b;
 else
  if b.version<>p_version or b.state='discarded'then raise exception using errcode='40001',message='DOCTOR_IMPORT_CONFLICT';end if;
  if p_action='next'then
   if b.state<>'previewing'or b.cursor>=b.expected_rows then raise exception using errcode='40001',message='DOCTOR_IMPORT_CONFLICT';end if;
   size:=least((p_input->>'limit')::integer,b.expected_rows-b.cursor);
   for n in b.cursor+1..b.cursor+size loop
    row_value:=b.source_rows->(n-1);row_errors:=doctor_private.import_row_errors(row_value);
    target:=case when cardinality(row_errors)=0 then row_value||jsonb_build_object('email',lower(row_value->>'email'),'canonical_write',false)end;
    insert into public.synthetic_import_rows(practice_id,batch_id,ordinal,source_id,kind,state,errors,preview_target)values(p_practice,p_batch,n,case when row_value->>'source_id'~'^[A-Za-z0-9_-]{1,64}$'then row_value->>'source_id'else'[invalid source id]'end,case when row_value->>'kind'in('patient','appointment')then row_value->>'kind'else'[invalid kind]'end,case when cardinality(row_errors)=0 then'valid'else'invalid'end,row_errors,target);
   end loop;b.cursor:=b.cursor+size;
  elsif p_action='reconcile'then
   if b.cursor<>b.expected_rows or(select count(*)from public.synthetic_import_rows where practice_id=p_practice and batch_id=p_batch)<>b.expected_rows then raise exception using errcode='40001',message='DOCTOR_IMPORT_INCOMPLETE';end if;
   for n in 1..b.expected_rows loop
    row_value:=b.source_rows->(n-1);row_errors:=doctor_private.import_row_errors(row_value);
    if(select count(*)from jsonb_array_elements(b.source_rows)x where x->>'source_id'=row_value->>'source_id')>1 then row_errors:=array_append(row_errors,'duplicate_source_id');end if;
    if row_value->>'kind'='appointment'and(select count(*)from jsonb_array_elements(b.source_rows)x where x->>'kind'='patient'and x->>'source_id'=row_value->>'patient_source_id'and cardinality(doctor_private.import_row_errors(x))=0)<>1 then row_errors:=array_append(row_errors,'unmatched_reference');end if;
    if row_value->>'kind'='patient'and cardinality(row_errors)=0 and(
     exists(select 1 from jsonb_array_elements(b.source_rows)with ordinality q(x,ordinal)where ordinal<>n and x->>'kind'='patient'and((row_value->>'phone'<>''and x->>'phone'=row_value->>'phone')or(row_value->>'email'<>''and lower(x->>'email')=lower(row_value->>'email'))))
     or exists(select 1 from public.practice_patients p where p.practice_id=p_practice and((row_value->>'phone'<>''and p.recorded_phone=row_value->>'phone')or(row_value->>'email'<>''and lower(p.recorded_email)=lower(row_value->>'email')))))then row_errors:=array_append(row_errors,'duplicate_candidate');end if;
    update public.synthetic_import_rows set errors=row_errors,state=case when row_errors=array['duplicate_candidate']then'review'when cardinality(row_errors)>0 then'invalid'else'valid'end,preview_target=case when cardinality(row_errors)=0 then row_value||jsonb_build_object('email',lower(row_value->>'email'),'canonical_write',false)end where practice_id=p_practice and batch_id=p_batch and ordinal=n;
   end loop;
   select count(*)filter(where state='invalid'),count(*)filter(where state='review')into bad,review from public.synthetic_import_rows where practice_id=p_practice and batch_id=p_batch;
   b.state:=case when bad+review=0 then'validated'else'review_required'end;
  else b.state:='discarded';end if;
  update public.synthetic_import_batches set cursor=b.cursor,state=b.state,version=version+1 where practice_id=p_practice and id=p_batch returning * into b;
 end if;
 insert into public.synthetic_import_events(practice_id,batch_id,version,action,cursor,state,actor_user_id)values(p_practice,p_batch,b.version,p_action,b.cursor,b.state,actor);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'import.'||p_action,p_batch,jsonb_build_object('location_id',p_location,'version',b.version,'cursor',b.cursor,'state',b.state,'canonical_write',false));
 result:=jsonb_build_object('id',b.id,'version',b.version,'cursor',b.cursor,'expected_rows',b.expected_rows,'state',b.state,'source_sha256',b.source_sha256,'canonical_write',false,'real_import',false);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when unique_violation then raise exception using errcode='40001',message='DOCTOR_IMPORT_CONFLICT';when invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_IMPORT_INVALID';
end $$;
create function doctor_private.import_directory(p_practice uuid,p_location uuid,p_batch uuid,p_page integer)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare b public.synthetic_import_batches;rows jsonb;total integer;valid integer;invalid integer;review integer;batches jsonb;
begin
 perform doctor_private.patient_scope(p_practice,p_location);
 if doctor_private.edition_mode()<>'synthetic_preview'then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_IMPORT_INVALID';end if;
 select coalesce(jsonb_agg(q),'[]')into batches from(select id,source_ref,state,version,created_at from public.synthetic_import_batches where practice_id=p_practice and location_id=p_location order by created_at desc,id limit 100)q;
 if p_batch is not null then
  select * into b from public.synthetic_import_batches where practice_id=p_practice and location_id=p_location and id=p_batch;
  if b.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 with cohort as materialized(select * from public.synthetic_import_rows where practice_id=p_practice and batch_id=p_batch),selected as(select * from cohort order by ordinal limit 20 offset p_page*20)
 select(select count(*)from cohort),(select count(*)from cohort where state='valid'),(select count(*)from cohort where state='invalid'),(select count(*)from cohort where state='review'),coalesce(jsonb_agg(jsonb_build_object('ordinal',r.ordinal,'source_id',r.source_id,'kind',r.kind,'state',r.state,'errors',r.errors)order by r.ordinal),'[]')into total,valid,invalid,review,rows from selected r;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'batches',batches,'batch',case when b.id is not null then jsonb_build_object('id',b.id,'version',b.version,'cursor',b.cursor,'expected_rows',b.expected_rows,'state',b.state,'source_ref',b.source_ref,'source_sha256',b.source_sha256,'mapping_version',b.mapping_version)end,'page',p_page,'total',total,'valid',valid,'invalid',invalid,'review',review,'rows',rows,'can_write',doctor_private.has_access(p_practice,'patients.write',p_location),'canonical_write',false,'real_import',false,'data_mode','synthetic');
end $$;
create function public.doctor_import_command(p_practice uuid,p_location uuid,p_batch uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.import_command(p_practice,p_location,p_batch,p_version,p_action,p_input,p_key)$$;
create function public.doctor_import_preview(p_practice uuid,p_location uuid,p_batch uuid,p_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.import_directory(p_practice,p_location,p_batch,p_page)$$;
revoke all on function doctor_private.import_row_errors(jsonb),doctor_private.import_command(uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.import_directory(uuid,uuid,uuid,integer),public.doctor_import_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_import_preview(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.import_command(uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.import_directory(uuid,uuid,uuid,integer),public.doctor_import_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_import_preview(uuid,uuid,uuid,integer)to authenticated;
