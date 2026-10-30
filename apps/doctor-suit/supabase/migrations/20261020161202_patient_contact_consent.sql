-- DOS-M3-005. Synthetic contact records only; no Auth identity binding or legal approval.
create table public.patient_guardian_relationships(
 practice_id uuid not null references public.practices(id),patient_id uuid not null,id uuid not null,location_id uuid not null,
 label text not null check(length(btrim(label))between 1 and 160),relationship text not null check(relationship in('parent','guardian','representative')),
 state text not null default'pending'check(state in('pending','reviewed','revoked')),version integer not null default 1 check(version>0),
 purposes text[]not null default'{}'check(purposes<@array['appointment_reminder','administrative_follow_up','marketing']::text[]),
 source_ref text not null check(length(btrim(source_ref))between 1 and 200),review_source_ref text,reviewed_by uuid references auth.users(id),reviewed_at timestamptz,expires_at timestamptz,
 policy_version text not null default'synthetic-contact-v1'check(policy_version='synthetic-contact-v1'),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,id),unique(practice_id,patient_id,id),foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 check(state<>'reviewed'or(reviewed_by is not null and reviewed_at is not null and expires_at is not null and expires_at>reviewed_at and cardinality(purposes)>0 and review_source_ref is not null and length(btrim(review_source_ref))between 1 and 200))
);
create table public.patient_contact_channels(
 practice_id uuid not null references public.practices(id),patient_id uuid not null,id uuid not null,location_id uuid not null,
 recipient_kind text not null check(recipient_kind in('patient','guardian')),guardian_id uuid,
 channel text not null check(channel in('email','sms')),destination text not null check(length(btrim(destination))between 1 and 254),
 state text not null default'active'check(state in('active','revoked')),version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),revoked_by uuid references auth.users(id),revoked_at timestamptz,
 primary key(practice_id,id),unique(practice_id,patient_id,id),foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,patient_id,guardian_id)references public.patient_guardian_relationships(practice_id,patient_id,id),
 check((recipient_kind='guardian')=(guardian_id is not null)),check((state='revoked'and revoked_by is not null and revoked_at is not null)or(state='active'and revoked_by is null and revoked_at is null))
);
-- Destination is deliberately not a unique key across patients or relationships.
create table public.patient_contact_consents(
 practice_id uuid not null,patient_id uuid not null,id uuid not null,contact_id uuid not null,
 purpose text not null check(purpose in('appointment_reminder','administrative_follow_up','marketing')),allowed boolean not null,
 version integer not null check(version>0),contact_version integer not null check(contact_version>0),guardian_version integer check(guardian_version>0),
 source_ref text not null check(length(btrim(source_ref))between 1 and 200),source_time timestamptz not null,
 recorded_by uuid not null references auth.users(id),recorded_at timestamptz not null default clock_timestamp(),revoked_at timestamptz,
 primary key(practice_id,id),unique(practice_id,patient_id,contact_id,purpose),
 foreign key(practice_id,patient_id,contact_id)references public.patient_contact_channels(practice_id,patient_id,id),check(allowed=(revoked_at is null))
);
create table public.patient_contact_events(
 id bigint generated always as identity primary key,practice_id uuid not null,patient_id uuid not null,location_id uuid not null,
 record_kind text not null check(record_kind in('contact','guardian','consent')),record_id uuid not null,record_version integer not null check(record_version>0),
 action text not null check(action in('create_contact','revoke_contact','create_guardian','review_guardian','revoke_guardian','grant_consent','revoke_consent')),
 actor_user_id uuid not null references auth.users(id),happened_at timestamptz not null default clock_timestamp(),details jsonb not null,
 foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),unique(practice_id,record_kind,record_id,record_version)
);
create index guardian_patient_scope on public.patient_guardian_relationships(practice_id,patient_id,created_at,id);
create index contact_patient_scope on public.patient_contact_channels(practice_id,patient_id,created_at,id);
create index contact_events_patient on public.patient_contact_events(practice_id,patient_id,id);
create index contact_events_actor on public.patient_contact_events(actor_user_id);
alter table public.patient_guardian_relationships enable row level security;
alter table public.patient_contact_channels enable row level security;
alter table public.patient_contact_consents enable row level security;
alter table public.patient_contact_events enable row level security;
revoke all on public.patient_guardian_relationships,public.patient_contact_channels,public.patient_contact_consents,public.patient_contact_events from public,anon,authenticated,service_role;
revoke all on sequence public.patient_contact_events_id_seq from public,anon,authenticated,service_role;
create function doctor_private.contact_history_immutable()returns trigger language plpgsql security invoker set search_path=''as $$begin raise exception using errcode='42501',message='DOCTOR_CONTACT_HISTORY_IMMUTABLE';end $$;
create trigger contact_history_immutable before update or delete or truncate on public.patient_contact_events for each statement execute function doctor_private.contact_history_immutable();
create function doctor_private.contact_shape(p_input jsonb,p_keys text[])returns void language plpgsql immutable security invoker set search_path=''as $$
begin if jsonb_typeof(p_input)is distinct from'object'or not p_input?&p_keys or p_input-p_keys<>'{}'then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;end $$;
create function doctor_private.contact_text(p_value jsonb,p_max integer default 200)returns text language plpgsql immutable security invoker set search_path=''as $$
begin if jsonb_typeof(p_value)is distinct from'string'or length(btrim(p_value#>>'{}'))not between 1 and p_max or(p_value#>>'{}')~'[[:cntrl:]]'then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;return btrim(p_value#>>'{}');end $$;
create function doctor_private.contact_scope(p_practice uuid,p_location uuid,p_patient uuid,p_write boolean default false)returns void
language plpgsql stable security definer set search_path=''as $$
begin
 perform doctor_private.current_actor();
 if doctor_private.edition_mode()<>'synthetic_preview'then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 perform doctor_private.patient_scope(p_practice,p_location,p_write);
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=p_patient)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
end $$;
create function doctor_private.contact_clock(p_practice uuid,p_location uuid,p_input jsonb,p_day text,p_minute text)returns timestamptz
language plpgsql stable security definer set search_path=''as $$
declare place public.locations;instant timestamptz;
begin
 if jsonb_typeof(p_input->p_day)is distinct from'string'or(p_input->>p_day)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or jsonb_typeof(p_input->p_minute)is distinct from'number'or(p_input->>p_minute)!~'^[0-9]{1,4}$'or(p_input->>p_minute)::integer not between 0 and 1439
 or jsonb_typeof(p_input->'location_version')is distinct from'number'or(p_input->>'location_version')!~'^[1-9][0-9]{0,9}$'then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 if place.version<>(p_input->>'location_version')::integer then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
 instant:=doctor_private.schedule_clock((p_input->>p_day)::date,(p_input->>p_minute)::integer,place.timezone);
 if instant is null then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;return instant;
end $$;
-- This policy is shared with the subsequent outbox. It never sends, creates an
-- Auth identity, or treats a stored synthetic review as legal permission.
create function doctor_private.contact_eligibility(p_practice uuid,p_location uuid,p_patient uuid,p_intent jsonb)returns text
language plpgsql stable security definer set search_path=''as $$
declare channel public.patient_contact_channels;consent public.patient_contact_consents;guardian public.patient_guardian_relationships;
begin
 perform doctor_private.contact_shape(p_intent,array['contact_id','contact_version','purpose','consent_version','guardian_version']);
 if jsonb_typeof(p_intent->'contact_id')is distinct from'string'or jsonb_typeof(p_intent->'purpose')is distinct from'string'or p_intent->>'purpose'not in('appointment_reminder','administrative_follow_up','marketing')
 or exists(select 1 from unnest(array['contact_version','consent_version'])k where jsonb_typeof(p_intent->k)is distinct from'number'or(p_intent->>k)!~'^[1-9][0-9]{0,9}$')
 or(jsonb_typeof(p_intent->'guardian_version')is distinct from'null'and(jsonb_typeof(p_intent->'guardian_version')is distinct from'number'or(p_intent->>'guardian_version')!~'^[1-9][0-9]{0,9}$'))then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 if doctor_private.edition_mode()<>'synthetic_preview'then return'edition_disabled';end if;
 if not exists(select 1 from public.locations where practice_id=p_practice and id=p_location and archived_at is null)then return'clinic_archived';end if;
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=p_patient and archived_at is null)then return'patient_archived';end if;
 select * into channel from public.patient_contact_channels where practice_id=p_practice and patient_id=p_patient and id=(p_intent->>'contact_id')::uuid;
 if channel.id is null or channel.state<>'active'or channel.version<>(p_intent->>'contact_version')::integer then return'contact_unavailable';end if;
 select * into consent from public.patient_contact_consents where practice_id=p_practice and patient_id=p_patient and contact_id=channel.id and purpose=p_intent->>'purpose';
 if consent.id is null or not consent.allowed or consent.version<>(p_intent->>'consent_version')::integer or consent.contact_version<>channel.version then return'consent_unavailable';end if;
 if channel.guardian_id is null then
  if p_intent->'guardian_version'<>'null'::jsonb or consent.guardian_version is not null then return'guardian_unavailable';end if;
 else
  select * into guardian from public.patient_guardian_relationships where practice_id=p_practice and patient_id=p_patient and id=channel.guardian_id;
  if guardian.state is distinct from'reviewed'or guardian.expires_at<=clock_timestamp()or not(p_intent->>'purpose')=any(guardian.purposes)
   or(p_intent->>'guardian_version')::integer is distinct from guardian.version or consent.guardian_version is distinct from guardian.version then return'guardian_unavailable';end if;
 end if;
 return null;
exception when invalid_text_representation or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';
end $$;
create function doctor_private.contact_intent(c public.patient_contact_channels,s public.patient_contact_consents)returns jsonb
language sql stable security definer set search_path=''as $$select jsonb_build_object('contact_id',c.id,'contact_version',c.version,'purpose',s.purpose,'consent_version',s.version,'guardian_version',s.guardian_version)$$;
create function doctor_private.contact_directory(p_practice uuid,p_location uuid,p_patient uuid,p_contact_page integer,p_guardian_page integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare contacts jsonb;guardians jsonb;contact_total bigint;guardian_total bigint;patient public.practice_patients;place public.locations;writable boolean;
begin
 perform doctor_private.contact_scope(p_practice,p_location,p_patient);
 if p_contact_page is null or p_guardian_page is null or p_contact_page not between 0 and 100000 or p_guardian_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 select * into patient from public.practice_patients where practice_id=p_practice and id=p_patient;select * into place from public.locations where practice_id=p_practice and id=p_location;
 writable:=doctor_private.has_access(p_practice,'patients.write',p_location);
 with cohort as materialized(select * from public.patient_contact_channels where practice_id=p_practice and patient_id=p_patient),selected as(select * from cohort order by created_at desc,id limit 20 offset p_contact_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg((to_jsonb(c)-array['practice_id','patient_id','destination'])||jsonb_build_object('destination',c.destination,'guardian_label',(select label from public.patient_guardian_relationships where practice_id=c.practice_id and patient_id=c.patient_id and id=c.guardian_id),'can_grant',writable and patient.archived_at is null and c.state='active'and(c.guardian_id is null or exists(select 1 from public.patient_guardian_relationships where practice_id=c.practice_id and patient_id=c.patient_id and id=c.guardian_id and state='reviewed'and expires_at>clock_timestamp())),'grant_purposes',case when c.guardian_id is null then to_jsonb(array['appointment_reminder','administrative_follow_up','marketing']::text[])else coalesce((select to_jsonb(purposes)from public.patient_guardian_relationships where practice_id=c.practice_id and patient_id=c.patient_id and id=c.guardian_id and state='reviewed'and expires_at>clock_timestamp()),'[]'::jsonb)end,'can_revoke',writable and c.state='active','consents',coalesce((select jsonb_agg(to_jsonb(s)-array['practice_id','patient_id']||jsonb_build_object('eligibility_blocker',doctor_private.contact_eligibility(p_practice,p_location,p_patient,doctor_private.contact_intent(c,s)))order by s.purpose)from public.patient_contact_consents s where s.practice_id=c.practice_id and s.patient_id=c.patient_id and s.contact_id=c.id),'[]'))order by c.created_at desc,c.id),'[]')into contact_total,contacts from selected c;
 with cohort as materialized(select * from public.patient_guardian_relationships where practice_id=p_practice and patient_id=p_patient),selected as(select * from cohort order by created_at desc,id limit 20 offset p_guardian_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg((to_jsonb(g)-array['practice_id','patient_id'])||jsonb_build_object('can_review',writable and patient.archived_at is null and doctor_private.is_owner(p_practice),'can_revoke',writable and g.state<>'revoked','authority_mode','synthetic_review_only','live_authority',false)order by g.created_at desc,g.id),'[]')into guardian_total,guardians from selected g;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'patient_id',p_patient,'patient_name',patient.display_name,'patient_archived',patient.archived_at is not null,'timezone',place.timezone,'location_version',place.version,'observed_at',statement_timestamp(),
 'can_write',writable and patient.archived_at is null,'can_reduce',writable,'can_review',writable and patient.archived_at is null and doctor_private.is_owner(p_practice),'contact_page',p_contact_page,'contact_total',contact_total,'contacts',contacts,'guardian_page',p_guardian_page,'guardian_total',guardian_total,'guardians',guardians,'data_mode','synthetic','external_messages','disabled','legal_approval',false);
end $$;
create function doctor_private.contact_guardian_options(p_practice uuid,p_location uuid,p_patient uuid,p_page integer,p_search text)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;total bigint;
begin
 perform doctor_private.contact_scope(p_practice,p_location,p_patient,true);
 if p_page is null or p_page not between 0 and 100000 or p_search is null or length(p_search)>100 then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 with cohort as materialized(select * from public.patient_guardian_relationships where practice_id=p_practice and patient_id=p_patient and state='reviewed'and expires_at>clock_timestamp()and(label ilike'%'||replace(replace(replace(p_search,E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%')),selected as(select * from cohort order by label,id limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg(jsonb_build_object('id',g.id,'label',g.label,'relationship',g.relationship,'version',g.version,'expires_at',g.expires_at,'purposes',g.purposes)order by g.label,g.id),'[]')into total,rows from selected g;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'patient_id',p_patient,'page',p_page,'total',total,'rows',rows);
end $$;
create function doctor_private.contact_history(p_practice uuid,p_location uuid,p_patient uuid,p_kind text,p_record uuid,p_page integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;total bigint;
begin
 perform doctor_private.contact_scope(p_practice,p_location,p_patient);
 if p_record is null or p_kind is null or p_kind not in('contact','guardian','consent')or p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 if not exists(select 1 from public.patient_contact_events where practice_id=p_practice and patient_id=p_patient and record_kind=p_kind and record_id=p_record)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 with cohort as materialized(select * from public.patient_contact_events where practice_id=p_practice and patient_id=p_patient and record_kind=p_kind and record_id=p_record),selected as(select * from cohort order by record_version desc limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg((to_jsonb(e)-'id')||jsonb_build_object('id',e.id::text)order by e.record_version desc),'[]')into total,rows from selected e;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'patient_id',p_patient,'record_kind',p_kind,'record_id',p_record,'page',p_page,'total',total,'events',rows);
end $$;
create function doctor_private.contact_command(p_practice uuid,p_location uuid,p_patient uuid,p_record uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;kind text;next_version integer;request jsonb;result jsonb;prior doctor_private.command_receipts;channel public.patient_contact_channels;guardian public.patient_guardian_relationships;consent public.patient_contact_consents;patient public.practice_patients;source text;destination text;instant timestamptz;review_purposes text[];details jsonb:='{}';review_guardian uuid;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));actor:=doctor_private.current_actor();
 perform 1 from public.memberships m join public.membership_locations ml on ml.practice_id=m.practice_id and ml.membership_id=m.id where m.practice_id=p_practice and m.user_id=actor and ml.location_id=p_location order by m.id for share of m,ml;
 perform doctor_private.contact_scope(p_practice,p_location,p_patient,true);
 if p_record is null or p_key is null or p_expected_version is null or p_expected_version<0 or p_action is null or p_action not in('create_contact','revoke_contact','create_guardian','review_guardian','revoke_guardian','grant_consent','revoke_consent')then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 select * into patient from public.practice_patients where practice_id=p_practice and id=p_patient for share;
 if patient.archived_at is not null and p_action not in('revoke_contact','revoke_guardian','revoke_consent')then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 kind:=case when p_action like'%guardian'then'guardian'when p_action like'%consent'then'consent'else'contact'end;
 if p_action in('create_contact','create_guardian')and p_expected_version<>0 then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 if kind='guardian'and p_action<>'create_guardian'then
  select * into guardian from public.patient_guardian_relationships where practice_id=p_practice and patient_id=p_patient and id=p_record for update;
  if guardian.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 elsif kind='contact'and p_action<>'create_contact'then
  select * into channel from public.patient_contact_channels where practice_id=p_practice and patient_id=p_patient and id=p_record for update;
  if channel.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 elsif kind='consent'and p_expected_version>0 then
  select * into consent from public.patient_contact_consents where practice_id=p_practice and patient_id=p_patient and id=p_record for update;
  if consent.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 if p_action='create_contact'then
  perform doctor_private.contact_shape(p_input,array['channel','destination','recipient_kind','guardian_id']);destination:=doctor_private.contact_text(p_input->'destination',254);
  if jsonb_typeof(p_input->'channel')is distinct from'string'or p_input->>'channel'not in('email','sms')or jsonb_typeof(p_input->'recipient_kind')is distinct from'string'or p_input->>'recipient_kind'not in('patient','guardian')
   or(p_input->>'channel'='email'and destination!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')or(p_input->>'channel'='sms'and destination!~'^\+[1-9][0-9]{6,14}$')
   or(p_input->>'recipient_kind'='patient'and p_input->'guardian_id'<>'null'::jsonb)or(p_input->>'recipient_kind'='guardian'and jsonb_typeof(p_input->'guardian_id')is distinct from'string')then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
  review_guardian:=(p_input->>'guardian_id')::uuid;
 elsif p_action='create_guardian'then
  perform doctor_private.contact_shape(p_input,array['label','relationship','source_ref']);perform doctor_private.contact_text(p_input->'label',160);source:=doctor_private.contact_text(p_input->'source_ref');
  if jsonb_typeof(p_input->'relationship')is distinct from'string'or p_input->>'relationship'not in('parent','guardian','representative')then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 elsif p_action='review_guardian'then
  if not doctor_private.is_owner(p_practice)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  perform doctor_private.contact_shape(p_input,array['purposes','source_ref','expiry_day','expiry_minute','location_version']);source:=doctor_private.contact_text(p_input->'source_ref');
  if jsonb_typeof(p_input->'purposes')is distinct from'array'or jsonb_array_length(p_input->'purposes')not between 1 and 3 or exists(select 1 from jsonb_array_elements(p_input->'purposes')v where jsonb_typeof(v)is distinct from'string')then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
  select array_agg(value order by value)into review_purposes from jsonb_array_elements_text(p_input->'purposes');
  if not review_purposes<@array['appointment_reminder','administrative_follow_up','marketing']::text[]or cardinality(review_purposes)<>(select count(distinct value)from unnest(review_purposes)value)then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 elsif p_action='grant_consent'then
  perform doctor_private.contact_shape(p_input,array['contact_id','contact_version','purpose','source_ref','source_day','source_minute','location_version']);source:=doctor_private.contact_text(p_input->'source_ref');
  if jsonb_typeof(p_input->'contact_id')is distinct from'string'or jsonb_typeof(p_input->'purpose')is distinct from'string'or p_input->>'purpose'not in('appointment_reminder','administrative_follow_up','marketing')or jsonb_typeof(p_input->'contact_version')is distinct from'number'or(p_input->>'contact_version')!~'^[1-9][0-9]{0,9}$'then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
  select * into channel from public.patient_contact_channels where practice_id=p_practice and patient_id=p_patient and id=(p_input->>'contact_id')::uuid for share;
  if channel.id is null or channel.state<>'active'then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  if channel.version<>(p_input->>'contact_version')::integer then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
  if consent.id is not null and(consent.contact_id<>channel.id or consent.purpose<>p_input->>'purpose')then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
  review_guardian:=channel.guardian_id;
 else
  perform doctor_private.contact_shape(p_input,array['source_ref']);source:=doctor_private.contact_text(p_input->'source_ref');
  if p_expected_version<1 then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
 end if;
 if review_guardian is not null then
  select * into guardian from public.patient_guardian_relationships where practice_id=p_practice and patient_id=p_patient and id=review_guardian for share;
  if guardian.id is null or guardian.state<>'reviewed'or guardian.expires_at<=clock_timestamp()or(p_action='grant_consent'and not(p_input->>'purpose')=any(guardian.purposes))then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 perform doctor_private.contact_scope(p_practice,p_location,p_patient,true);
 request:=jsonb_build_object('command','contact.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'patient',p_patient,'record',p_record,'version',p_expected_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='create_contact'then
  insert into public.patient_contact_channels(practice_id,patient_id,id,location_id,recipient_kind,guardian_id,channel,destination,created_by)values(p_practice,p_patient,p_record,p_location,p_input->>'recipient_kind',review_guardian,p_input->>'channel',destination,actor)returning * into channel;
  next_version:=1;details:=jsonb_build_object('recipient_kind',channel.recipient_kind,'guardian_id',channel.guardian_id,'channel',channel.channel,'state','active','consent_created',false);
 elsif p_action='create_guardian'then
  insert into public.patient_guardian_relationships(practice_id,patient_id,id,location_id,label,relationship,source_ref,created_by,updated_by)values(p_practice,p_patient,p_record,p_location,btrim(p_input->>'label'),p_input->>'relationship',source,actor,actor)returning * into guardian;
  next_version:=1;details:=jsonb_build_object('state','pending','source_ref',source,'authority_mode','synthetic_review_only','live_authority',false);
 elsif p_action in('review_guardian','revoke_guardian')then
  if guardian.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
  if p_action='review_guardian'then
   instant:=doctor_private.contact_clock(p_practice,p_location,p_input,'expiry_day','expiry_minute');
   if instant<=clock_timestamp()or instant>clock_timestamp()+interval'365 days'then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
   update public.patient_guardian_relationships set state='reviewed',version=version+1,purposes=review_purposes,review_source_ref=source,reviewed_by=actor,reviewed_at=clock_timestamp(),expires_at=instant,updated_by=actor,updated_at=clock_timestamp()where practice_id=p_practice and id=p_record returning * into guardian;
  else
   if guardian.state='revoked'then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
   update public.patient_guardian_relationships set state='revoked',version=version+1,updated_by=actor,updated_at=clock_timestamp()where practice_id=p_practice and id=p_record returning * into guardian;
  end if;
  next_version:=guardian.version;details:=jsonb_build_object('state',guardian.state,'purposes',guardian.purposes,'expires_at',guardian.expires_at,'source_ref',source,'authority_mode','synthetic_review_only','live_authority',false);
 elsif p_action='revoke_contact'then
  if channel.version<>p_expected_version or channel.state='revoked'then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
  update public.patient_contact_channels set state='revoked',version=version+1,revoked_by=actor,revoked_at=clock_timestamp()where practice_id=p_practice and id=p_record returning * into channel;
  next_version:=channel.version;details:=jsonb_build_object('state','revoked','source_ref',source);
 elsif p_action='grant_consent'then
  if(consent.id is null and p_expected_version<>0)or(consent.id is not null and consent.version<>p_expected_version)then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
  instant:=doctor_private.contact_clock(p_practice,p_location,p_input,'source_day','source_minute');
  if instant>clock_timestamp()or instant<'1900-01-01'::timestamptz then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';end if;
  if consent.id is null then
   insert into public.patient_contact_consents(practice_id,patient_id,id,contact_id,purpose,allowed,version,contact_version,guardian_version,source_ref,source_time,recorded_by)values(p_practice,p_patient,p_record,channel.id,p_input->>'purpose',true,1,channel.version,case when review_guardian is not null then guardian.version end,source,instant,actor)returning * into consent;
  else
   update public.patient_contact_consents set allowed=true,version=version+1,contact_version=channel.version,guardian_version=case when review_guardian is not null then guardian.version end,source_ref=source,source_time=instant,recorded_by=actor,recorded_at=clock_timestamp(),revoked_at=null where practice_id=p_practice and id=p_record returning * into consent;
  end if;
  next_version:=consent.version;details:=jsonb_build_object('contact_id',consent.contact_id,'purpose',consent.purpose,'allowed',true,'source_ref',source,'source_time',instant,'contact_version',consent.contact_version,'guardian_version',consent.guardian_version);
 else
  if consent.id is null or consent.version<>p_expected_version or not consent.allowed then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';end if;
  update public.patient_contact_consents set allowed=false,version=version+1,source_ref=source,source_time=clock_timestamp(),recorded_by=actor,recorded_at=clock_timestamp(),revoked_at=clock_timestamp()where practice_id=p_practice and id=p_record returning * into consent;
  next_version:=consent.version;details:=jsonb_build_object('contact_id',consent.contact_id,'purpose',consent.purpose,'allowed',false,'source_ref',source,'source_time',consent.source_time);
 end if;
 insert into public.patient_contact_events(practice_id,patient_id,location_id,record_kind,record_id,record_version,action,actor_user_id,details)values(p_practice,p_patient,p_location,kind,p_record,next_version,p_action,actor,details);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'contact.'||p_action,p_record,jsonb_build_object('location_id',p_location,'record_kind',kind,'version',next_version,'external_messages','disabled'));
 result:=jsonb_build_object('record_id',p_record,'record_kind',kind,'version',next_version,'external_messages','disabled');insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when unique_violation then raise exception using errcode='40001',message='DOCTOR_CONTACT_CONFLICT';
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_CONTACT_INVALID';
end $$;
create function doctor_private.check_contact_eligibility(p_practice uuid,p_location uuid,p_patient uuid,p_intent jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$declare blocker text;begin perform doctor_private.contact_scope(p_practice,p_location,p_patient);blocker:=doctor_private.contact_eligibility(p_practice,p_location,p_patient,p_intent);return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'patient_id',p_patient,'intent',p_intent,'observed_at',statement_timestamp(),'eligible',blocker is null,'blocker',blocker,'data_mode','synthetic','external_messages','disabled','legal_approval',false);end $$;
create function public.doctor_contact_preferences(p_practice uuid,p_location uuid,p_patient uuid,p_contact_page integer,p_guardian_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.contact_directory(p_practice,p_location,p_patient,p_contact_page,p_guardian_page)$$;
create function public.doctor_contact_guardian_options(p_practice uuid,p_location uuid,p_patient uuid,p_page integer,p_search text)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.contact_guardian_options(p_practice,p_location,p_patient,p_page,p_search)$$;
create function public.doctor_contact_history(p_practice uuid,p_location uuid,p_patient uuid,p_kind text,p_record uuid,p_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.contact_history(p_practice,p_location,p_patient,p_kind,p_record,p_page)$$;
create function public.doctor_contact_eligibility(p_practice uuid,p_location uuid,p_patient uuid,p_intent jsonb)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.check_contact_eligibility(p_practice,p_location,p_patient,p_intent)$$;
create function public.doctor_contact_command(p_practice uuid,p_location uuid,p_patient uuid,p_record uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.contact_command(p_practice,p_location,p_patient,p_record,p_expected_version,p_action,p_input,p_key)$$;
revoke all on function doctor_private.contact_history_immutable(),doctor_private.contact_shape(jsonb,text[]),doctor_private.contact_text(jsonb,integer),doctor_private.contact_scope(uuid,uuid,uuid,boolean),doctor_private.contact_clock(uuid,uuid,jsonb,text,text),doctor_private.contact_eligibility(uuid,uuid,uuid,jsonb),doctor_private.contact_intent(public.patient_contact_channels,public.patient_contact_consents)from public,anon,authenticated,service_role;
revoke all on function doctor_private.contact_directory(uuid,uuid,uuid,integer,integer),doctor_private.contact_guardian_options(uuid,uuid,uuid,integer,text),doctor_private.contact_history(uuid,uuid,uuid,text,uuid,integer),doctor_private.check_contact_eligibility(uuid,uuid,uuid,jsonb),doctor_private.contact_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_contact_preferences(uuid,uuid,uuid,integer,integer),public.doctor_contact_guardian_options(uuid,uuid,uuid,integer,text),public.doctor_contact_history(uuid,uuid,uuid,text,uuid,integer),public.doctor_contact_eligibility(uuid,uuid,uuid,jsonb),public.doctor_contact_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.contact_directory(uuid,uuid,uuid,integer,integer),doctor_private.contact_guardian_options(uuid,uuid,uuid,integer,text),doctor_private.contact_history(uuid,uuid,uuid,text,uuid,integer),doctor_private.check_contact_eligibility(uuid,uuid,uuid,jsonb),doctor_private.contact_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_contact_preferences(uuid,uuid,uuid,integer,integer),public.doctor_contact_guardian_options(uuid,uuid,uuid,integer,text),public.doctor_contact_history(uuid,uuid,uuid,text,uuid,integer),public.doctor_contact_eligibility(uuid,uuid,uuid,jsonb),public.doctor_contact_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid)to authenticated;
