begin;

-- A completed response can be reviewed while the employee handles new work.
-- A requested correction waits for the same employee's active lease to finish.
drop index shop_private.hq_assistant_one_active_per_employee_idx;
create unique index hq_assistant_one_active_per_employee_idx
on shop_private.hq_assistant_jobs (employee_id)
where employee_id is not null and stage in ('assigned','employee','sale_pending');

create or replace function public.shop_hq_assistant_claim() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_token uuid;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  for v_job in
    select * from shop_private.hq_assistant_jobs job
    where job.stage in ('assigned','fix_pending') and not exists (
      select 1 from shop_private.hq_assistant_jobs busy
      where busy.employee_id = job.employee_id and busy.id <> job.id
        and busy.stage in ('assigned','employee','sale_pending')
    )
    order by job.created_at, job.id
  loop
    if not shop_private.hq_assistant_current_consent(v_job) then
      update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed', messages = null,
        context_messages = null, owner_message = null, updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, intent = null,
        intent_expires_at = null, transcript_expires_at = null, feedback = null where id = v_job.id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update shop_private.hq_assistant_jobs set stage = 'employee',
      state = case when state = 'queued' then 'working' else state end,
      context_messages = coalesce(context_messages, messages), messages = null,
      worker_id = v_worker, lease_token = v_token,
      expires_at = case when v_job.stage = 'assigned' then clock_timestamp() + interval '5 minutes' else expires_at end,
      lease_expires_at = case when v_job.stage = 'assigned' then clock_timestamp() + interval '60 seconds'
        else least(expires_at, clock_timestamp() + interval '60 seconds') end
    where id = v_job.id;
    perform shop_private.hq_assistant_signal_owner(v_job.id);
    return jsonb_build_object('jobId', v_job.id, 'leaseToken', v_token, 'employeeId', v_job.employee_id,
      'employeeTemplate', 'shop-suit-agent-v1', 'messages', coalesce(v_job.context_messages, v_job.messages),
      'feedback', v_job.feedback, 'outcome', shop_private.hq_assistant_latest_action(v_job.updates));
  end loop;
  return null;
end;
$$;

notify pgrst, 'reload schema';
commit;
