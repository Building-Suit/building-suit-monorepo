-- DOS-M3-006. No network transport, scheduler, service-role or callback grant.
create table public.message_outbox(
 practice_id uuid not null references public.practices(id), id uuid not null,
 location_id uuid not null, patient_id uuid not null, intent jsonb not null,
 consent_id uuid not null, recipient_kind text not null check(recipient_kind in('patient','guardian')),
 template text not null check(template in('appointment_reminder_v1','administrative_follow_up_v1','marketing_v1')),
 parameters jsonb not null default '{}' check(parameters='{}'),
 state text not null default 'queued' check(state in('queued','claimed','sent','delivered','failed','unknown')),
 version integer not null default 1 check(version>0),attempts integer not null default 0 check(attempts between 0 and 3),
 claim_token uuid,lease_until timestamptz,available_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null,blocker text check(blocker in('consent_unavailable','guardian_unavailable','contact_unavailable','patient_archived','clinic_archived','edition_disabled','expired','retry_exhausted','transport_rejected','transport_timeout','lease_expired','acceptance_unknown')),
 created_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,id), foreign key(practice_id,patient_id)references public.practice_patients(practice_id,id),
 foreign key(practice_id,location_id)references public.locations(practice_id,id),
 foreign key(practice_id,consent_id)references public.patient_contact_consents(practice_id,id)
);
create index message_outbox_scope on public.message_outbox(practice_id,location_id,created_at,id);
-- Transport acceptance survives a lost acknowledgement. Never equate it with delivery.
create table doctor_private.synthetic_message_acceptances(
 practice_id uuid not null,message_id uuid not null,claim_token uuid not null,receipt uuid not null default gen_random_uuid(),
 accepted_at timestamptz not null default clock_timestamp(),acknowledged_at timestamptz,delivered_at timestamptz,
 primary key(practice_id,message_id), unique(receipt),foreign key(practice_id,message_id)references public.message_outbox(practice_id,id)
);
create table public.message_outbox_events(
 practice_id uuid not null,message_id uuid not null,version integer not null,state text not null,blocker text,
 actor_user_id uuid not null references auth.users(id),happened_at timestamptz not null default clock_timestamp(),
 primary key(practice_id,message_id,version),foreign key(practice_id,message_id)references public.message_outbox(practice_id,id)
);
alter table public.message_outbox enable row level security;
alter table public.message_outbox_events enable row level security;
alter table doctor_private.synthetic_message_acceptances enable row level security;
revoke all on public.message_outbox,public.message_outbox_events,doctor_private.synthetic_message_acceptances from public,anon,authenticated,service_role;
create trigger message_events_immutable before update or delete on public.message_outbox_events for each row execute function doctor_private.contact_history_immutable();
create function doctor_private.outbox_projection(m public.message_outbox)returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id,'patient_id',m.patient_id,'state',m.state,'version',m.version,'attempts',m.attempts,'blocker',m.blocker,'purpose',m.intent->>'purpose','recipient_kind',m.recipient_kind,'template',m.template,'expires_at',m.expires_at,'created_at',m.created_at,'data_mode','synthetic','external_delivery',false)
$$;
create function doctor_private.outbox_command(p_practice uuid,p_location uuid,p_patient uuid,p_message uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;m public.message_outbox;prior doctor_private.command_receipts;request jsonb;result jsonb;denial text;channel public.patient_contact_channels;consent public.patient_contact_consents;acceptance doctor_private.synthetic_message_acceptances;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception using errcode='25000',message='DOCTOR_READ_COMMITTED_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_practice::text,1));actor:=doctor_private.current_actor();
 perform 1 from public.memberships mm join public.membership_locations ml on ml.practice_id=mm.practice_id and ml.membership_id=mm.id where mm.practice_id=p_practice and mm.user_id=actor and ml.location_id=p_location order by mm.id for share of mm,ml;
 perform doctor_private.contact_scope(p_practice,p_location,p_patient,true);
 if p_message is null or p_key is null or p_version is null or p_action is null or p_action not in('enqueue','claim','accept','acknowledge','deliver','reject','timeout','reconcile') then raise exception using errcode='22023',message='DOCTOR_OUTBOX_INVALID';end if;
 if p_action='enqueue' then
  perform doctor_private.contact_shape(p_input,array['intent','expires_at','template','parameters']);
  if p_version<>0 or p_input->'parameters' is distinct from '{}'::jsonb or p_input->>'template' is distinct from (p_input#>>'{intent,purpose}')||'_v1' or (p_input->>'expires_at')::timestamptz<=clock_timestamp() or (p_input->>'expires_at')::timestamptz>clock_timestamp()+interval '7 days' then raise exception using errcode='22023',message='DOCTOR_OUTBOX_INVALID';end if;
 else
  select * into m from public.message_outbox where practice_id=p_practice and location_id=p_location and patient_id=p_patient and id=p_message for update;
  if m.id is null then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
  if p_action in('claim','reconcile') then perform doctor_private.contact_shape(p_input,array[]::text[]);
  else perform doctor_private.contact_shape(p_input,case when p_action='deliver' then array['claim_token','receipt'] else array['claim_token'] end);end if;
 end if;
 request:=jsonb_build_object('command','outbox.'||p_action,'session',auth.jwt()->>'session_id','practice',p_practice,'location',p_location,'patient',p_patient,'message',p_message,'version',p_version,'input',p_input);
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;return prior.result;end if;
 if p_action='enqueue' then
  denial:=doctor_private.contact_eligibility(p_practice,p_location,p_patient,p_input->'intent');
  if denial is not null then raise exception using errcode='42501',message='DOCTOR_CONTACT_INELIGIBLE';end if;
  select * into channel from public.patient_contact_channels where practice_id=p_practice and patient_id=p_patient and id=(p_input#>>'{intent,contact_id}')::uuid;
  select * into consent from public.patient_contact_consents where practice_id=p_practice and patient_id=p_patient and contact_id=channel.id and purpose=p_input#>>'{intent,purpose}';
  insert into public.message_outbox(practice_id,id,location_id,patient_id,intent,consent_id,recipient_kind,template,parameters,expires_at,created_by)
   values(p_practice,p_message,p_location,p_patient,p_input->'intent',consent.id,channel.recipient_kind,p_input->>'template','{}',(p_input->>'expires_at')::timestamptz,actor) returning * into m;
 else
  if m.version<>p_version then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
  select * into acceptance from doctor_private.synthetic_message_acceptances where practice_id=p_practice and message_id=p_message for update;
  if p_action in('claim','accept') then
   denial:=doctor_private.contact_eligibility(p_practice,p_location,p_patient,m.intent);
   if m.expires_at<=clock_timestamp() then denial:='expired';end if;
  end if;
  if p_action='claim' then
   if m.state<>'queued' or m.available_at>clock_timestamp() then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
   if m.attempts>=3 then denial:='retry_exhausted';end if;
   m.state:=case when denial is null then 'claimed' else 'failed' end;m.blocker:=denial;
   if denial is null then m.attempts:=m.attempts+1;m.claim_token:=gen_random_uuid();m.lease_until:=clock_timestamp()+interval '1 minute';end if;
  elsif p_action='reconcile' then
   if m.state='claimed' and m.lease_until<=clock_timestamp() then m.state:='unknown';m.blocker:='lease_expired';
   elsif m.state='unknown' then
    if acceptance.message_id is not null then m.state:='sent';m.blocker:=null;update doctor_private.synthetic_message_acceptances set acknowledged_at=coalesce(acknowledged_at,clock_timestamp())where practice_id=p_practice and message_id=p_message;
    else m.blocker:='acceptance_unknown';end if;
   else raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
  else
   if (p_input->>'claim_token')::uuid is distinct from m.claim_token then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
   if p_action='deliver' then
    if m.state<>'sent' or acceptance.receipt is null or (p_input->>'receipt')::uuid is distinct from acceptance.receipt then raise exception using errcode='42501',message='DOCTOR_ACCESS_DENIED';end if;
    update doctor_private.synthetic_message_acceptances set delivered_at=clock_timestamp()where practice_id=p_practice and message_id=p_message;m.state:='delivered';m.blocker:=null;
   elsif p_action='acknowledge' then
    if m.state<>'claimed' or acceptance.message_id is null then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
    update doctor_private.synthetic_message_acceptances set acknowledged_at=clock_timestamp()where practice_id=p_practice and message_id=p_message;m.state:='sent';m.blocker:=null;
   else
    if m.state<>'claimed' or m.lease_until<=clock_timestamp() then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
    if p_action='accept' then
     if denial is not null and acceptance.message_id is null then m.state:='failed';m.blocker:=denial;
     else
      insert into doctor_private.synthetic_message_acceptances(practice_id,message_id,claim_token)values(p_practice,p_message,m.claim_token)on conflict(practice_id,message_id)do nothing;
     end if;
    elsif p_action='timeout' then m.state:='unknown';m.blocker:='transport_timeout';
    elsif p_action='reject' then
     if acceptance.message_id is not null then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';end if;
     m.state:=case when m.attempts<3 then 'queued' else 'failed' end;m.blocker:=case when m.attempts<3 then 'transport_rejected' else 'retry_exhausted' end;m.available_at:=clock_timestamp()+make_interval(secs=>m.attempts*30);
    end if;
   end if;
  end if;
  m.version:=m.version+1;
  update public.message_outbox set state=m.state,version=m.version,attempts=m.attempts,claim_token=m.claim_token,lease_until=m.lease_until,available_at=m.available_at,blocker=m.blocker where practice_id=p_practice and id=p_message;
 end if;
 insert into public.message_outbox_events(practice_id,message_id,version,state,blocker,actor_user_id)values(p_practice,p_message,m.version,m.state,m.blocker,actor);
 insert into public.audit_events(practice_id,actor_user_id,event_type,entity_id,details)values(p_practice,actor,'outbox.'||p_action,p_message,jsonb_build_object('location_id',p_location,'version',m.version,'state',m.state,'external_delivery',false));
 result:=doctor_private.outbox_projection(m);
 if p_action='claim' and m.state='claimed' then result:=result||jsonb_build_object('claim_token',m.claim_token);end if;
 -- Receipt is available only through an explicit acceptance command/retry by an authorized synthetic operator.
 if p_action='accept' and m.state='claimed' then select receipt into acceptance.receipt from doctor_private.synthetic_message_acceptances where practice_id=p_practice and message_id=p_message;result:=result||jsonb_build_object('receipt',acceptance.receipt);end if;
 insert into doctor_private.command_receipts values(actor,p_key,request,result);return result;
exception when unique_violation then raise exception using errcode='40001',message='DOCTOR_OUTBOX_CONFLICT';
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then raise exception using errcode='22023',message='DOCTOR_OUTBOX_INVALID';
end $$;
create function doctor_private.outbox_directory(p_practice uuid,p_location uuid,p_patient uuid,p_page integer)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare rows jsonb;total bigint;
begin
 perform doctor_private.contact_scope(p_practice,p_location,p_patient);
 if p_page is null or p_page not between 0 and 100000 then raise exception using errcode='22023',message='DOCTOR_OUTBOX_INVALID';end if;
 with cohort as materialized(select * from public.message_outbox where practice_id=p_practice and location_id=p_location and patient_id=p_patient),selected as(select * from cohort order by created_at desc,id limit 20 offset p_page*20)
 select(select count(*)from cohort),coalesce(jsonb_agg(doctor_private.outbox_projection(m) order by m.created_at desc,m.id),'[]')into total,rows from selected m;
 return jsonb_build_object('rows',rows,'total',total,'page',p_page,'external_delivery',false,'data_mode','synthetic');
end $$;
create function public.doctor_outbox_command(p_practice uuid,p_location uuid,p_patient uuid,p_message uuid,p_version integer,p_action text,p_input jsonb,p_key uuid)returns jsonb language sql security invoker set search_path=''as $$select doctor_private.outbox_command(p_practice,p_location,p_patient,p_message,p_version,p_action,p_input,p_key)$$;
create function public.doctor_outbox(p_practice uuid,p_location uuid,p_patient uuid,p_page integer)returns jsonb language sql stable security invoker set search_path=''as $$select doctor_private.outbox_directory(p_practice,p_location,p_patient,p_page)$$;
revoke all on function doctor_private.outbox_projection(public.message_outbox),doctor_private.outbox_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.outbox_directory(uuid,uuid,uuid,integer),public.doctor_outbox_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_outbox(uuid,uuid,uuid,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.outbox_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),doctor_private.outbox_directory(uuid,uuid,uuid,integer),public.doctor_outbox_command(uuid,uuid,uuid,uuid,integer,text,jsonb,uuid),public.doctor_outbox(uuid,uuid,uuid,integer)to authenticated;
