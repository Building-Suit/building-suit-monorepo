-- DOS-M3-004: finite synthetic administrative work, with no clinical text or delivery authority.
create or replace function doctor_private.administrative_capabilities()returns text[]
language sql immutable set search_path=''as $$select array['dashboard.read','locations.read','locations.manage','patients.read','patients.write','documents.read','documents.write','availability.manage','appointments.read','appointments.write','queue.manage','audit.read','worklists.read','worklists.manage']::text[]$$;
create or replace function doctor_private.edition_capabilities()returns text[]
language plpgsql stable security definer set search_path=''as $$
declare selected text:=doctor_private.edition_mode();result text[];
begin
 select coalesce(array_agg(cap order by ordinal),'{}'::text[])into result from unnest(doctor_private.administrative_capabilities())with ordinality item(cap,ordinal)
 where selected='synthetic_preview'or cap not in('documents.read','documents.write','worklists.read','worklists.manage');return result;
end $$;
create table public.administrative_tasks(
 practice_id uuid not null references public.practices(id),id uuid not null,location_id uuid not null,
 patient_id uuid,kind text not null check(kind in('appointment_follow_up','contact_preference_review','document_receipt_check','general_administration')),
 assignee_user_id uuid not null references auth.users(id),due_at timestamptz not null,timezone text not null,location_name text not null,captured_location_version integer not null check(captured_location_version>0),
 state text not null check(state in('assigned','in_progress','completed','cancelled')),version integer not null default 1 check(version>0),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),updated_by uuid not null references auth.users(id),updated_at timestamptz not null default clock_timestamp(),
 completed_by uuid references auth.users(id),completed_at timestamptz,
 primary key(practice_id,id),foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),
 check((state='completed'and completed_by is not null and completed_at is not null)or(state<>'completed'and completed_by is null and completed_at is null))
);
create index administrative_tasks_scope_due on public.administrative_tasks(practice_id,location_id,due_at,id);
create index administrative_tasks_assignee on public.administrative_tasks(assignee_user_id,practice_id,location_id);
create table public.administrative_task_events(
 id bigint generated always as identity primary key,practice_id uuid not null,task_id uuid not null,location_id uuid not null,
 actor_user_id uuid not null references auth.users(id),action text not null check(action in('create','start','complete','reassign','cancel')),
 record_version integer not null check(record_version>0),previous_assignee uuid references auth.users(id),next_assignee uuid not null references auth.users(id),
 previous_state text,state text not null,reason text not null check(reason in('created','started','completed','workload','absence','correction','no_longer_needed')),
 happened_at timestamptz not null default clock_timestamp(),foreign key(practice_id,task_id)references public.administrative_tasks(practice_id,id),
 foreign key(practice_id,location_id)references public.locations(practice_id,id),unique(practice_id,task_id,record_version)
);
create index administrative_task_events_actor on public.administrative_task_events(actor_user_id);
alter table public.administrative_tasks enable row level security;
alter table public.administrative_task_events enable row level security;
revoke all on public.administrative_tasks,public.administrative_task_events from public,anon,authenticated,service_role;
revoke all on sequence public.administrative_task_events_id_seq from public,anon,authenticated,service_role;
create trigger administrative_task_history_immutable before update or delete or truncate on public.administrative_task_events for each statement execute function doctor_private.edition_event_immutable();
create function doctor_private.worklist_scope(p_practice uuid,p_location uuid,p_manage boolean default false)returns void
language plpgsql stable security definer set search_path=''as $$
begin
 perform doctor_private.current_actor();
 if doctor_private.edition_mode()<>'synthetic_preview'or not exists(select 1 from public.locations where practice_id=p_practice and id=p_location and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 perform doctor_private.require_access(p_practice,'worklists.read',p_location);
 if p_manage then perform doctor_private.require_access(p_practice,'worklists.manage',p_location);end if;
end $$;
-- Assignment eligibility is independent of whether the assignee is currently signed in.
-- Location overrides use the same coalesce policy as has_access, never grant union.
create function doctor_private.worklist_assignee(p_practice uuid,p_location uuid,p_user uuid,p_patient boolean)returns boolean
language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.practices where id=p_practice and owner_user_id=p_user)
 or exists(select 1 from public.memberships m join public.membership_locations ml on ml.practice_id=m.practice_id and ml.membership_id=m.id
 where m.practice_id=p_practice and m.user_id=p_user and m.status='active'and ml.location_id=p_location
 and 'worklists.read'=any(coalesce(ml.capabilities,m.capabilities))and(not p_patient or 'patients.read'=any(coalesce(ml.capabilities,m.capabilities))))
$$;
create function doctor_private.worklist_projection(t public.administrative_tasks,p_actor uuid,p_manage boolean,p_patient boolean,p_observed timestamptz)returns jsonb
language sql stable security definer set search_path=''as $$
 select jsonb_build_object('id',t.id,'kind',t.kind,'patient_id',case when p_patient then t.patient_id end,
 'patient_name',case when p_patient then(select display_name from public.practice_patients where practice_id=t.practice_id and id=t.patient_id)end,
 'assignee_user_id',t.assignee_user_id,'due_at',t.due_at,'timezone',t.timezone,'location_name',t.location_name,'captured_location_version',t.captured_location_version,
 'state',t.state,'version',t.version,'overdue',t.state in('assigned','in_progress')and t.due_at<p_observed,
 'blocked',not doctor_private.worklist_assignee(t.practice_id,t.location_id,t.assignee_user_id,t.patient_id is not null)or(t.patient_id is not null and(not p_patient or not exists(select 1 from public.practice_patients where practice_id=t.practice_id and id=t.patient_id and archived_at is null))),
 'can_start',t.state='assigned'and t.assignee_user_id=p_actor and doctor_private.worklist_assignee(t.practice_id,t.location_id,t.assignee_user_id,t.patient_id is not null)and(t.patient_id is null or(p_patient and exists(select 1 from public.practice_patients where practice_id=t.practice_id and id=t.patient_id and archived_at is null))),
 'can_complete',t.state in('assigned','in_progress')and t.assignee_user_id=p_actor and doctor_private.worklist_assignee(t.practice_id,t.location_id,t.assignee_user_id,t.patient_id is not null)and(t.patient_id is null or(p_patient and exists(select 1 from public.practice_patients where practice_id=t.practice_id and id=t.patient_id and archived_at is null))),
 'can_reassign',p_manage and t.state in('assigned','in_progress')and(t.patient_id is null or(p_patient and exists(select 1 from public.practice_patients where practice_id=t.practice_id and id=t.patient_id and archived_at is null))),
 'can_cancel',p_manage and t.state in('assigned','in_progress'))
$$;
create function doctor_private.read_worklist(p_practice uuid,p_location uuid,p_page integer,p_state text,p_mine boolean,p_overdue boolean)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();manager boolean;patients boolean;observed timestamptz:=statement_timestamp();rows jsonb;total bigint;place public.locations;
begin
 perform doctor_private.worklist_scope(p_practice,p_location);
 if p_page is null or p_page not between 0 and 100000 or p_state is null or p_state not in('all','assigned','in_progress','completed','cancelled')or p_mine is null or p_overdue is null then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
 manager:=doctor_private.has_access(p_practice,'worklists.manage',p_location);patients:=doctor_private.has_access(p_practice,'patients.read',p_location);
 select * into place from public.locations where practice_id=p_practice and id=p_location;
 with cohort as materialized(select * from public.administrative_tasks where practice_id=p_practice and location_id=p_location
 and(manager or assignee_user_id=actor)and(not p_mine or assignee_user_id=actor)and(p_state='all'or state=p_state)
 and(not p_overdue or(state in('assigned','in_progress')and due_at<observed))),
 selected as(select * from cohort order by due_at,id limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg(doctor_private.worklist_projection(s,actor,manager,patients,observed)order by due_at,id),'[]')into total,rows from selected s;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'page',p_page,'total',total,'rows',rows,'can_manage',manager,'can_read_patients',patients,'timezone',place.timezone,'location_version',place.version,'observed_at',observed,'data_mode','synthetic','external_messages','disabled');
end $$;
create function doctor_private.worklist_options(p_practice uuid,p_location uuid)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;
begin
 perform doctor_private.worklist_scope(p_practice,p_location,true);
 select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'label',d.display_name,'can_read_patients',doctor_private.worklist_assignee(p_practice,p_location,a.user_id,true))order by a.user_id),'[]')into rows
 from(select owner_user_id user_id from public.practices where id=p_practice union select m.user_id from public.memberships m join public.membership_locations ml on ml.practice_id=m.practice_id and ml.membership_id=m.id where m.practice_id=p_practice and ml.location_id=p_location and m.status='active'and doctor_private.worklist_assignee(p_practice,p_location,m.user_id,false))a
 left join public.doctor_profiles d on d.user_id=a.user_id;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'assignees',rows);
end $$;
create function doctor_private.worklist_history(p_practice uuid,p_location uuid,p_task uuid,p_page integer)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();rows jsonb;total bigint;
begin
 perform doctor_private.worklist_scope(p_practice,p_location);
 if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
 if not exists(select 1 from public.administrative_tasks where practice_id=p_practice and location_id=p_location and id=p_task and(assignee_user_id=actor or doctor_private.has_access(p_practice,'worklists.manage',p_location)))then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 with cohort as materialized(select * from public.administrative_task_events where practice_id=p_practice and location_id=p_location and task_id=p_task),selected as(select * from cohort order by record_version desc limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg((to_jsonb(s)-'id')||jsonb_build_object('id',s.id::text)order by record_version desc),'[]')into total,rows from selected s;
 return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'task_id',p_task,'page',p_page,'total',total,'events',rows);
end $$;
create function doctor_private.worklist_command(p_practice uuid,p_location uuid,p_task uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;item public.administrative_tasks;previous public.administrative_tasks;request jsonb;prior doctor_private.command_receipts;result jsonb;place public.locations;target uuid;patient uuid;reason text;due timestamptz;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 actor:=doctor_private.current_actor();
 -- Coordinate concurrent grant and status updates even when those commands hold a different lock.
 perform 1 from public.memberships where practice_id=p_practice order by id for share;
 perform 1 from public.membership_locations where practice_id=p_practice order by membership_id,location_id for share;
 perform doctor_private.worklist_scope(p_practice,p_location,p_action in('create','reassign','cancel'));
 if p_key is null or p_task is null or p_expected_version is null or p_action is null or p_action not in('create','reassign','start','complete','cancel')or jsonb_typeof(p_input)is distinct from'object'then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
 if p_action='create'then
  if p_expected_version<>0 or not p_input?&array['kind','patient_id','assignee_user_id','due_day','due_minute','location_version']or p_input-array['kind','patient_id','assignee_user_id','due_day','due_minute','location_version']<>'{}'
   or jsonb_typeof(p_input->'kind')is distinct from'string'or p_input->>'kind'not in('appointment_follow_up','contact_preference_review','document_receipt_check','general_administration')
   or jsonb_typeof(p_input->'assignee_user_id')is distinct from'string'or(jsonb_typeof(p_input->'patient_id')not in('null','string'))
   or jsonb_typeof(p_input->'due_day')is distinct from'string'or(p_input->>'due_day')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or exists(select 1 from unnest(array['due_minute','location_version'])k where jsonb_typeof(p_input->k)is distinct from'number'or(p_input->>k)!~'^[0-9]{1,10}$')then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
  target:=(p_input->>'assignee_user_id')::uuid;patient:=(p_input->>'patient_id')::uuid;reason:='created';
 else
  if p_expected_version<1 then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
  select * into item from public.administrative_tasks where practice_id=p_practice and location_id=p_location and id=p_task for update;
  if item.id is null or(not doctor_private.has_access(p_practice,'worklists.manage',p_location)and item.assignee_user_id<>actor)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  previous:=item;target:=item.assignee_user_id;patient:=item.patient_id;
  if p_action='reassign'then
   if not p_input?&array['assignee_user_id','reason']or p_input-array['assignee_user_id','reason']<>'{}'or jsonb_typeof(p_input->'assignee_user_id')is distinct from'string'or p_input->>'reason'not in('workload','absence','correction')or jsonb_typeof(p_input->'reason')is distinct from'string'then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
   target:=(p_input->>'assignee_user_id')::uuid;reason:=p_input->>'reason';
  elsif p_action='cancel'then
   if p_input<>jsonb_build_object('reason','no_longer_needed')then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;reason:='no_longer_needed';
  else
   if p_input<>'{}'then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;reason:=case when p_action='start'then'started'else'completed'end;
   if item.assignee_user_id<>actor then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  end if;
 end if;
 if patient is not null and p_action<>'cancel'then
  perform doctor_private.require_access(p_practice,'patients.read',p_location);
  perform 1 from public.practice_patients where practice_id=p_practice and id=patient and archived_at is null for share;
  if not found then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 end if;
 if p_action<>'cancel'and not doctor_private.worklist_assignee(p_practice,p_location,target,patient is not null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 -- Check current session and grants after lock waits, before any receipt replay.
 perform doctor_private.worklist_scope(p_practice,p_location,p_action in('create','reassign','cancel'));
 request:=jsonb_build_object('command','worklist.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'task',p_task,'version',p_expected_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='create'then
  select * into place from public.locations where practice_id=p_practice and id=p_location for share;
  due:=doctor_private.schedule_clock((p_input->>'due_day')::date,(p_input->>'due_minute')::integer,place.timezone);
  if place.version<>(p_input->>'location_version')::integer then raise exception using errcode='40001',message='DOCTOR_WORKLIST_CONFLICT';end if;
  if due is null or(p_input->>'due_minute')::integer not between 0 and 1439 or(p_input->>'due_day')::date not between(clock_timestamp()at time zone place.timezone)::date and(clock_timestamp()at time zone place.timezone)::date+365 then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';end if;
  insert into public.administrative_tasks(practice_id,id,location_id,patient_id,kind,assignee_user_id,due_at,timezone,location_name,captured_location_version,state,created_by,updated_by)
  values(p_practice,p_task,p_location,patient,p_input->>'kind',target,due,place.timezone,place.name,place.version,'assigned',actor,actor)returning * into item;
 else
  if item.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_WORKLIST_CONFLICT';end if;
  if item.state not in('assigned','in_progress')or(p_action='start'and item.state<>'assigned')or(p_action='reassign'and target=item.assignee_user_id)then raise exception using errcode='22023',message='DOCTOR_WORKLIST_TRANSITION_DENIED';end if;
  update public.administrative_tasks set assignee_user_id=target,state=case p_action when'reassign'then'assigned'when'start'then'in_progress'when'complete'then'completed'else'cancelled'end,version=version+1,updated_by=actor,updated_at=clock_timestamp(),completed_by=case when p_action='complete'then actor end,completed_at=case when p_action='complete'then clock_timestamp()end
  where practice_id=p_practice and id=p_task returning * into item;
 end if;
 insert into public.administrative_task_events(practice_id,task_id,location_id,actor_user_id,action,record_version,previous_assignee,next_assignee,previous_state,state,reason)
 values(p_practice,p_task,p_location,actor,p_action,item.version,previous.assignee_user_id,target,previous.state,item.state,reason);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'worklist.'||p_action,p_task,jsonb_build_object('location_id',p_location,'version',item.version,'state',item.state,'external_messages','disabled'));
 result:=jsonb_build_object('task_id',p_task,'version',item.version,'state',item.state,'external_messages','disabled');
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when unique_violation then raise exception using errcode='40001',message='DOCTOR_WORKLIST_CONFLICT';
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_WORKLIST_INVALID';
end $$;
create function public.doctor_worklist(p_practice uuid,p_location uuid,p_page integer,p_state text,p_mine boolean,p_overdue boolean)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.read_worklist(p_practice,p_location,p_page,p_state,p_mine,p_overdue)$$;
create function public.doctor_worklist_options(p_practice uuid,p_location uuid)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.worklist_options(p_practice,p_location)$$;
create function public.doctor_worklist_history(p_practice uuid,p_location uuid,p_task uuid,p_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.worklist_history(p_practice,p_location,p_task,p_page)$$;
create function public.doctor_worklist_command(p_practice uuid,p_location uuid,p_task uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.worklist_command(p_practice,p_location,p_task,p_expected_version,p_action,p_input,p_key)$$;
revoke all on function doctor_private.worklist_scope(uuid,uuid,boolean),doctor_private.worklist_assignee(uuid,uuid,uuid,boolean),doctor_private.worklist_projection(public.administrative_tasks,uuid,boolean,boolean,timestamptz)from public,anon,authenticated,service_role;
revoke all on function doctor_private.read_worklist(uuid,uuid,integer,text,boolean,boolean),doctor_private.worklist_options(uuid,uuid),doctor_private.worklist_history(uuid,uuid,uuid,integer),doctor_private.worklist_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_worklist(uuid,uuid,integer,text,boolean,boolean),public.doctor_worklist_options(uuid,uuid),public.doctor_worklist_history(uuid,uuid,uuid,integer),public.doctor_worklist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.read_worklist(uuid,uuid,integer,text,boolean,boolean),doctor_private.worklist_options(uuid,uuid),doctor_private.worklist_history(uuid,uuid,uuid,integer),doctor_private.worklist_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_worklist(uuid,uuid,integer,text,boolean,boolean),public.doctor_worklist_options(uuid,uuid),public.doctor_worklist_history(uuid,uuid,uuid,integer),public.doctor_worklist_command(uuid,uuid,uuid,integer,text,jsonb,uuid)to authenticated;

create or replace function doctor_private.location_archive_blockers(p_practice uuid,p_location uuid)returns jsonb
language sql stable security invoker set search_path='' as $$
 select(select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','upcoming_appointments','count',count(*)))else'[]'::jsonb end from public.appointments
  where practice_id=p_practice and location_id=p_location and(state in('checked_in','in_progress')or(state='booked'and ends_at>clock_timestamp())) )
 ||(select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','active_waitlist_offers','count',count(*)))else'[]'::jsonb end
 from public.waitlist_offers o join public.waitlist_entries e on e.practice_id=o.practice_id and e.id=o.entry_id
 join public.practice_patients p on p.practice_id=e.practice_id and p.id=e.patient_id
 where o.practice_id=p_practice and o.location_id=p_location and o.state='offered'and o.expires_at>clock_timestamp()and e.contact_permission and p.archived_at is null)
 ||(select case when count(*)>0 then jsonb_build_array(jsonb_build_object('kind','active_administrative_tasks','count',count(*)))else'[]'::jsonb end from public.administrative_tasks where practice_id=p_practice and location_id=p_location and state in('assigned','in_progress'))
$$;
