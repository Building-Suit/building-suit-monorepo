-- DOS-M3-008. Operational facts cannot promote clinical review/release.
create table public.operational_fulfillments(
 practice_id uuid not null references public.practices(id),id uuid not null,patient_id uuid not null,location_id uuid not null,
 encounter_id uuid not null,source_version_id uuid not null,order_id uuid not null,kind text not null check(kind in('lab','imaging','referral')),
 state text not null default 'requested' check(state in('requested','arranged','received','cancelled')),version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,id),unique(practice_id,encounter_id,order_id),
 foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,encounter_id,source_version_id)references public.clinical_versions(practice_id,encounter_id,id)
);
create table public.operational_fulfillment_documents(
 practice_id uuid not null,fulfillment_id uuid not null,document_id uuid not null,document_version_id uuid not null,
 source_ref text not null check(length(btrim(source_ref))between 1 and 200),source_at timestamptz not null,received_at timestamptz not null,
 recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),review_state text not null default 'unreviewed'check(review_state='unreviewed'),
 primary key(practice_id,fulfillment_id,document_version_id),foreign key(practice_id,fulfillment_id)references public.operational_fulfillments(practice_id,id),
 foreign key(practice_id,document_id,document_version_id)references public.patient_document_versions(practice_id,document_id,id),check(source_at<=received_at)
);
create table public.operational_fulfillment_events(
 practice_id uuid not null,fulfillment_id uuid not null,version integer not null,state text not null,actor_user_id uuid not null references auth.users(id),
 happened_at timestamptz not null default clock_timestamp(),source_ref text not null,primary key(practice_id,fulfillment_id,version),foreign key(practice_id,fulfillment_id)references public.operational_fulfillments(practice_id,id)
);
alter table public.operational_fulfillments enable row level security;
alter table public.operational_fulfillment_documents enable row level security;
alter table public.operational_fulfillment_events enable row level security;
revoke all on public.operational_fulfillments,public.operational_fulfillment_documents,public.operational_fulfillment_events from public,anon,authenticated,service_role;
create trigger fulfillment_history_immutable before update or delete on public.operational_fulfillment_events for each row execute function doctor_private.contact_history_immutable();
create trigger fulfillment_documents_immutable before update or delete on public.operational_fulfillment_documents for each row execute function doctor_private.contact_history_immutable();
create function doctor_private.fulfillment_command(p_practice uuid,p_location uuid,p_patient uuid,p_id uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;r public.operational_fulfillments;e public.clinical_encounters;v public.clinical_versions;d public.patient_document_versions;prior doctor_private.command_receipts;request jsonb;result jsonb;source text;source_time timestamptz;received_time timestamptz;order_kind text;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));actor:=doctor_private.current_actor();
 perform 1 from public.memberships m join public.membership_locations ml on ml.practice_id=m.practice_id and ml.membership_id=m.id where m.practice_id=p_practice and m.user_id=actor and ml.location_id=p_location order by m.id for share of m,ml;
 perform doctor_private.contact_scope(p_practice,p_location,p_patient,true);
 if p_id is null or p_key is null or p_version is null or p_action is null or p_action not in('create','arrange','receive','cancel')then raise exception using errcode='22023',message='DOCTOR_FULFILLMENT_INVALID';end if;
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=p_patient and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 if p_action='create'then
  perform doctor_private.contact_shape(p_input,array['encounter_id','source_version_id','order_id','source_ref']);
  select * into e from public.clinical_encounters where practice_id=p_practice and patient_id=p_patient and location_id=p_location and id=(p_input->>'encounter_id')::uuid for share;
  select * into v from public.clinical_versions where practice_id=p_practice and encounter_id=e.id and id=(p_input->>'source_version_id')::uuid;
  if p_version<>0 or e.id is null or e.status not in('finalized','amended')or v.id is distinct from e.active_version_id or v.kind not in('finalized','amended')then raise exception using errcode='42501',message='DOCTOR_FULFILLMENT_REQUEST_DENIED';end if;
  select x->>'kind'into order_kind from jsonb_array_elements(v.snapshot->'orders')x where x->>'id'=p_input->>'order_id'and x->>'state'<>'cancelled'and x->>'kind'in('lab','imaging','referral');
  if order_kind is null then raise exception using errcode='42501',message='DOCTOR_FULFILLMENT_REQUEST_DENIED';end if;
 else
  select * into r from public.operational_fulfillments where practice_id=p_practice and patient_id=p_patient and location_id=p_location and id=p_id for update;
  if r.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  perform doctor_private.contact_shape(p_input,case when p_action='receive'then array['document_version_id','source_ref','source_at','received_at']else array['source_ref']end);
 end if;
 source:=doctor_private.contact_text(p_input->'source_ref');
 if p_action='receive'then
  perform doctor_private.require_access(p_practice,'documents.read',p_location);
  select * into d from public.patient_document_versions where practice_id=p_practice and patient_id=p_patient and id=(p_input->>'document_version_id')::uuid;
  if d.id is null or not exists(select 1 from public.patient_documents where practice_id=p_practice and patient_id=p_patient and id=d.document_id and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_FULFILLMENT_DOCUMENT_DENIED';end if;
  if jsonb_typeof(p_input->'source_at')is distinct from'string'or jsonb_typeof(p_input->'received_at')is distinct from'string'
   or p_input->>'source_at'!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'or p_input->>'received_at'!~'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$'then raise exception using errcode='22023',message='DOCTOR_FULFILLMENT_INVALID';end if;
  source_time:=(p_input->>'source_at')::timestamptz;received_time:=(p_input->>'received_at')::timestamptz;
  if source_time<'1900-01-01'::timestamptz or received_time<source_time or received_time>clock_timestamp()then raise exception using errcode='22023',message='DOCTOR_FULFILLMENT_INVALID';end if;
 end if;
 request:=jsonb_build_object('command','fulfillment.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'patient',p_patient,'record',p_id,'version',p_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='create'then
  insert into public.operational_fulfillments(practice_id,id,patient_id,location_id,encounter_id,source_version_id,order_id,kind,created_by)values(p_practice,p_id,p_patient,p_location,e.id,v.id,(p_input->>'order_id')::uuid,order_kind,actor)returning * into r;
 else
  if r.version<>p_version or r.state in('received','cancelled')or(p_action='arrange'and r.state<>'requested')then raise exception using errcode='40001',message='DOCTOR_FULFILLMENT_CONFLICT';end if;
  if p_action<>'cancel'then
   select * into e from public.clinical_encounters where practice_id=p_practice and id=r.encounter_id for share;
   if e.status not in('finalized','amended')or not exists(select 1 from public.clinical_versions cv cross join lateral jsonb_array_elements(cv.snapshot->'orders')o where cv.id=e.active_version_id and o->>'id'=r.order_id::text and o->>'kind'=r.kind and o->>'state'<>'cancelled'and o=(select original_order from public.clinical_versions source cross join lateral jsonb_array_elements(source.snapshot->'orders')original_order where source.id=r.source_version_id and original_order->>'id'=r.order_id::text))then raise exception using errcode='42501',message='DOCTOR_FULFILLMENT_REQUEST_DENIED';end if;
  end if;
  if p_action='receive'then insert into public.operational_fulfillment_documents(practice_id,fulfillment_id,document_id,document_version_id,source_ref,source_at,received_at,recorded_by)values(p_practice,p_id,d.document_id,d.id,source,source_time,received_time,actor);end if;
  update public.operational_fulfillments set state=case p_action when'arrange'then'arranged'when'receive'then'received'else'cancelled'end,version=version+1,updated_at=clock_timestamp()where practice_id=p_practice and id=p_id returning * into r;
 end if;
 insert into public.operational_fulfillment_events(practice_id,fulfillment_id,version,state,actor_user_id,source_ref)values(p_practice,p_id,r.version,r.state,actor,source);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'fulfillment.'||p_action,p_id,jsonb_build_object('location_id',p_location,'version',r.version,'state',r.state,'review_state','unreviewed','partner_api',false));
 result:=jsonb_build_object('id',r.id,'version',r.version,'state',r.state,'review_state','unreviewed','partner_api',false);insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when unique_violation then raise exception using errcode='40001',message='DOCTOR_FULFILLMENT_CONFLICT';when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='22023',message='DOCTOR_FULFILLMENT_INVALID';
end $$;
create function doctor_private.fulfillment_directory(p_practice uuid,p_location uuid,p_patient uuid,p_page integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;total bigint;requests jsonb;documents jsonb;writable boolean;
begin
 perform doctor_private.contact_scope(p_practice,p_location,p_patient);
 if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_FULFILLMENT_INVALID';end if;
 writable:=doctor_private.has_access(p_practice,'patients.write',p_location)and exists(select 1 from public.practice_patients where practice_id=p_practice and id=p_patient and archived_at is null);
 with cohort as materialized(select * from public.operational_fulfillments where practice_id=p_practice and location_id=p_location and patient_id=p_patient),selected as(select * from cohort order by created_at desc,id limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg(jsonb_build_object('id',f.id,'version',f.version,'state',f.state,'kind',f.kind,'encounter_id',f.encounter_id,'source_version_id',f.source_version_id,'order_id',f.order_id,'created_at',f.created_at,'documents',case when doctor_private.has_access(p_practice,'documents.read',p_location)then coalesce((select jsonb_agg(jsonb_build_object('document_version_id',d.document_version_id,'source_at',d.source_at,'received_at',d.received_at,'recorded_at',d.recorded_at,'review_state',d.review_state))from public.operational_fulfillment_documents d where d.practice_id=p_practice and d.fulfillment_id=f.id),'[]')else'[]'::jsonb end)order by f.created_at desc,f.id),'[]')into total,rows from selected f;
 select coalesce(jsonb_agg(q),'[]')into requests from(select e.id encounter_id,v.id source_version_id,o->>'id'order_id,o->>'kind'kind,v.happened_at from public.clinical_encounters e join public.clinical_versions v on v.id=e.active_version_id cross join lateral jsonb_array_elements(v.snapshot->'orders')o where e.practice_id=p_practice and e.location_id=p_location and e.patient_id=p_patient and e.status in('finalized','amended')and v.kind in('finalized','amended')and o->>'kind'in('lab','imaging','referral')and o->>'state'<>'cancelled'and not exists(select 1 from public.operational_fulfillments f where f.practice_id=p_practice and f.encounter_id=e.id and f.order_id::text=o->>'id')order by v.happened_at desc,e.id,o->>'id'limit 100)q;
 documents:='[]';if doctor_private.has_access(p_practice,'documents.read',p_location)then select coalesce(jsonb_agg(q),'[]')into documents from(select v.id,v.filename from public.patient_documents d join public.patient_document_versions v on v.id=d.current_version_id where d.practice_id=p_practice and d.patient_id=p_patient and d.archived_at is null order by d.created_at desc,d.id limit 100)q;end if;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'patient_id',p_patient,'rows',rows,'total',total,'page',p_page,'requests',requests,'documents',documents,'documents_visible',doctor_private.has_access(p_practice,'documents.read',p_location),'can_write',writable,'can_receive',writable and doctor_private.has_access(p_practice,'documents.read',p_location),'review_state','unreviewed','partner_api',false,'data_mode','synthetic');
end $$;
create function public.doctor_fulfillment_command(p_practice uuid,p_location uuid,p_patient uuid,p_id uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.fulfillment_command(p_practice,p_location,p_patient,p_id,p_version,p_action,p_input,p_key)$$;
create function public.doctor_fulfillments(p_practice uuid,p_location uuid,p_patient uuid,p_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.fulfillment_directory(p_practice,p_location,p_patient,p_page)$$;
revoke all on function doctor_private.fulfillment_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.fulfillment_directory(uuid,uuid,uuid,integer),public.doctor_fulfillment_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_fulfillments(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.fulfillment_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.fulfillment_directory(uuid,uuid,uuid,integer),public.doctor_fulfillment_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_fulfillments(uuid,uuid,uuid,integer)to authenticated;
