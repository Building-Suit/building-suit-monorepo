-- Explicit administrative recovery only for known pre-model input-size errors.
-- Preserve the original job, worker lease/result digest and host journal. No
-- public endpoint, automatic retry, task repair budget or success claim changes.
alter table public.hq_agent_jobs
  add column recovery_of uuid unique,
  add column recovery_count integer not null default 0 check(recovery_count between 0 and 2),
  add constraint hq_chat_recovery_source_key unique(id,conversation_id,founder_message_id,founder_user_id,agent_id,kind),
  add constraint hq_chat_recovery_source_fk foreign key(recovery_of,conversation_id,founder_message_id,founder_user_id,agent_id,kind)
    references public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,kind),
  add constraint hq_chat_recovery_scope_check check(
    (recovery_of is null and recovery_count=0)
    or (recovery_of is not null and recovery_of<>id and recovery_count between 1 and 2
      and kind='conversation-intake' and agent_id='AG-CEO-001' and depends_on is null));

create function hq_private.recover_chat_intake(p_job_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  source public.hq_agent_jobs; recovered public.hq_agent_jobs; message public.hq_agent_messages;
begin
  -- ACLs are the primary boundary. This guard also fails closed if an API role
  -- is accidentally granted EXECUTE later; no SECURITY DEFINER elevation.
  if current_user is distinct from pg_catalog.pg_get_userbyid((select p.proowner from pg_catalog.pg_proc p
    where p.oid='hq_private.recover_chat_intake(uuid)'::pg_catalog.regprocedure)) then
    raise exception 'HQ_ADMIN_REQUIRED' using errcode='42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  select * into source from public.hq_agent_jobs where id=p_job_id for update;
  if not found or source.kind<>'conversation-intake' or source.agent_id<>'AG-CEO-001'
    or source.status<>'blocked' or source.error not in ('response-too-large','brain-source-too-large','brain-context-too-large')
    or source.depends_on is not null or source.task_id is not null or source.artifact_id is not null or source.lesson_id is not null
    or source.result_text is not null then
    raise exception 'HQ_INTAKE_RECOVERY_UNSAFE' using errcode='PT409';
  end if;
  select m.* into message from public.hq_agent_messages m join public.hq_agent_conversations c on c.id=m.conversation_id
    where m.id=source.founder_message_id and m.role='founder' and m.agent_id='AG-CEO-001'
      and m.conversation_id=source.conversation_id and c.founder_user_id=source.founder_user_id;
  if not found or not exists(select 1 from public.hq_founders f
    join hq_private.founder_invitations i on i.id=f.invitation_id join auth.users u on u.id=f.user_id
    where f.user_id=source.founder_user_id and f.revoked_at is null and i.revoked_at is null
      and i.bound_user_id=f.user_id and u.email_confirmed_at is not null
      and pg_catalog.lower(pg_catalog.btrim(u.email))=i.email) then
    raise exception 'HQ_RECOVERY_FOUNDER_REQUIRED' using errcode='42501';
  end if;
  select * into recovered from public.hq_agent_jobs where recovery_of=source.id;
  if found then
    return pg_catalog.jsonb_build_object('jobId',recovered.id,'recoveryOf',recovered.recovery_of,'recoveryCount',recovered.recovery_count);
  end if;
  if source.recovery_count>=2 then raise exception 'HQ_INTAKE_RECOVERY_LIMIT' using errcode='PT409'; end if;
  if exists(select 1 from public.hq_agent_messages m where
      m.role='assistant' and (m.job_id=source.id or m.reply_to=source.founder_message_id)
      or m.conversation_id=source.conversation_id and m.role='founder' and (m.created_at,m.id)>(message.created_at,message.id))
    or exists(select 1 from public.hq_task_artifacts a where a.job_id=source.id)
    or exists(select 1 from public.hq_business_tasks t where t.founder_message_id=source.founder_message_id)
    or exists(select 1 from public.hq_agent_jobs j where j.depends_on=source.id
      or j.founder_message_id=source.founder_message_id and j.status in ('queued','working')) then
    raise exception 'HQ_INTAKE_RECOVERY_UNSAFE' using errcode='PT409';
  end if;
  if (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=source.founder_user_id and status='queued')>=40 then
    raise exception 'HQ_MESSAGE_QUEUE_LIMIT' using errcode='PT429';
  end if;
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,recovery_of,recovery_count)
    values(source.conversation_id,source.founder_message_id,source.founder_user_id,'AG-CEO-001',pg_catalog.gen_random_uuid(),
      'conversation-intake',source.id,source.recovery_count+1) returning * into recovered;
  perform hq_private.workforce_wake();
  return pg_catalog.jsonb_build_object('jobId',recovered.id,'recoveryOf',recovered.recovery_of,'recoveryCount',recovered.recovery_count);
end $$;
revoke all on function hq_private.recover_chat_intake(uuid) from public,anon,authenticated,service_role;

-- Add metadata to the existing bounded founder projection, preserving its
-- status/lease interpretation and exact job order. No worker credentials leak.
alter function hq_private.agent_snapshot() rename to agent_snapshot_before_intake_recovery;
create function hq_private.agent_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); result jsonb; jobs jsonb;
begin
  result:=hq_private.agent_snapshot_before_intake_recovery();
  select coalesce(pg_catalog.jsonb_agg(item.value||pg_catalog.jsonb_build_object('kind',j.kind,
    'founderMessageId',j.founder_message_id,'recoveryOf',j.recovery_of) order by item.ordinality),'[]'::jsonb) into jobs
    from pg_catalog.jsonb_array_elements(result->'jobs') with ordinality item(value,ordinality)
    join public.hq_agent_jobs j on j.id=(item.value->>'id')::uuid and j.founder_user_id=uid
      and j.conversation_id=(result->>'conversationId')::uuid;
  return result||pg_catalog.jsonb_build_object('jobs',jobs);
end $$;
create or replace function public.hq_agent_snapshot() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.agent_snapshot(); $$;
revoke all on function hq_private.agent_snapshot_before_intake_recovery(),hq_private.agent_snapshot() from public,anon,authenticated,service_role;
grant execute on function hq_private.agent_snapshot() to authenticated;
