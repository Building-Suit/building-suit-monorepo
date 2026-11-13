begin;

-- The worker can recall selected owner statements from the original chat while
-- it holds this request's lease. The chat remains the sole retained history.
create function public.shop_hq_assistant_recall(p_job_id uuid, p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid;
  v_job shop_private.hq_assistant_jobs%rowtype;
  v_sequence bigint;
  v_preferences jsonb;
  v_relevant jsonb;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.worker_id is distinct from v_worker or v_job.employee_id is null
    or v_job.stage not in ('employee','reviewing')
    or v_job.expires_at <= clock_timestamp()
    or v_job.lease_expires_at is null or v_job.lease_expires_at <= clock_timestamp()
    or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then
    raise exception 'SHOP_HQ_ASSISTANT_RECALL_LEASE_REQUIRED' using errcode = '42501';
  end if;

  select message.sequence into v_sequence
  from shop_private.hq_assistant_chat_messages message
  where message.job_id = v_job.id and message.source_sequence = 0;

  with terms as (
    select distinct token
    from unnest(tsvector_to_array(to_tsvector('pg_catalog.simple',
      shop_private.hq_sale_name(v_job.owner_message)))) as word(token)
    where length(token) >= 3 and token ~ '[[:alpha:]]'
      and token not in ('can','for','how','please','show','the','what','when','with','would','you',
        'انا','الى','اللي','علي','عاوز','عايز','عايزه','فضلك','ممكن','وريني','ياريت')
  ), prior as materialized (
    select message.sequence, message.text
    from shop_private.hq_assistant_chat_messages message
    where message.actor_id = v_job.actor_id and message.shop_id = v_job.shop_id
      and message.location_id = v_job.location_id and message.consent_generation = v_job.consent_generation
      and message.sequence < v_sequence and message.kind = 'message' and message.role = 'user'
    order by message.sequence desc
    limit 256
  ), candidates as (
    select distinct on (prior.text) prior.sequence, prior.text,
      shop_private.hq_sale_name(prior.text) as normalized
    from prior
    where shop_private.hq_assistant_payment_evidence(prior.text) is null
      and not exists (
        select 1 from jsonb_array_elements(coalesce(v_job.context_messages,v_job.messages,'[]'::jsonb)) as turn(value)
        where turn.value->>'role' = 'user' and turn.value->>'content' = prior.text
      )
    order by prior.text,prior.sequence desc
  ), preferences as (
    select sequence, text
    from candidates
    where normalized ~ '^(i prefer|my preference is|for future replies|i always prefer|افضل|بفضل|انا افضل|انا بفضل|تفضيلي|دايما بفضل)([[:space:][:punct:]]|$)'
    order by sequence desc
    limit 3
  ), ranked as (
    select candidates.sequence, candidates.text, count(*) as matches
    from candidates
    join terms on to_tsvector('pg_catalog.simple', candidates.normalized) @@ plainto_tsquery('pg_catalog.simple',terms.token)
    where not exists (select 1 from preferences where preferences.sequence = candidates.sequence)
    group by candidates.sequence, candidates.text
    order by matches desc, candidates.sequence desc
    limit 3
  )
  select
    (select coalesce(jsonb_agg(left(text,400) order by sequence desc),'[]'::jsonb) from preferences),
    (select coalesce(jsonb_agg(left(text,400) order by matches desc, sequence desc),'[]'::jsonb) from ranked)
  into v_preferences,v_relevant;

  return jsonb_build_object('preferences',v_preferences,'relevant',v_relevant);
end;
$$;

revoke all on function public.shop_hq_assistant_recall(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.shop_hq_assistant_recall(uuid,uuid) to authenticated;

commit;
