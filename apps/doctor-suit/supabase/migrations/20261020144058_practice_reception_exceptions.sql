-- DOS-M3-003. Synthetic reception exceptions, never medical triage.
-- Legacy queue positions remain zero, retaining their arrival/id order.
alter table public.appointments add column queue_position bigint not null default 0 check(queue_position>=0);
create index appointments_reception_order on public.appointments(practice_id,location_id,queue_position,checked_in_at,id)where state in('checked_in','in_progress');
create function doctor_private.reception_queue_position()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 if new.state='checked_in'and(TG_OP='INSERT'or old.state<>'checked_in')then
  perform pg_advisory_xact_lock(hashtextextended(new.practice_id::text,1));
  select coalesce(max(queue_position),0)+1 into new.queue_position from public.appointments where practice_id=new.practice_id and location_id=new.location_id and state in('checked_in','in_progress');
 end if;
 return new;
end $$;
revoke all on function doctor_private.reception_queue_position()from public,anon,authenticated,service_role;
create trigger reception_queue_position before insert or update on public.appointments for each row execute function doctor_private.reception_queue_position();
create function doctor_private.reception_command(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path=''as $$
declare actor uuid;item public.appointments;previous public.appointments;prior doctor_private.command_receipts;request jsonb;result jsonb;reason text;place public.locations;booked jsonb;patient uuid;next_state text;position bigint;
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));
 perform doctor_private.operations_scope(p_practice,p_location,'appointments.write');perform doctor_private.require_access(p_practice,'queue.manage',p_location);perform doctor_private.require_access(p_practice,'patients.read',p_location);actor:=doctor_private.current_actor();
 if p_key is null or p_expected_version is null or p_action is null or p_action not in('late_check_in','reverse_no_show','queue_exit','move_to_end','walk_in')or jsonb_typeof(p_input)is distinct from'object'or jsonb_typeof(p_input->'reason')is distinct from'string'then raise exception using errcode='22023',message='DOCTOR_RECEPTION_INVALID';end if;
 reason:=doctor_private.appointment_reason(p_input->>'reason');
 if p_action='walk_in'then
  if p_appointment is not null or p_expected_version<>0 or not p_input?&array['patient_id','day','minute','schedule_version','location_version','type_id','type_version','reason']
   or p_input-array['patient_id','day','minute','schedule_version','location_version','type_id','type_version','reason']<>'{}'
   or jsonb_typeof(p_input->'day')is distinct from'string'or(p_input->>'day')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or exists(select 1 from unnest(array['minute','schedule_version','location_version'])k where jsonb_typeof(p_input->k)is distinct from'number'or(p_input->>k)!~'^[0-9]{1,10}$')
   or(p_input->>'type_id'is null)is distinct from(p_input->>'type_version'is null)
   or(p_input->>'type_id'is not null and(jsonb_typeof(p_input->'type_version')is distinct from'number'or(p_input->>'type_version')!~'^[1-9][0-9]{0,9}$'))then raise exception using errcode='22023',message='DOCTOR_RECEPTION_INVALID';end if;
  patient:=(p_input->>'patient_id')::uuid;
 else
  if p_appointment is null or p_expected_version<1 or p_input-array['reason']<>'{}'then raise exception using errcode='22023',message='DOCTOR_RECEPTION_INVALID';end if;
  select * into item from public.appointments where id=p_appointment and practice_id=p_practice and location_id=p_location for update;
  if item.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;patient:=item.patient_id;
 end if;
 -- Current identity/authority is checked even when returning an exact receipt.
 if not exists(select 1 from public.practice_patients where practice_id=p_practice and id=patient and archived_at is null)then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
 request:=jsonb_build_object('command','reception.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'appointment',p_appointment,'version',p_expected_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='walk_in'then
  select * into place from public.locations where practice_id=p_practice and id=p_location;
  if(p_input->>'day')::date<>(clock_timestamp()at time zone place.timezone)::date then raise exception using errcode='22023',message='DOCTOR_RECEPTION_SAME_DAY_REQUIRED';end if;
  if p_input->>'type_id'is null then
   booked:=doctor_private.book_appointment(p_practice,p_location,patient,(p_input->>'day')::date,(p_input->>'minute')::integer,(p_input->>'schedule_version')::integer,(p_input->>'location_version')::integer,gen_random_uuid());
  else
   booked:=doctor_private.book_consultation(p_practice,p_location,patient,(p_input->>'day')::date,(p_input->>'minute')::integer,(p_input->>'schedule_version')::integer,(p_input->>'location_version')::integer,gen_random_uuid(),(p_input->>'type_id')::uuid,(p_input->>'type_version')::integer);
  end if;
  perform doctor_private.transition_appointment(p_practice,p_location,(booked->>'appointment_id')::uuid,1,'checked_in','',gen_random_uuid());
  select * into item from public.appointments where id=(booked->>'appointment_id')::uuid;previous:=item;previous.state:='booked';
 else
  if item.version<>p_expected_version then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';end if;
  previous:=item;next_state:=item.state;position:=item.queue_position;
  if p_action='late_check_in'then
   if item.state<>'booked'or item.starts_at>clock_timestamp()or(item.starts_at at time zone item.timezone)::date<>(clock_timestamp()at time zone item.timezone)::date then raise exception using errcode='22023',message='DOCTOR_RECEPTION_TRANSITION_DENIED';end if;next_state:='checked_in';
  elsif p_action='reverse_no_show'then
   if item.state<>'no_show'then raise exception using errcode='22023',message='DOCTOR_RECEPTION_TRANSITION_DENIED';end if;next_state:='booked';
  elsif p_action='queue_exit'then
   if item.state<>'checked_in'then raise exception using errcode='22023',message='DOCTOR_RECEPTION_TRANSITION_DENIED';end if;next_state:='cancelled';
  else
   if item.state<>'checked_in'then raise exception using errcode='22023',message='DOCTOR_RECEPTION_TRANSITION_DENIED';end if;
   select coalesce(max(queue_position),0)+1 into position from public.appointments where practice_id=p_practice and location_id=p_location and state in('checked_in','in_progress');
  end if;
  update public.appointments set state=next_state,queue_position=position,version=version+1,updated_at=clock_timestamp(),checked_in_at=case when p_action='late_check_in'then clock_timestamp()else checked_in_at end where id=item.id returning * into item;
 end if;
 insert into public.appointment_events(practice_id,appointment_id,actor_user_id,location_id,event_type,record_version,details)
  values(p_practice,item.id,actor,p_location,'appointment.reception.'||p_action,item.version,jsonb_build_object('from',previous.state,'to',item.state,'reason',reason,'queue_from',previous.queue_position::text,'queue_to',item.queue_position::text,'queue_order','administrative_only','arrival_preserved',p_action='move_to_end','timezone',item.timezone));
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'appointment.reception.'||p_action,item.id,jsonb_build_object('location_id',p_location,'version',item.version,'from',previous.state,'to',item.state,'reason',reason,'medical_priority','not_assigned'));
 result:=jsonb_build_object('appointment_id',item.id,'version',item.version,'state',item.state,'queue_order','administrative_only','external_notifications','disabled');
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when exclusion_violation then raise exception using errcode='40001',message='DOCTOR_APPOINTMENT_CONFLICT';
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then raise exception using errcode='22023',message='DOCTOR_RECEPTION_INVALID';
end $$;
create function public.doctor_reception_command(p_practice uuid,p_location uuid,p_appointment uuid,p_expected_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.reception_command(p_practice,p_location,p_appointment,p_expected_version,p_action,p_input,p_key)$$;
revoke all on function doctor_private.reception_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_reception_command(uuid,uuid,uuid,integer,text,jsonb,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.reception_command(uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_reception_command(uuid,uuid,uuid,integer,text,jsonb,uuid)to authenticated;

create or replace function doctor_private.read_appointment_board(p_practice uuid,p_location uuid,p_day date,p_page integer,p_queue_page integer) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare place public.locations; items jsonb; queue_rows jsonb; total bigint; queue_total bigint; writable boolean;
begin
  perform doctor_private.appointment_scope(p_practice,p_location);
  writable:=(doctor_private.saas_entitlement_context(p_practice)->>'writes_allowed')::boolean;
  select * into place from public.locations where id=p_location and practice_id=p_practice;
  if p_day is null or p_day<(clock_timestamp() at time zone place.timezone)::date-365 or p_day>(clock_timestamp() at time zone place.timezone)::date+365
    or p_page is null or p_queue_page is null or p_page not between 0 and 100000 or p_queue_page not between 0 and 100000 then
    raise exception using errcode='22023',message='DOCTOR_APPOINTMENT_INVALID';
  end if;
  select count(*) into total from public.appointments where practice_id=p_practice and location_id=p_location and (starts_at at time zone place.timezone)::date=p_day;
  select coalesce(jsonb_agg(doctor_private.appointment_projection(a) order by a.starts_at,a.id),'[]') into items
    from(select * from public.appointments where practice_id=p_practice and location_id=p_location and (starts_at at time zone place.timezone)::date=p_day order by starts_at,id limit 20 offset p_page*20)a;
  select count(*) into queue_total from public.appointments where practice_id=p_practice and location_id=p_location and state in ('checked_in','in_progress');
  select coalesce(jsonb_agg(doctor_private.appointment_projection(a) order by a.queue_position,a.checked_in_at,a.id),'[]') into queue_rows
    from(select * from public.appointments where practice_id=p_practice and location_id=p_location and state in ('checked_in','in_progress') order by queue_position,checked_in_at,id limit 20 offset p_queue_page*20)a;
  return jsonb_build_object('practice_id',p_practice,'location_id',p_location,'date',p_day,'timezone',place.timezone,'location_version',place.version,
    'items',items,'page',p_page,'total',total,'queue',queue_rows,'queue_page',p_queue_page,'queue_total',queue_total,
    'revision',coalesce((select revision from public.appointment_queue_revisions where location_id=p_location),0),
    'can_write',doctor_private.has_access(p_practice,'appointments.write',p_location) and writable,
    'can_queue',doctor_private.has_access(p_practice,'queue.manage',p_location) and writable,
    'can_read_patients',doctor_private.has_access(p_practice,'patients.read',p_location),'external_notifications','disabled');
end $$;
