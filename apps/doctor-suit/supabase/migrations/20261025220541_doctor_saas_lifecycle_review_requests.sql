-- Synthetic review intake only. This migration supplies no approved lifecycle policy or effective billing mutation.
create table public.doctor_saas_lifecycle_requests(
 id uuid primary key default pg_catalog.gen_random_uuid(),
 subscriber_user_id uuid not null references auth.users(id),
 period_id uuid not null,terms_version_id uuid not null references public.doctor_saas_terms_versions(id),
 account_revision integer not null check(account_revision>0),
 action text not null check(action in('renewal','cancellation','reactivation')),
 accepted_document_ref text not null,
 observed_state text not null check(observed_state in('trial','paid','expired','scheduled','suspended')),
 original_period_ends_at timestamptz not null check(pg_catalog.isfinite(original_period_ends_at)),
 requested_at timestamptz not null default clock_timestamp(),
 foreign key(subscriber_user_id,period_id)references public.doctor_saas_periods(subscriber_user_id,id),
 unique(subscriber_user_id,period_id,account_revision,action)
);
alter table public.doctor_saas_lifecycle_requests enable row level security;
alter table public.doctor_saas_lifecycle_requests force row level security;
create policy doctor_saas_lifecycle_requests_owner on public.doctor_saas_lifecycle_requests for all to postgres using(true)with check(true);
revoke all on public.doctor_saas_lifecycle_requests from public,anon,authenticated,service_role;
create trigger doctor_saas_lifecycle_requests_immutable before update or delete on public.doctor_saas_lifecycle_requests
 for each row execute function doctor_private.saas_history_immutable();
create trigger doctor_saas_lifecycle_requests_no_truncate before truncate on public.doctor_saas_lifecycle_requests
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.saas_lifecycle_request_projection(r public.doctor_saas_lifecycle_requests)returns jsonb
language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('request_id',r.id,'subscriber_user_id',r.subscriber_user_id,'period_id',r.period_id,
 'terms_id',r.terms_version_id,'account_revision',r.account_revision,'action',r.action,'document_ref',r.accepted_document_ref,
 'observed_state',r.observed_state,'original_period_ends_at',r.original_period_ends_at,'requested_at',r.requested_at,
 'status','requested','effective_at',null,'provider_confirmation',null,'execution_available',false,
 'entitlement_changed',false,'charge_created',false,'data_mode','synthetic','live_activation',false)
$$;
create function doctor_private.request_saas_lifecycle(p_action text,p_account_revision integer,p_period uuid,p_terms uuid,p_document_ref text,p_acknowledged boolean,p_key uuid)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();state jsonb;prior doctor_private.command_receipts;
 item public.doctor_saas_lifecycle_requests;result jsonb;
 request jsonb:=jsonb_build_object('command','saas.lifecycle.request','action',p_action,'account_revision',p_account_revision,
 'period',p_period,'terms',p_terms,'document_ref',p_document_ref,'acknowledged',p_acknowledged);
begin
 perform doctor_private.require_owner_enrollment();
 if p_action is null or p_action not in('renewal','cancellation','reactivation')or p_account_revision is null or p_account_revision<1
  or p_period is null or p_terms is null or p_document_ref is null or p_acknowledged is distinct from true or p_key is null then
  raise exception using errcode='22023',message='DOCTOR_LIFECYCLE_REQUEST_INVALID';end if;
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_SAAS_ISOLATION_REQUIRED';end if;
 -- Same subscriber lock as quote preparation, activation and account transitions; no effective-state write.
 perform doctor_private.saas_lock_subscriber(actor);
 perform doctor_private.current_actor();
 perform doctor_private.require_owner_enrollment();
 select * into prior from doctor_private.command_receipts where actor_user_id=actor and command_key=p_key;
 if found then
  if prior.request<>request then raise exception using errcode='22023',message='DOCTOR_IDEMPOTENCY_CONFLICT';end if;
  return prior.result; -- Historical acknowledgement, never a current cancellation/entitlement decision.
 end if;
 state:=doctor_private.saas_account_state(actor);
 if (state->>'revision')::integer<>p_account_revision or(state#>>'{period,id}')::uuid is distinct from p_period
  or(state#>>'{period,terms_id}')::uuid is distinct from p_terms or state#>>'{period,accepted_document_ref}'is distinct from p_document_ref then
  raise exception using errcode='40001',message='DOCTOR_LIFECYCLE_REQUEST_CONFLICT';end if;
 insert into public.doctor_saas_lifecycle_requests(subscriber_user_id,period_id,terms_version_id,account_revision,action,accepted_document_ref,observed_state,original_period_ends_at)
 values(actor,p_period,p_terms,p_account_revision,p_action,p_document_ref,state->>'state',(state#>>'{period,ends_at}')::timestamptz)
 on conflict(subscriber_user_id,period_id,account_revision,action)do nothing;
 select * into item from public.doctor_saas_lifecycle_requests where subscriber_user_id=actor and period_id=p_period and account_revision=p_account_revision and action=p_action;
 result:=doctor_private.saas_lifecycle_request_projection(item);
 insert into doctor_private.command_receipts values(actor,p_key,request,result);
 return result;
end $$;
create function doctor_private.saas_lifecycle_requests(p_page integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();result jsonb;
begin
 perform doctor_private.require_owner_enrollment();
 if p_page is null or p_page<1 or p_page>1000000 then raise exception using errcode='22023',message='DOCTOR_LIFECYCLE_QUERY_INVALID';end if;
 with population as materialized(select r.* from public.doctor_saas_lifecycle_requests r where subscriber_user_id=actor),
 page as(select * from population order by requested_at desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('subscriber_user_id',actor,'total',(select count(*)from population),'page',p_page,
 'items',coalesce((select jsonb_agg(doctor_private.saas_lifecycle_request_projection(p::public.doctor_saas_lifecycle_requests)order by p.requested_at desc,p.id)from page p),'[]'::jsonb),
 'execution_available',false,'data_mode','synthetic','live_activation',false)into result;
 return result;
end $$;
create function public.doctor_request_saas_lifecycle(p_action text,p_account_revision integer,p_period uuid,p_terms uuid,p_document_ref text,p_acknowledged boolean,p_key uuid)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.request_saas_lifecycle(p_action,p_account_revision,p_period,p_terms,p_document_ref,p_acknowledged,p_key)$$;
create function public.doctor_saas_lifecycle_requests(p_page integer default 1)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.saas_lifecycle_requests(p_page)$$;
revoke all on function doctor_private.saas_lifecycle_request_projection(public.doctor_saas_lifecycle_requests),doctor_private.request_saas_lifecycle(text,integer,uuid,uuid,text,boolean,uuid),doctor_private.saas_lifecycle_requests(integer),public.doctor_request_saas_lifecycle(text,integer,uuid,uuid,text,boolean,uuid),public.doctor_saas_lifecycle_requests(integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.request_saas_lifecycle(text,integer,uuid,uuid,text,boolean,uuid),doctor_private.saas_lifecycle_requests(integer),public.doctor_request_saas_lifecycle(text,integer,uuid,uuid,text,boolean,uuid),public.doctor_saas_lifecycle_requests(integer)to authenticated;
