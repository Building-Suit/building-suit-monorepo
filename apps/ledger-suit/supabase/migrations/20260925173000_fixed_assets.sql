-- V2-IMP-011 / approved V2-D09: explicit fixed-asset register and lifecycle.
-- Historical asset-purchase journals are never converted automatically.
create type public.asset_depreciation_method as enum ('straight_line','declining_balance');
create type public.fixed_asset_status as enum ('active','disposed','corrected');
create type public.asset_schedule_status as enum ('scheduled','posted','reversed','superseded');
create type public.asset_event_kind as enum ('acquisition','depreciation','impairment','policy_change','disposal','reversal');

create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  asset_code text not null check (nullif(btrim(asset_code),'') is not null),
  name text not null check (nullif(btrim(name),'') is not null),
  description text,
  currency_code char(3) not null references public.currencies(code),
  acquisition_date date not null check (isfinite(acquisition_date)),
  in_service_date date not null check (isfinite(in_service_date) and in_service_date >= acquisition_date),
  acquisition_cost_minor bigint not null check (acquisition_cost_minor > 0),
  residual_value_minor bigint not null default 0 check (residual_value_minor >= 0 and residual_value_minor < acquisition_cost_minor),
  useful_life_months integer not null check (useful_life_months > 0 and useful_life_months <= 1200),
  depreciation_method public.asset_depreciation_method not null default 'straight_line',
  declining_rate_basis_points integer check (
    (depreciation_method='straight_line' and declining_rate_basis_points is null)
    or (depreciation_method='declining_balance' and declining_rate_basis_points between 1 and 10000)
  ),
  cost_account_id uuid not null,
  accumulated_depreciation_account_id uuid not null,
  depreciation_expense_account_id uuid not null,
  impairment_expense_account_id uuid not null,
  gain_loss_account_id uuid not null,
  acquisition_transaction_id uuid not null,
  replaces_asset_id uuid,
  status public.fixed_asset_status not null default 'active',
  disposal_date date,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,organization_id), unique(organization_id,asset_code), unique(acquisition_transaction_id),
  foreign key(cost_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(accumulated_depreciation_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(depreciation_expense_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(impairment_expense_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(gain_loss_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(acquisition_transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(replaces_asset_id,organization_id) references public.fixed_assets(id,organization_id) on delete restrict,
  check ((status='disposed')=(disposal_date is not null))
);
create unique index fixed_assets_one_replacement on public.fixed_assets(replaces_asset_id) where replaces_asset_id is not null;

create table public.asset_policy_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  version integer not null check(version>0),
  effective_from date not null check(isfinite(effective_from)),
  start_carrying_minor bigint not null check(start_carrying_minor>=0),
  residual_value_minor bigint not null check(residual_value_minor>=0 and residual_value_minor<=start_carrying_minor),
  useful_life_months integer not null check(useful_life_months>0 and useful_life_months<=1200),
  method public.asset_depreciation_method not null,
  declining_rate_basis_points integer check ((method='straight_line' and declining_rate_basis_points is null) or (method='declining_balance' and declining_rate_basis_points between 1 and 10000)),
  reason text not null check(nullif(btrim(reason),'') is not null),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(asset_id,version), unique(asset_id,effective_from),
  foreign key(asset_id,organization_id) references public.fixed_assets(id,organization_id) on delete restrict
);

create table public.asset_depreciation_schedule (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  policy_version_id uuid not null,
  period_start date not null,
  period_end date not null check(period_end>=period_start),
  depreciation_minor bigint not null check(depreciation_minor>=0),
  closing_book_value_minor bigint not null check(closing_book_value_minor>=0),
  status public.asset_schedule_status not null default 'scheduled',
  transaction_id uuid,
  replaces_schedule_id uuid,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  foreign key(asset_id,organization_id) references public.fixed_assets(id,organization_id) on delete restrict,
  foreign key(policy_version_id,organization_id) references public.asset_policy_versions(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(replaces_schedule_id,organization_id) references public.asset_depreciation_schedule(id,organization_id) on delete restrict,
  check ((status in ('posted','reversed'))=(transaction_id is not null and posted_at is not null))
);
create unique index asset_schedule_one_active_period on public.asset_depreciation_schedule(asset_id,period_start)
  where status in ('scheduled','posted');
create unique index asset_schedule_one_transaction on public.asset_depreciation_schedule(transaction_id) where transaction_id is not null;

create table public.asset_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  asset_id uuid not null,
  kind public.asset_event_kind not null,
  event_date date not null check(isfinite(event_date)),
  amount_minor bigint,
  transaction_id uuid,
  schedule_id uuid,
  reverses_event_id uuid,
  reason text not null check(nullif(btrim(reason),'') is not null),
  idempotency_key text not null check(nullif(btrim(idempotency_key),'') is not null),
  payload jsonb not null default '{}',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(organization_id,idempotency_key), unique(reverses_event_id),
  foreign key(asset_id,organization_id) references public.fixed_assets(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(schedule_id,organization_id) references public.asset_depreciation_schedule(id,organization_id) on delete restrict,
  foreign key(reverses_event_id,organization_id) references public.asset_events(id,organization_id) on delete restrict
);

create table public.asset_disposals (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null, asset_id uuid not null,
  disposal_date date not null, proceeds_minor bigint not null check(proceeds_minor>=0),
  carrying_value_minor bigint not null check(carrying_value_minor>=0), gain_loss_minor bigint not null,
  proceeds_account_id uuid, transaction_id uuid not null, event_id uuid not null, reversed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict, created_at timestamptz not null default now(),
  unique(id,organization_id), unique(transaction_id), unique(event_id),
  foreign key(asset_id,organization_id) references public.fixed_assets(id,organization_id) on delete restrict,
  foreign key(proceeds_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(event_id,organization_id) references public.asset_events(id,organization_id) on delete restrict,
  check((proceeds_minor=0) or proceeds_account_id is not null)
);
create unique index asset_one_active_disposal on public.asset_disposals(asset_id) where reversed_at is null;

create function app.guard_asset_transaction_reversal()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.status='posted' and new.status='reversed'
   and exists(select 1 from public.asset_events e where e.transaction_id=old.id)
   and current_setting('app.asset_reversal_transaction',true) is distinct from old.id::text then
   raise exception 'ASSET_USE_LINKED_REVERSAL' using errcode='23514';
 end if;
 return new;
end; $$;
create trigger guard_asset_transaction_reversal before update on public.transactions
for each row execute function app.guard_asset_transaction_reversal();

insert into public.capabilities(key,domain,description) values
 ('assets.read','assets','Read fixed assets, schedules, history, and reconciliation'),
 ('assets.register','assets','Register an asset against an explicitly reviewed acquisition journal'),
 ('assets.depreciate','assets','Post one scheduled depreciation journal per asset and period'),
 ('assets.adjust','assets','Record prospective policy changes and explicit impairments'),
 ('assets.dispose','assets','Dispose an asset and record proceeds and gain or loss'),
 ('assets.reverse','assets','Reverse and replace fixed-asset lifecycle events') on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role,c.key from (values('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c where c.domain='assets' on conflict do nothing;
insert into public.role_capabilities(role,capability_key) values('viewer','assets.read') on conflict do nothing;

alter table public.fixed_assets enable row level security;
alter table public.asset_policy_versions enable row level security;
alter table public.asset_depreciation_schedule enable row level security;
alter table public.asset_events enable row level security;
alter table public.asset_disposals enable row level security;
create policy fixed_assets_read on public.fixed_assets for select to authenticated using(app.has_capability(organization_id,'assets.read'));
create policy asset_policy_versions_read on public.asset_policy_versions for select to authenticated using(app.has_capability(organization_id,'assets.read'));
create policy asset_schedule_read on public.asset_depreciation_schedule for select to authenticated using(app.has_capability(organization_id,'assets.read'));
create policy asset_events_read on public.asset_events for select to authenticated using(app.has_capability(organization_id,'assets.read'));
create policy asset_disposals_read on public.asset_disposals for select to authenticated using(app.has_capability(organization_id,'assets.read'));
revoke all on public.fixed_assets,public.asset_policy_versions,public.asset_depreciation_schedule,public.asset_events,public.asset_disposals from public,anon,authenticated;
grant select on public.fixed_assets,public.asset_policy_versions,public.asset_depreciation_schedule,public.asset_events,public.asset_disposals to authenticated;

create function app.asset_posted_reductions(p_asset_id uuid,p_as_of date)
returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(e.amount_minor),0)::bigint from public.asset_events e
 where e.asset_id=p_asset_id and e.event_date<=p_as_of and e.kind in ('depreciation','impairment')
   and not exists(select 1 from public.asset_events r where r.reverses_event_id=e.id and r.event_date<=p_as_of);
$$;

create function app.build_asset_schedule(p_asset_id uuid,p_policy_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.asset_policy_versions%rowtype; finish date; cursor_date date; segment_end date;
 days_total integer; days_part integer; remaining bigint; amount bigint; carry bigint;
begin
 select * into p from public.asset_policy_versions where id=p_policy_id and asset_id=p_asset_id;
 if not found then raise exception 'ASSET_POLICY_NOT_FOUND' using errcode='23503'; end if;
 finish:=(p.effective_from + make_interval(months=>p.useful_life_months))::date-1;
 cursor_date:=p.effective_from; carry:=p.start_carrying_minor; remaining:=carry-p.residual_value_minor;
 days_total:=finish-p.effective_from+1;
 while cursor_date<=finish and remaining>0 loop
   segment_end:=least((date_trunc('month',cursor_date)::date+interval '1 month - 1 day')::date,finish);
   days_part:=segment_end-cursor_date+1;
   if segment_end=finish then amount:=remaining;
   elsif p.method='straight_line' then amount:=round((p.start_carrying_minor-p.residual_value_minor)::numeric*days_part/days_total)::bigint;
   else amount:=round(remaining::numeric*p.declining_rate_basis_points/10000*days_part/
     (make_date(extract(year from cursor_date)::int+1,1,1)-make_date(extract(year from cursor_date)::int,1,1)))::bigint;
     amount:=greatest(amount,1);
   end if;
   amount:=least(amount,remaining); carry:=carry-amount; remaining:=remaining-amount;
   insert into public.asset_depreciation_schedule(organization_id,asset_id,policy_version_id,period_start,period_end,depreciation_minor,closing_book_value_minor)
   values(p.organization_id,p.asset_id,p.id,cursor_date,segment_end,amount,carry);
   cursor_date:=segment_end+1;
 end loop;
end; $$;

create function public.register_fixed_asset(
 p_organization_id uuid,p_asset_code text,p_name text,p_acquisition_transaction_id uuid,
 p_cost_account_id uuid,p_accumulated_depreciation_account_id uuid,p_depreciation_expense_account_id uuid,
 p_impairment_expense_account_id uuid,p_gain_loss_account_id uuid,p_acquisition_cost_minor bigint,
 p_acquisition_date date,p_in_service_date date,p_useful_life_months integer,p_residual_value_minor bigint default 0,
 p_method public.asset_depreciation_method default 'straight_line',p_declining_rate_basis_points integer default null,
 p_description text default null,p_replaces_asset_id uuid default null,p_idempotency_key text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.fixed_assets%rowtype; tx public.transactions%rowtype; cost public.accounts%rowtype; accum public.accounts%rowtype;
 expense public.accounts%rowtype; impairment public.accounts%rowtype; gainloss public.accounts%rowtype; policy_id uuid; existing uuid; payload jsonb;
begin
 perform app.require_capability(p_organization_id,'assets.register');
 if nullif(btrim(p_asset_code),'') is null or nullif(btrim(p_name),'') is null or p_acquisition_cost_minor<=0
   or p_residual_value_minor<0 or p_residual_value_minor>=p_acquisition_cost_minor or p_useful_life_months not between 1 and 1200
   or p_acquisition_date is null or p_in_service_date<p_acquisition_date
   or (p_method='straight_line' and p_declining_rate_basis_points is not null)
   or (p_method='declining_balance' and p_declining_rate_basis_points not between 1 and 10000)
   or nullif(btrim(p_idempotency_key),'') is null then raise exception 'ASSET_INVALID_REGISTRATION' using errcode='22023'; end if;
 payload:=jsonb_build_object('code',btrim(p_asset_code),'name',btrim(p_name),'journal',p_acquisition_transaction_id,'cost',p_acquisition_cost_minor,
  'acquisition_date',p_acquisition_date,'in_service_date',p_in_service_date,'life',p_useful_life_months,'residual',p_residual_value_minor,
  'method',p_method,'rate',p_declining_rate_basis_points,'description',nullif(btrim(p_description),''),'accounts',jsonb_build_array(p_cost_account_id,p_accumulated_depreciation_account_id,p_depreciation_expense_account_id,p_impairment_expense_account_id,p_gain_loss_account_id),'replaces',p_replaces_asset_id);
 select asset_id into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if (select e.payload from public.asset_events e where e.organization_id=p_organization_id and e.idempotency_key=p_idempotency_key)<>payload then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return existing;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('asset-register:'||p_organization_id::text||':'||lower(btrim(p_asset_code)),0));
 select * into tx from public.transactions where id=p_acquisition_transaction_id and organization_id=p_organization_id and status='posted';
 if not found then raise exception 'ASSET_ACQUISITION_JOURNAL_REQUIRED' using errcode='23514'; end if;
 if tx.transaction_date<>p_acquisition_date then raise exception 'ASSET_ACQUISITION_DATE_MISMATCH' using errcode='23514'; end if;
 cost:=app.require_account(p_organization_id,p_cost_account_id,array['asset']::public.account_type[]);
 accum:=app.require_account(p_organization_id,p_accumulated_depreciation_account_id,array['asset']::public.account_type[]);
 expense:=app.require_account(p_organization_id,p_depreciation_expense_account_id,array['expense']::public.account_type[]);
 impairment:=app.require_account(p_organization_id,p_impairment_expense_account_id,array['expense']::public.account_type[]);
 gainloss:=app.require_account(p_organization_id,p_gain_loss_account_id,array['expense','revenue']::public.account_type[]);
 if cost.account_role<>'posting' or accum.account_role<>'posting' or expense.account_role<>'posting' or impairment.account_role<>'posting' or gainloss.account_role<>'posting'
   or cost.currency<>tx.currency_code or accum.currency<>tx.currency_code or expense.currency<>tx.currency_code or impairment.currency<>tx.currency_code or gainloss.currency<>tx.currency_code
   or accum.normal_balance<>'credit' or accum.contra_account_id is distinct from cost.id then raise exception 'ASSET_ACCOUNT_MAPPING_INVALID' using errcode='23514'; end if;
 if not exists(select 1 from public.transaction_entries e where e.transaction_id=tx.id and e.account_id=cost.id and e.side='debit' and e.amount_minor>=p_acquisition_cost_minor and e.posted_at is not null)
 then raise exception 'ASSET_COST_NOT_IN_ACQUISITION_JOURNAL' using errcode='23514'; end if;
 if p_replaces_asset_id is not null and not exists(select 1 from public.fixed_assets f where f.id=p_replaces_asset_id and f.organization_id=p_organization_id and f.status='corrected')
 then raise exception 'ASSET_REPLACEMENT_SOURCE_REQUIRED' using errcode='23514'; end if;
 insert into public.fixed_assets(organization_id,asset_code,name,description,currency_code,acquisition_date,in_service_date,acquisition_cost_minor,residual_value_minor,
  useful_life_months,depreciation_method,declining_rate_basis_points,cost_account_id,accumulated_depreciation_account_id,depreciation_expense_account_id,
  impairment_expense_account_id,gain_loss_account_id,acquisition_transaction_id,replaces_asset_id,created_by)
 values(p_organization_id,btrim(p_asset_code),btrim(p_name),nullif(btrim(p_description),''),tx.currency_code,p_acquisition_date,p_in_service_date,p_acquisition_cost_minor,p_residual_value_minor,
  p_useful_life_months,p_method,p_declining_rate_basis_points,p_cost_account_id,p_accumulated_depreciation_account_id,p_depreciation_expense_account_id,
  p_impairment_expense_account_id,p_gain_loss_account_id,p_acquisition_transaction_id,p_replaces_asset_id,auth.uid()) returning * into a;
 insert into public.asset_policy_versions(organization_id,asset_id,version,effective_from,start_carrying_minor,residual_value_minor,useful_life_months,method,declining_rate_basis_points,reason,created_by)
 values(p_organization_id,a.id,1,p_in_service_date,p_acquisition_cost_minor,p_residual_value_minor,p_useful_life_months,p_method,p_declining_rate_basis_points,'Initial approved policy',auth.uid()) returning id into policy_id;
 perform app.build_asset_schedule(a.id,policy_id);
 insert into public.asset_events(organization_id,asset_id,kind,event_date,amount_minor,transaction_id,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'acquisition',p_acquisition_date,p_acquisition_cost_minor,p_acquisition_transaction_id,'Explicit reviewed registration',p_idempotency_key,payload,auth.uid());
 perform app.write_audit(p_organization_id,'asset.registered','fixed_asset',a.id,null,payload);
 return a.id;
end; $$;

create function public.post_asset_depreciation(p_organization_id uuid,p_schedule_id uuid,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.asset_depreciation_schedule%rowtype; a public.fixed_assets%rowtype; tx uuid; existing public.asset_events%rowtype; payload jsonb;
begin
 perform app.require_capability(p_organization_id,'assets.depreciate');
 if nullif(btrim(p_idempotency_key),'') is null then raise exception 'ASSET_IDEMPOTENCY_REQUIRED' using errcode='22023'; end if;
 select * into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if existing.kind<>'depreciation' or existing.schedule_id is distinct from p_schedule_id then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return existing.transaction_id;
 end if;
 select * into s from public.asset_depreciation_schedule where id=p_schedule_id and organization_id=p_organization_id for update;
 if not found then raise exception 'ASSET_SCHEDULE_NOT_FOUND' using errcode='42501'; end if;
 select * into a from public.fixed_assets where id=s.asset_id and organization_id=p_organization_id for update;
 perform pg_advisory_xact_lock(hashtextextended('asset-depreciation:'||a.id::text||':'||s.period_start::text,0));
 if s.status='posted' then return s.transaction_id; end if;
 if s.status<>'scheduled' or a.status<>'active' or s.depreciation_minor<=0 then raise exception 'ASSET_SCHEDULE_NOT_POSTABLE' using errcode='23514'; end if;
 if exists(select 1 from public.asset_depreciation_schedule prior where prior.asset_id=a.id and prior.status='scheduled' and prior.period_start<s.period_start)
 then raise exception 'ASSET_PRIOR_DEPRECIATION_REQUIRED' using errcode='23514'; end if;
 payload:=jsonb_build_object('asset_id',a.id,'schedule_id',s.id,'period_start',s.period_start,'period_end',s.period_end,'amount',s.depreciation_minor);
 tx:=app.create_and_post(p_organization_id=>p_organization_id,p_type=>'adjustment',p_transaction_date=>s.period_end,
  p_lines=>jsonb_build_array(jsonb_build_object('account_id',a.depreciation_expense_account_id,'side','debit','amount_minor',s.depreciation_minor),jsonb_build_object('account_id',a.accumulated_depreciation_account_id,'side','credit','amount_minor',s.depreciation_minor)),
  p_currency_code=>a.currency_code,p_description=>'Depreciation — '||a.name,p_reference=>a.asset_code,p_adjustment_reason=>'Approved fixed-asset schedule',p_source=>'api',
  p_idempotency_key=>'asset-depreciation:'||a.id::text||':'||s.period_start::text,p_metadata=>payload);
 update public.asset_depreciation_schedule set status='posted',transaction_id=tx,posted_at=now() where id=s.id;
 insert into public.asset_events(organization_id,asset_id,kind,event_date,amount_minor,transaction_id,schedule_id,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'depreciation',s.period_end,s.depreciation_minor,tx,s.id,'Approved scheduled depreciation',p_idempotency_key,payload,auth.uid());
 perform app.write_audit(p_organization_id,'asset.depreciation_posted','fixed_asset',a.id,null,payload||jsonb_build_object('transaction_id',tx));
 return tx;
end; $$;

create function public.change_asset_depreciation_policy(p_organization_id uuid,p_asset_id uuid,p_effective_from date,p_residual_value_minor bigint,
 p_useful_life_months integer,p_method public.asset_depreciation_method,p_declining_rate_basis_points integer,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.fixed_assets%rowtype; next_open date; carry bigint; version_no integer; policy_id uuid; payload jsonb; existing public.asset_events%rowtype;
begin
 perform app.require_capability(p_organization_id,'assets.adjust');
 if nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'ASSET_CHANGE_REASON_REQUIRED' using errcode='22023'; end if;
 select * into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if existing.kind<>'policy_change' or existing.asset_id is distinct from p_asset_id or existing.event_date is distinct from p_effective_from
     or existing.reason is distinct from btrim(p_reason) or (existing.payload->>'residual')::bigint is distinct from p_residual_value_minor
     or (existing.payload->>'life')::integer is distinct from p_useful_life_months or existing.payload->>'method' is distinct from p_method::text
     or (existing.payload->>'rate')::integer is distinct from p_declining_rate_basis_points then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return (existing.payload->>'policy_version_id')::uuid;
 end if;
 select * into a from public.fixed_assets where id=p_asset_id and organization_id=p_organization_id for update;
 if not found or a.status<>'active' then raise exception 'ASSET_ACTIVE_REQUIRED' using errcode='23514'; end if;
 select min(start_date) into next_open from public.accounting_periods where organization_id=p_organization_id and status='open' and start_date>app.org_today(p_organization_id);
 if (next_open is not null and p_effective_from<>next_open) or (next_open is null and (p_effective_from<=app.org_today(p_organization_id) or extract(day from p_effective_from)<>1))
 then raise exception 'ASSET_CHANGE_NEXT_OPEN_PERIOD_REQUIRED' using errcode='23514'; end if;
 if exists(select 1 from public.asset_depreciation_schedule where asset_id=a.id and status='posted' and period_end>=p_effective_from)
 then raise exception 'ASSET_CHANGE_OVER_POSTED_SCHEDULE' using errcode='23514'; end if;
 if exists(select 1 from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start<p_effective_from)
 then raise exception 'ASSET_PRIOR_DEPRECIATION_REQUIRED' using errcode='23514'; end if;
 carry:=a.acquisition_cost_minor-app.asset_posted_reductions(a.id,p_effective_from-1);
 if p_residual_value_minor<0 or p_residual_value_minor>=carry or p_useful_life_months not between 1 and 1200
   or (p_method='straight_line' and p_declining_rate_basis_points is not null) or (p_method='declining_balance' and p_declining_rate_basis_points not between 1 and 10000)
 then raise exception 'ASSET_INVALID_POLICY' using errcode='22023'; end if;
 update public.asset_depreciation_schedule set status='superseded' where asset_id=a.id and status='scheduled' and period_start>=p_effective_from;
 select coalesce(max(version),0)+1 into version_no from public.asset_policy_versions where asset_id=a.id;
 insert into public.asset_policy_versions(organization_id,asset_id,version,effective_from,start_carrying_minor,residual_value_minor,useful_life_months,method,declining_rate_basis_points,reason,created_by)
 values(p_organization_id,a.id,version_no,p_effective_from,carry,p_residual_value_minor,p_useful_life_months,p_method,p_declining_rate_basis_points,btrim(p_reason),auth.uid()) returning id into policy_id;
 update public.fixed_assets set residual_value_minor=p_residual_value_minor,useful_life_months=p_useful_life_months,depreciation_method=p_method,declining_rate_basis_points=p_declining_rate_basis_points,updated_at=now() where id=a.id;
 perform app.build_asset_schedule(a.id,policy_id);
 payload:=jsonb_build_object('policy_version_id',policy_id,'effective_from',p_effective_from,'start_carrying_minor',carry,'residual',p_residual_value_minor,'life',p_useful_life_months,'method',p_method,'rate',p_declining_rate_basis_points);
 insert into public.asset_events(organization_id,asset_id,kind,event_date,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'policy_change',p_effective_from,btrim(p_reason),p_idempotency_key,payload,auth.uid());
 return policy_id;
end; $$;

create function public.record_asset_impairment(p_organization_id uuid,p_asset_id uuid,p_date date,p_amount_minor bigint,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.fixed_assets%rowtype; carry bigint; tx uuid; payload jsonb; existing public.asset_events%rowtype;
 next_start date; future_total bigint; future_remaining bigint; future_count integer; row_number integer:=0;
 new_amount bigint; new_closing bigint; policy_id uuid; version_no integer; remaining_months integer; schedule_row record;
begin
 perform app.require_capability(p_organization_id,'assets.adjust');
 select * into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if existing.kind<>'impairment' or existing.asset_id is distinct from p_asset_id or existing.event_date is distinct from p_date
     or existing.amount_minor is distinct from p_amount_minor or existing.reason is distinct from btrim(p_reason) then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return existing.transaction_id;
 end if;
 select * into a from public.fixed_assets where id=p_asset_id and organization_id=p_organization_id for update;
 if not found or a.status<>'active' or p_amount_minor<=0 or nullif(btrim(p_reason),'') is null then raise exception 'ASSET_INVALID_IMPAIRMENT' using errcode='22023'; end if;
 if exists(select 1 from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start<=p_date)
 then raise exception 'ASSET_DEPRECIATION_DUE_BEFORE_IMPAIRMENT' using errcode='23514'; end if;
 carry:=a.acquisition_cost_minor-app.asset_posted_reductions(a.id,p_date);
 if p_amount_minor>carry-a.residual_value_minor then raise exception 'ASSET_IMPAIRMENT_BELOW_RESIDUAL' using errcode='23514'; end if;
 payload:=jsonb_build_object('asset_id',a.id,'amount',p_amount_minor,'date',p_date,'reason',btrim(p_reason));
 tx:=app.create_and_post(p_organization_id=>p_organization_id,p_type=>'adjustment',p_transaction_date=>p_date,
  p_lines=>jsonb_build_array(jsonb_build_object('account_id',a.impairment_expense_account_id,'side','debit','amount_minor',p_amount_minor),jsonb_build_object('account_id',a.accumulated_depreciation_account_id,'side','credit','amount_minor',p_amount_minor)),
  p_currency_code=>a.currency_code,p_description=>'Asset impairment — '||a.name,p_reference=>a.asset_code,p_adjustment_reason=>btrim(p_reason),p_source=>'api',p_idempotency_key=>'asset-impairment:'||p_idempotency_key,p_metadata=>payload);
 insert into public.asset_events(organization_id,asset_id,kind,event_date,amount_minor,transaction_id,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'impairment',p_date,p_amount_minor,tx,btrim(p_reason),p_idempotency_key,payload,auth.uid());
 -- Rebase only unposted future rows. Their dates remain unchanged and their
 -- exact remaining total is reduced by the impairment without touching any
 -- posted schedule or original policy version.
 select min(period_start),coalesce(sum(depreciation_minor),0),count(*) into next_start,future_total,future_count
 from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start>p_date;
 if future_count>0 then
   future_remaining:=greatest(carry-p_amount_minor-a.residual_value_minor,0);
   new_closing:=carry-p_amount_minor;
   select coalesce(max(version),0)+1 into version_no from public.asset_policy_versions where asset_id=a.id;
   select greatest(1,ceil((max(period_end)-next_start+1)/30.44)::integer) into remaining_months
     from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start>p_date;
   insert into public.asset_policy_versions(organization_id,asset_id,version,effective_from,start_carrying_minor,residual_value_minor,useful_life_months,method,declining_rate_basis_points,reason,created_by)
   values(p_organization_id,a.id,version_no,next_start,new_closing,a.residual_value_minor,remaining_months,a.depreciation_method,a.declining_rate_basis_points,'Prospective schedule after impairment: '||btrim(p_reason),auth.uid()) returning id into policy_id;
   for schedule_row in select * from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start>p_date order by period_start for update loop
     row_number:=row_number+1;
     if row_number=future_count then new_amount:=future_remaining;
     elsif future_total=0 then new_amount:=0;
     else new_amount:=round((carry-p_amount_minor-a.residual_value_minor)::numeric*schedule_row.depreciation_minor/future_total)::bigint; end if;
     new_amount:=least(new_amount,future_remaining); future_remaining:=future_remaining-new_amount; new_closing:=new_closing-new_amount;
     update public.asset_depreciation_schedule set status='superseded' where id=schedule_row.id;
     if new_amount>0 then
       insert into public.asset_depreciation_schedule(organization_id,asset_id,policy_version_id,period_start,period_end,depreciation_minor,closing_book_value_minor,replaces_schedule_id)
       values(p_organization_id,a.id,policy_id,schedule_row.period_start,schedule_row.period_end,new_amount,new_closing,schedule_row.id);
     end if;
   end loop;
 end if;
 return tx;
end; $$;

create function public.dispose_fixed_asset(p_organization_id uuid,p_asset_id uuid,p_disposal_date date,p_proceeds_minor bigint,
 p_proceeds_account_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.fixed_assets%rowtype; accumulated bigint; carrying bigint; gainloss bigint; tx uuid; event_id uuid; lines jsonb:='[]'; existing public.asset_events%rowtype; payload jsonb; s public.asset_depreciation_schedule%rowtype; clipped bigint;
begin
 perform app.require_capability(p_organization_id,'assets.dispose');
 select * into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if existing.kind<>'disposal' or existing.asset_id is distinct from p_asset_id or existing.event_date is distinct from p_disposal_date
     or (existing.payload->>'proceeds')::bigint is distinct from p_proceeds_minor or existing.reason is distinct from btrim(p_reason)
     or (existing.payload->>'proceeds_account_id')::uuid is distinct from p_proceeds_account_id then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return existing.transaction_id;
 end if;
 select * into a from public.fixed_assets where id=p_asset_id and organization_id=p_organization_id for update;
 if not found or a.status<>'active' or p_disposal_date<a.in_service_date or p_proceeds_minor<0 or nullif(btrim(p_reason),'') is null then raise exception 'ASSET_INVALID_DISPOSAL' using errcode='22023'; end if;
 -- Capitalization stops on the disposal date. Post every due row in order and
 -- clip the row containing that date to exact daily proration.
 for s in select * from public.asset_depreciation_schedule where asset_id=a.id and status='scheduled' and period_start<=p_disposal_date order by period_start for update loop
   if s.period_end>p_disposal_date then
     clipped:=round(s.depreciation_minor::numeric*(p_disposal_date-s.period_start+1)/(s.period_end-s.period_start+1))::bigint;
     update public.asset_depreciation_schedule set period_end=p_disposal_date,depreciation_minor=clipped,
       closing_book_value_minor=closing_book_value_minor+(s.depreciation_minor-clipped) where id=s.id;
   end if;
   perform public.post_asset_depreciation(p_organization_id,s.id,'asset-disposal-depreciation:'||p_idempotency_key||':'||s.period_start::text);
 end loop;
 if p_proceeds_minor>0 then perform app.require_account(p_organization_id,p_proceeds_account_id,array['asset','liability']::public.account_type[]); end if;
 accumulated:=app.asset_posted_reductions(a.id,p_disposal_date); carrying:=greatest(a.acquisition_cost_minor-accumulated,0); gainloss:=p_proceeds_minor-carrying;
 if p_proceeds_minor>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',p_proceeds_account_id,'side','debit','amount_minor',p_proceeds_minor)); end if;
 if accumulated>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',a.accumulated_depreciation_account_id,'side','debit','amount_minor',accumulated)); end if;
 if gainloss<0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',a.gain_loss_account_id,'side','debit','amount_minor',abs(gainloss))); end if;
 lines:=lines||jsonb_build_array(jsonb_build_object('account_id',a.cost_account_id,'side','credit','amount_minor',a.acquisition_cost_minor));
 if gainloss>0 then lines:=lines||jsonb_build_array(jsonb_build_object('account_id',a.gain_loss_account_id,'side','credit','amount_minor',gainloss)); end if;
 payload:=jsonb_build_object('asset_id',a.id,'date',p_disposal_date,'proceeds',p_proceeds_minor,'proceeds_account_id',p_proceeds_account_id,'accumulated',accumulated,'carrying',carrying,'gain_loss',gainloss);
 tx:=app.create_and_post(p_organization_id=>p_organization_id,p_type=>'adjustment',p_transaction_date=>p_disposal_date,p_lines=>lines,
  p_currency_code=>a.currency_code,p_description=>'Asset disposal — '||a.name,p_reference=>a.asset_code,p_adjustment_reason=>btrim(p_reason),p_source=>'api',p_idempotency_key=>'asset-disposal:'||p_idempotency_key,p_metadata=>payload);
 insert into public.asset_events(organization_id,asset_id,kind,event_date,amount_minor,transaction_id,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'disposal',p_disposal_date,carrying,tx,btrim(p_reason),p_idempotency_key,payload,auth.uid()) returning id into event_id;
 insert into public.asset_disposals(organization_id,asset_id,disposal_date,proceeds_minor,carrying_value_minor,gain_loss_minor,proceeds_account_id,transaction_id,event_id,created_by)
 values(p_organization_id,a.id,p_disposal_date,p_proceeds_minor,carrying,gainloss,p_proceeds_account_id,tx,event_id,auth.uid());
 update public.fixed_assets set status='disposed',disposal_date=p_disposal_date,updated_at=now() where id=a.id;
 update public.asset_depreciation_schedule set status='superseded' where asset_id=a.id and status='scheduled';
 return tx;
end; $$;

create function public.reverse_fixed_asset_event(p_organization_id uuid,p_event_id uuid,p_reversal_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare e public.asset_events%rowtype; a public.fixed_assets%rowtype; tx uuid; reversal_id uuid; payload jsonb; existing public.asset_events%rowtype; s public.asset_depreciation_schedule%rowtype;
begin
 perform app.require_capability(p_organization_id,'assets.reverse');
 if nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'ASSET_REVERSAL_REASON_REQUIRED' using errcode='22023'; end if;
 select * into existing from public.asset_events where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then
   if existing.kind<>'reversal' or existing.payload->>'reverses_event_id' is distinct from p_event_id::text
     or existing.event_date is distinct from p_reversal_date or existing.reason is distinct from btrim(p_reason) then raise exception 'ASSET_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return existing.transaction_id;
 end if;
 select * into e from public.asset_events where id=p_event_id and organization_id=p_organization_id for update;
 if not found or e.kind not in ('acquisition','depreciation','impairment','disposal') or e.transaction_id is null
   or exists(select 1 from public.asset_events where reverses_event_id=e.id) then raise exception 'ASSET_EVENT_NOT_REVERSIBLE' using errcode='23514'; end if;
 select * into a from public.fixed_assets where id=e.asset_id and organization_id=p_organization_id for update;
 if e.kind='acquisition' and exists(select 1 from public.asset_events x where x.asset_id=a.id and x.kind in ('depreciation','impairment','disposal') and not exists(select 1 from public.asset_events r where r.reverses_event_id=x.id))
 then raise exception 'ASSET_REVERSE_LATER_EVENTS_FIRST' using errcode='23514'; end if;
 if e.kind='depreciation' and exists(select 1 from public.asset_events x where x.asset_id=a.id and x.kind='depreciation' and x.event_date>e.event_date and not exists(select 1 from public.asset_events r where r.reverses_event_id=x.id))
 then raise exception 'ASSET_REVERSE_LATER_DEPRECIATION_FIRST' using errcode='23514'; end if;
 if e.kind='impairment' and exists(select 1 from public.asset_events x where x.asset_id=a.id and x.kind in ('depreciation','policy_change','disposal') and x.event_date>e.event_date and not exists(select 1 from public.asset_events r where r.reverses_event_id=x.id))
 then raise exception 'ASSET_REVERSE_LATER_EVENTS_FIRST' using errcode='23514'; end if;
 perform set_config('app.asset_reversal_transaction',e.transaction_id::text,true);
 tx:=public.reverse_transaction(e.transaction_id,btrim(p_reason),p_reversal_date);
 perform set_config('app.asset_reversal_transaction','',true);
 payload:=jsonb_build_object('reverses_event_id',e.id,'reverses_transaction_id',e.transaction_id,'kind',e.kind);
 insert into public.asset_events(organization_id,asset_id,kind,event_date,amount_minor,transaction_id,reverses_event_id,reason,idempotency_key,payload,created_by)
 values(p_organization_id,a.id,'reversal',p_reversal_date,e.amount_minor,tx,e.id,btrim(p_reason),p_idempotency_key,payload,auth.uid()) returning id into reversal_id;
 if e.kind='depreciation' then
   update public.asset_depreciation_schedule set status='reversed' where id=e.schedule_id returning * into s;
   insert into public.asset_depreciation_schedule(organization_id,asset_id,policy_version_id,period_start,period_end,depreciation_minor,closing_book_value_minor,replaces_schedule_id)
   values(s.organization_id,s.asset_id,s.policy_version_id,s.period_start,s.period_end,s.depreciation_minor,s.closing_book_value_minor,s.id);
 elsif e.kind='impairment' then
   update public.asset_depreciation_schedule replacement set status='superseded'
    from public.asset_policy_versions policy where replacement.policy_version_id=policy.id and replacement.asset_id=a.id
      and replacement.status='scheduled' and replacement.replaces_schedule_id is not null
      and policy.reason like 'Prospective schedule after impairment:%' and policy.created_at>=e.created_at;
   update public.asset_depreciation_schedule original set status='scheduled'
    where original.id in (select replacement.replaces_schedule_id from public.asset_depreciation_schedule replacement
      join public.asset_policy_versions policy on policy.id=replacement.policy_version_id
      where replacement.asset_id=a.id and replacement.status='superseded' and replacement.replaces_schedule_id is not null
        and policy.reason like 'Prospective schedule after impairment:%' and policy.created_at>=e.created_at);
 elsif e.kind='disposal' then
   update public.asset_disposals set reversed_at=now() where event_id=e.id;
   update public.fixed_assets set status='active',disposal_date=null,updated_at=now() where id=a.id;
   update public.asset_depreciation_schedule set status='scheduled'
    where asset_id=a.id and status='superseded' and period_start>e.event_date
      and policy_version_id=(select id from public.asset_policy_versions where asset_id=a.id order by version desc limit 1);
 elsif e.kind='acquisition' then
   update public.fixed_assets set status='corrected',updated_at=now() where id=a.id;
   update public.asset_depreciation_schedule set status='superseded' where asset_id=a.id and status='scheduled';
 end if;
 perform app.write_audit(p_organization_id,'asset.event_reversed','fixed_asset',a.id,null,payload||jsonb_build_object('reversal_event_id',reversal_id));
 return tx;
end; $$;

create function public.reconcile_fixed_assets(p_organization_id uuid,p_as_of_date date)
returns table(account_id uuid,account_kind text,register_balance_minor bigint,gl_balance_minor bigint,variance_minor bigint) language plpgsql stable security definer set search_path='' as $$
begin
 perform app.require_capability(p_organization_id,'assets.read');
 return query with asset_state as (
   select f.*,exists(select 1 from public.asset_events acquisition where acquisition.asset_id=f.id and acquisition.kind='acquisition' and acquisition.event_date<=p_as_of_date
     and not exists(select 1 from public.asset_events reversal where reversal.reverses_event_id=acquisition.id and reversal.event_date<=p_as_of_date))
     and not exists(select 1 from public.asset_events disposal where disposal.asset_id=f.id and disposal.kind='disposal' and disposal.event_date<=p_as_of_date
       and not exists(select 1 from public.asset_events reversal where reversal.reverses_event_id=disposal.id and reversal.event_date<=p_as_of_date)) as active_at_date
   from public.fixed_assets f where f.organization_id=p_organization_id
 ), mappings as (
   select f.cost_account_id id,'cost' kind,sum(case when f.active_at_date then f.acquisition_cost_minor else 0 end)::bigint register
   from asset_state f group by f.cost_account_id
   union all
   select f.accumulated_depreciation_account_id,'accumulated_depreciation',sum(case when f.active_at_date then app.asset_posted_reductions(f.id,p_as_of_date) else 0 end)::bigint
   from asset_state f group by f.accumulated_depreciation_account_id
 ), combined as (select id,kind,sum(register)::bigint register from mappings group by id,kind), ledger as (
   select e.account_id,sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)::bigint balance
   from public.transaction_entries e join public.transactions t on t.id=e.transaction_id and t.organization_id=e.organization_id
   where e.organization_id=p_organization_id and e.posted_at is not null and t.transaction_date<=p_as_of_date group by e.account_id)
 select c.id,c.kind,c.register,case when c.kind='accumulated_depreciation' then -coalesce(l.balance,0) else coalesce(l.balance,0) end,
  c.register-(case when c.kind='accumulated_depreciation' then -coalesce(l.balance,0) else coalesce(l.balance,0) end)
 from combined c left join ledger l on l.account_id=c.id order by c.kind,c.id;
end; $$;

create function public.read_fixed_asset_workspace(p_organization_id uuid,p_as_of_date date default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d date:=coalesce(p_as_of_date,app.org_today(p_organization_id));
begin
 perform app.require_capability(p_organization_id,'assets.read');
 return jsonb_build_object(
  'as_of_date',d,
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.type,'subtype',a.subtype,'currency',a.currency,'role',a.account_role,'normal_balance',a.normal_balance,'contra_account_id',a.contra_account_id) order by a.name) from public.accounts a where a.organization_id=p_organization_id and a.is_active),'[]'::jsonb),
  'acquisition_journals',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'date',t.transaction_date,'description',t.description,'reference',t.reference,'currency',t.currency_code) order by t.transaction_date desc,t.created_at desc) from public.transactions t where t.organization_id=p_organization_id and t.status='posted' and t.type='asset_purchase' and not exists(select 1 from public.fixed_assets f where f.acquisition_transaction_id=t.id)),'[]'::jsonb),
  'assets',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'code',f.asset_code,'name',f.name,'status',f.status,'currency',f.currency_code,'acquisition_date',f.acquisition_date,'in_service_date',f.in_service_date,
    'cost_minor',f.acquisition_cost_minor::text,'accumulated_minor',app.asset_posted_reductions(f.id,d)::text,'nbv_minor',(case when (f.disposal_date is not null and f.disposal_date<=d) or f.status='corrected' then 0 else f.acquisition_cost_minor-app.asset_posted_reductions(f.id,d) end)::text,'residual_minor',f.residual_value_minor::text,
    'method',f.depreciation_method,'life_months',f.useful_life_months,'rate_basis_points',f.declining_rate_basis_points,'acquisition_transaction_id',f.acquisition_transaction_id,
    'cost_account_id',f.cost_account_id,'accumulated_account_id',f.accumulated_depreciation_account_id,'expense_account_id',f.depreciation_expense_account_id,'impairment_account_id',f.impairment_expense_account_id,'gain_loss_account_id',f.gain_loss_account_id,'disposal_date',f.disposal_date) order by f.asset_code) from public.fixed_assets f where f.organization_id=p_organization_id),'[]'::jsonb),
  'schedule',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'asset_id',s.asset_id,'period_start',s.period_start,'period_end',s.period_end,'amount_minor',s.depreciation_minor::text,'closing_nbv_minor',s.closing_book_value_minor::text,'status',s.status,'transaction_id',s.transaction_id,'replaces_schedule_id',s.replaces_schedule_id) order by s.period_start,s.created_at) from public.asset_depreciation_schedule s where s.organization_id=p_organization_id and s.status<>'superseded'),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'asset_id',e.asset_id,'kind',e.kind,'date',e.event_date,'amount_minor',e.amount_minor::text,'transaction_id',e.transaction_id,'schedule_id',e.schedule_id,'reverses_event_id',e.reverses_event_id,'reason',e.reason,'payload',e.payload,'created_at',e.created_at) order by e.event_date desc,e.created_at desc) from public.asset_events e where e.organization_id=p_organization_id),'[]'::jsonb),
  'reconciliation',coalesce((select jsonb_agg(jsonb_build_object('account_id',r.account_id,'kind',r.account_kind,'register_minor',r.register_balance_minor::text,'gl_minor',r.gl_balance_minor::text,'variance_minor',r.variance_minor::text)) from public.reconcile_fixed_assets(p_organization_id,d) r),'[]'::jsonb));
end; $$;

revoke all on function app.asset_posted_reductions(uuid,date),app.build_asset_schedule(uuid,uuid),app.guard_asset_transaction_reversal() from public,anon,authenticated;
revoke all on function public.register_fixed_asset(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,bigint,date,date,integer,bigint,public.asset_depreciation_method,integer,text,uuid,text),
 public.post_asset_depreciation(uuid,uuid,text),public.change_asset_depreciation_policy(uuid,uuid,date,bigint,integer,public.asset_depreciation_method,integer,text,text),
 public.record_asset_impairment(uuid,uuid,date,bigint,text,text),public.dispose_fixed_asset(uuid,uuid,date,bigint,uuid,text,text),
 public.reverse_fixed_asset_event(uuid,uuid,date,text,text),public.reconcile_fixed_assets(uuid,date),public.read_fixed_asset_workspace(uuid,date) from public,anon,authenticated;
grant execute on function public.register_fixed_asset(uuid,text,text,uuid,uuid,uuid,uuid,uuid,uuid,bigint,date,date,integer,bigint,public.asset_depreciation_method,integer,text,uuid,text),
 public.post_asset_depreciation(uuid,uuid,text),public.change_asset_depreciation_policy(uuid,uuid,date,bigint,integer,public.asset_depreciation_method,integer,text,text),
 public.record_asset_impairment(uuid,uuid,date,bigint,text,text),public.dispose_fixed_asset(uuid,uuid,date,bigint,uuid,text,text),
 public.reverse_fixed_asset_event(uuid,uuid,date,text,text),public.reconcile_fixed_assets(uuid,date),public.read_fixed_asset_workspace(uuid,date) to authenticated;

comment on table public.fixed_assets is 'Explicit register only. No historical purchase journal is inferred as an asset.';
comment on function public.change_asset_depreciation_policy(uuid,uuid,date,bigint,integer,public.asset_depreciation_method,integer,text,text) is 'Prospective V2-D09 policy change from the next open period; posted schedule history is immutable.';
