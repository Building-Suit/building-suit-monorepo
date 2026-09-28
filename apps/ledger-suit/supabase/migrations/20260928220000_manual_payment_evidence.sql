-- LS-BILL-002: private evidence, explicit operator authority and atomic fulfilment.
create table app.manual_payment_operators (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
revoke all on app.manual_payment_operators from public, anon, authenticated, service_role;

create function app.is_manual_payment_operator(p_organization_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and exists (select 1 from app.manual_payment_operators where user_id = auth.uid())
    and not exists (select 1 from public.organization_members
      where organization_id = p_organization_id and user_id = auth.uid());
$$;
revoke all on function app.is_manual_payment_operator(uuid) from public, anon;
grant execute on function app.is_manual_payment_operator(uuid) to authenticated;

create table public.manual_payment_requests (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id),
  created_by uuid not null references public.profiles(id),
  plan_id uuid not null references public.subscription_plans(id),
  plan_key text not null check (plan_key in ('solo','starter','business')),
  price_id uuid not null references public.subscription_plan_prices(id),
  billing_interval public.billing_interval not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code char(3) not null check (currency_code = 'EGP'),
  instructions text not null check (length(instructions) between 1 and 4000),
  status text not null default 'draft' check (status in ('draft','submitted','under_review','approved','rejected','cancelled')),
  evidence_id uuid,
  created_at timestamptz not null default now(),
  period_start timestamptz,
  period_end timestamptz,
  check ((status = 'approved') = (period_start is not null and period_end is not null)),
  check (period_end > period_start)
);
create unique index manual_payment_one_pending on public.manual_payment_requests(organization_id)
  where status in ('draft','submitted','under_review','rejected');

create table public.manual_payment_evidence (
  id uuid primary key,
  request_id uuid not null references public.manual_payment_requests(id),
  organization_id uuid not null references public.organizations(id),
  object_id uuid not null unique,
  storage_key text not null unique,
  filename text not null check (length(filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','application/pdf')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  unique (request_id,id)
);
alter table public.manual_payment_requests add constraint manual_payment_current_evidence
  foreign key (id,evidence_id) references public.manual_payment_evidence(request_id,id);

create table public.manual_payment_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.manual_payment_requests(id),
  organization_id uuid not null references public.organizations(id),
  evidence_id uuid,
  actor_id uuid not null references public.profiles(id),
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  before_state text,
  after_state text not null,
  occurred_at timestamptz not null default now(),
  foreign key (request_id,evidence_id) references public.manual_payment_evidence(request_id,id)
);
create index manual_payment_history_request on public.manual_payment_history(request_id,occurred_at);

create function app.preserve_manual_payment_evidence() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'MANUAL_PAYMENT_HISTORY_IMMUTABLE' using errcode = '42501'; end;
$$;
create trigger manual_payment_evidence_immutable before update or delete on public.manual_payment_evidence
  for each row execute function app.preserve_manual_payment_evidence();
create trigger manual_payment_history_immutable before update or delete on public.manual_payment_history
  for each row execute function app.preserve_manual_payment_evidence();
revoke all on function app.preserve_manual_payment_evidence() from public, anon, authenticated;

alter table public.manual_payment_requests enable row level security;
alter table public.manual_payment_evidence enable row level security;
alter table public.manual_payment_history enable row level security;
revoke all on public.manual_payment_requests,public.manual_payment_evidence,public.manual_payment_history from public, anon, authenticated, service_role;
grant select on public.manual_payment_requests,public.manual_payment_evidence,public.manual_payment_history to authenticated,service_role;
create policy manual_requests_read on public.manual_payment_requests for select to authenticated
  using (app.has_capability(organization_id,'billing.manage') or app.is_manual_payment_operator(organization_id));
create policy manual_evidence_read on public.manual_payment_evidence for select to authenticated
  using (app.has_capability(organization_id,'billing.manage') or app.is_manual_payment_operator(organization_id));
create policy manual_history_read on public.manual_payment_history for select to authenticated
  using (app.has_capability(organization_id,'billing.manage') or app.is_manual_payment_operator(organization_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('manual-payment-receipts','manual-payment-receipts',false,5242880,array['image/jpeg','image/png','application/pdf']);
-- No browser INSERT/UPDATE/DELETE policy: only the validating Edge Function uploads.
create policy manual_receipts_read on storage.objects for select to authenticated using (
  bucket_id = 'manual-payment-receipts' and exists (
    select 1 from public.manual_payment_evidence e where e.storage_key = storage.objects.name and e.object_id = storage.objects.id
      and (app.has_capability(e.organization_id,'billing.manage') or app.is_manual_payment_operator(e.organization_id))
  )
);

-- Config is private and intentionally empty until an operator supplies public payment
-- instructions. Store ONLY recipient details and customer-facing text, never secrets.
create table app.manual_payment_configuration (
  singleton boolean primary key default true check (singleton),
  instructions text not null check (length(btrim(instructions)) between 1 and 4000)
);
revoke all on app.manual_payment_configuration from public,anon,authenticated,service_role;

create function public.prepare_manual_payment(p_id uuid,p_organization_id uuid,p_plan_key text,p_interval public.billing_interval)
returns public.manual_payment_requests language plpgsql security definer set search_path = '' as $$
declare r public.manual_payment_requests; c record; v_instructions text;
begin
  perform app.require_capability(p_organization_id,'billing.manage');
  perform 1 from public.organizations where id=p_organization_id for update;
  select * into r from public.manual_payment_requests where id=p_id;
  if found then
    if r.organization_id is distinct from p_organization_id or r.created_by is distinct from auth.uid() or r.plan_key is distinct from p_plan_key or r.billing_interval is distinct from p_interval then
      raise exception 'MANUAL_PAYMENT_KEY_REUSED' using errcode='22023';
    end if;
    return r;
  end if;
  select * into strict c from public.billing_checkout_context(p_organization_id,p_plan_key,p_interval);
  if c.access_state not in ('trialing','read_only','checkout_required') then
    raise exception 'MANUAL_PAYMENT_CHECKOUT_UNAVAILABLE' using errcode='22023';
  end if;
  select instructions into v_instructions from app.manual_payment_configuration where singleton;
  if v_instructions is null then raise exception 'MANUAL_PAYMENT_NOT_CONFIGURED' using errcode='22023'; end if;
  insert into public.manual_payment_requests(id,organization_id,created_by,plan_id,plan_key,price_id,billing_interval,amount_minor,currency_code,instructions)
  values(p_id,p_organization_id,auth.uid(),c.plan_id,c.plan_key,c.price_id,p_interval,c.amount_minor,c.currency_code,v_instructions) returning * into r;
  insert into public.manual_payment_history(request_id,organization_id,actor_id,reason,after_state)
  values(r.id,r.organization_id,auth.uid(),'Checkout quote created','draft');
  return r;
end;
$$;

-- Called only after the Edge Function has authenticated the actor, validated bytes,
-- hashed the content and uploaded a fresh object with upsert=false.
create function public.submit_manual_payment(p_request_id uuid,p_evidence_id uuid,p_actor_id uuid,p_filename text,p_sha256 text,p_reason text)
returns public.manual_payment_requests language plpgsql security definer set search_path = '' as $$
declare r public.manual_payment_requests; o storage.objects; v_key text;
begin
  if not app.is_service_context() then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  select * into strict r from public.manual_payment_requests where id=p_request_id for update;
  if not ('billing.manage'=any(app.capabilities_for(r.organization_id,p_actor_id))) then
    raise exception 'INSUFFICIENT_PERMISSION' using errcode='42501';
  end if;
  if r.evidence_id=p_evidence_id then return r; end if;
  if r.status not in ('draft','rejected') then raise exception 'MANUAL_PAYMENT_INVALID_STATE' using errcode='22023'; end if;
  v_key := r.organization_id::text || '/' || r.id::text || '/' || p_evidence_id::text;
  select * into strict o from storage.objects where bucket_id='manual-payment-receipts' and name=v_key;
  insert into public.manual_payment_evidence(id,request_id,organization_id,object_id,storage_key,filename,mime_type,size_bytes,sha256,submitted_by)
  values(p_evidence_id,r.id,r.organization_id,o.id,v_key,p_filename,o.metadata->>'mimetype',(o.metadata->>'size')::bigint,p_sha256,p_actor_id);
  insert into public.manual_payment_history(request_id,organization_id,evidence_id,actor_id,reason,before_state,after_state)
  values(r.id,r.organization_id,p_evidence_id,p_actor_id,p_reason,r.status,'submitted');
  update public.manual_payment_requests set status='submitted',evidence_id=p_evidence_id where id=r.id returning * into r;
  return r;
end;
$$;

alter table public.subscriptions drop constraint subscriptions_checkout_requires_provider;
alter table public.subscriptions add constraint subscriptions_checkout_requires_provider
  check (checkout_completed_at is null or (provider in ('paymob','manual') and provider_subscription_id is not null)) not valid;

create function public.review_manual_payment(p_request_id uuid,p_evidence_id uuid,p_action text,p_reason text)
returns public.manual_payment_requests language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare r public.manual_payment_requests; s public.subscriptions; v_start timestamptz; v_end timestamptz; v_mutated integer;
begin
  select * into strict r from public.manual_payment_requests where id=p_request_id;
  if not app.is_manual_payment_operator(r.organization_id) or r.created_by=auth.uid()
     or exists(select 1 from public.manual_payment_evidence where request_id=r.id and submitted_by=auth.uid()) then raise exception 'MANUAL_PAYMENT_OPERATOR_REQUIRED' using errcode='42501'; end if;
  if p_action is null or p_action not in ('under_review','approved','rejected') or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'MANUAL_PAYMENT_REVIEW_INVALID' using errcode='22023';
  end if;
  -- Lock tenant then request then subscription: two sessions cannot grant two periods.
  perform 1 from public.organizations where id=r.organization_id for update;
  select * into strict r from public.manual_payment_requests where id=p_request_id for update;
  if p_evidence_id is null or r.evidence_id is distinct from p_evidence_id then raise exception 'MANUAL_PAYMENT_STALE_EVIDENCE' using errcode='22023'; end if;
  if r.status=p_action then return r; end if;
  if r.status not in ('submitted','under_review') then raise exception 'MANUAL_PAYMENT_INVALID_STATE' using errcode='22023'; end if;
  if p_action='approved' then
    select * into s from public.subscriptions where organization_id=r.organization_id for update;
    -- Do not overwrite a card subscription or an unrelated active plan paid while
    -- this request waited for review. Rejection/cancellation remains available.
    if s.status in ('active','grace_period','past_due') and (s.current_period_end is null or s.current_period_end>now())
       and (s.provider is distinct from 'manual' or s.plan_id<>r.plan_id) then
      raise exception 'MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT' using errcode='22023';
    end if;
    v_start := case when s.status='active' and s.provider='manual' then greatest(now(),s.current_period_end) else now() end;
    v_end := v_start + case r.billing_interval when 'monthly' then interval '1 month' else interval '1 year' end;
    insert into public.subscriptions(organization_id,plan_id,price_id,status,provider,provider_subscription_id,provider_status,billing_interval,current_period_start,current_period_end,checkout_completed_at,last_payment_at)
    values(r.organization_id,r.plan_id,r.price_id,'active','manual',r.id::text,'active',r.billing_interval,v_start,v_end,now(),now())
    on conflict(organization_id) do update set plan_id=excluded.plan_id,price_id=excluded.price_id,status='active',provider='manual',provider_subscription_id=excluded.provider_subscription_id,
      provider_status='active',billing_interval=excluded.billing_interval,current_period_start=excluded.current_period_start,current_period_end=excluded.current_period_end,
      checkout_completed_at=excluded.checkout_completed_at,last_payment_at=excluded.last_payment_at,payment_failed_at=null,grace_period_ends_at=null,cancelled_at=null,cancel_at_period_end=false
      -- Recheck after a conflicting insert: there may have been no row to lock
      -- when a concurrent card checkout created this subscription.
      where not (public.subscriptions.status in ('active','grace_period','past_due')
        and (public.subscriptions.current_period_end is null or public.subscriptions.current_period_end>now())
        and (public.subscriptions.provider is distinct from 'manual' or public.subscriptions.plan_id<>excluded.plan_id));
    get diagnostics v_mutated = row_count;
    if v_mutated<>1 then raise exception 'MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT' using errcode='22023'; end if;
  end if;
  insert into public.manual_payment_history(request_id,organization_id,evidence_id,actor_id,reason,before_state,after_state)
  values(r.id,r.organization_id,r.evidence_id,auth.uid(),p_reason,r.status,p_action);
  update public.manual_payment_requests set status=p_action,period_start=v_start,period_end=v_end where id=r.id returning * into r;
  return r;
end;
$$;

create function public.cancel_manual_payment(p_request_id uuid,p_reason text)
returns public.manual_payment_requests language plpgsql security definer set search_path = '' as $$
declare r public.manual_payment_requests;
begin
  select * into strict r from public.manual_payment_requests where id=p_request_id for update;
  perform app.require_capability(r.organization_id,'billing.manage');
  if r.status='cancelled' then return r; end if;
  if r.status='approved' then raise exception 'MANUAL_PAYMENT_INVALID_STATE' using errcode='22023'; end if;
  insert into public.manual_payment_history(request_id,organization_id,evidence_id,actor_id,reason,before_state,after_state)
  values(r.id,r.organization_id,r.evidence_id,auth.uid(),p_reason,r.status,'cancelled');
  update public.manual_payment_requests set status='cancelled' where id=r.id returning * into r;
  return r;
end;
$$;
revoke all on function public.prepare_manual_payment(uuid,uuid,text,public.billing_interval), public.cancel_manual_payment(uuid,text),public.review_manual_payment(uuid,uuid,text,text) from public,anon,service_role;
grant execute on function public.prepare_manual_payment(uuid,uuid,text,public.billing_interval), public.cancel_manual_payment(uuid,text),public.review_manual_payment(uuid,uuid,text,text) to authenticated;
revoke all on function public.submit_manual_payment(uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_manual_payment(uuid,uuid,uuid,text,text,text) to service_role;

-- An in-flight card checkout must not overwrite a just-approved manual period.
-- Expired manual periods can still convert normally through Paymob checkout.
create function app.protect_manual_payment_period() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.provider='manual' and old.status='active' and old.current_period_end>now()
     and new.provider is distinct from 'manual' then
    raise exception 'MANUAL_PAYMENT_SUBSCRIPTION_CONFLICT' using errcode='22023';
  end if;
  return new;
end;
$$;
create trigger subscriptions_protect_manual_period before update on public.subscriptions
  for each row execute function app.protect_manual_payment_period();
revoke all on function app.protect_manual_payment_period() from public,anon,authenticated;
