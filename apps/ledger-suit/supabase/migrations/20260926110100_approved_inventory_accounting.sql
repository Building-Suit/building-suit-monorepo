-- V2-IMP-014 / V2-D12. Inventory Suit supplies valuation; Ledger never costs stock.
create table public.inventory_accounting_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_key text not null check (length(btrim(source_key)) between 1 and 200),
  source_system text not null default 'inventory-suit' check (source_system = 'inventory-suit'),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  currency char(3) not null,
  effective_from date not null check (isfinite(effective_from)),
  control_account_id uuid not null unique,
  cogs_account_id uuid not null unique,
  offset_account_id uuid not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id), unique (organization_id, source_key),
  foreign key (control_account_id, organization_id) references public.control_account_bindings(account_id, organization_id),
  foreign key (cogs_account_id, organization_id) references public.accounts(id, organization_id),
  foreign key (offset_account_id, organization_id) references public.accounts(id, organization_id),
  check (control_account_id <> cogs_account_id and control_account_id <> offset_account_id and cogs_account_id <> offset_account_id)
);
create table public.inventory_accounting_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_id uuid not null,
  sequence bigint not null check (sequence > 0),
  movement_id text not null check (length(btrim(movement_id)) between 1 and 200),
  movement_version integer not null check (movement_version > 0),
  valuation_id text not null check (length(btrim(valuation_id)) between 1 and 200),
  valuation_version integer not null check (valuation_version > 0),
  costing_method text not null check (length(btrim(costing_method)) between 1 and 200),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 200),
  kind text not null check (kind in ('purchase','increase','decrease','customer_return','supplier_return','adjustment','revaluation','correction')),
  effective_date date not null check (isfinite(effective_date)),
  accounting_date date not null check (isfinite(accounting_date) and accounting_date >= effective_date),
  stock_quantity_after numeric not null check (stock_quantity_after >= 0 and stock_quantity_after < 'Infinity'::numeric),
  inventory_delta_minor bigint not null,
  cogs_delta_minor bigint not null,
  inventory_balance_after_minor bigint not null check (inventory_balance_after_minor >= 0),
  cogs_balance_after_minor bigint not null,
  related_fact_id uuid,
  reason text,
  transaction_id uuid not null unique,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (id, organization_id), unique(source_id, sequence),
  unique(source_id, movement_id, movement_version), unique(source_id, valuation_id, valuation_version),
  foreign key (source_id, organization_id) references public.inventory_accounting_sources(id, organization_id),
  foreign key (related_fact_id, organization_id) references public.inventory_accounting_facts(id, organization_id),
  foreign key (transaction_id, organization_id) references public.transactions(id, organization_id),
  check (inventory_delta_minor <> 0 or cogs_delta_minor <> 0)
);
create index inventory_facts_report on public.inventory_accounting_facts(organization_id, accounting_date, sequence);
comment on table public.inventory_accounting_facts is
  'Immutable received Inventory Suit incremental facts and source cumulative snapshots. Versions are deltas, never replacement totals. No operational stock valuation is computed here.';

insert into public.capabilities(key,domain,description) values
 ('inventory.read','inventory','Read inventory source evidence and GL reconciliation'),
 ('inventory.configure','inventory','Bind an Inventory Suit source actor and unused accounting mappings'),
 ('inventory.ingest','inventory','Accept facts from an explicitly bound Inventory Suit actor') on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role,c.key from (values ('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c where c.domain='inventory'
 and (c.key<>'inventory.configure' or r.role in ('owner','admin')) on conflict do nothing;
insert into public.role_capabilities(role,capability_key) values ('viewer','inventory.read') on conflict do nothing;
alter table public.inventory_accounting_sources enable row level security;
alter table public.inventory_accounting_facts enable row level security;
create policy inventory_sources_read on public.inventory_accounting_sources for select to authenticated
 using (app.has_capability(organization_id,'inventory.read'));
create policy inventory_facts_read on public.inventory_accounting_facts for select to authenticated
 using (app.has_capability(organization_id,'inventory.read'));
revoke all on public.inventory_accounting_sources,public.inventory_accounting_facts from public,anon,authenticated;
grant select on public.inventory_accounting_sources,public.inventory_accounting_facts to authenticated;

create function app.reject_inventory_evidence_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin raise exception 'IMMUTABLE_INVENTORY_EVIDENCE' using errcode='55000'; end;
$$;
create trigger inventory_sources_immutable before update or delete on public.inventory_accounting_sources
 for each row execute function app.reject_inventory_evidence_change();
create trigger inventory_facts_immutable before update or delete on public.inventory_accounting_facts
 for each row execute function app.reject_inventory_evidence_change();

-- Extend, rather than replace, the established customer/supplier binding validator.
create function app.validate_inventory_binding() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if tg_table_name='accounts' then v_id:=new.id; else v_id:=new.account_id; end if;
 if exists (select 1 from public.control_account_bindings b join public.accounts a on a.id=b.account_id
   where b.subledger_type='inventory' and a.id=v_id
   and (a.type<>'asset' or a.subtype<>'inventory' or a.normal_balance<>'debit')) then
   raise exception 'INVENTORY_CONTROL_INVALID' using errcode='23514';
 end if;
 return null;
end;
$$;
create constraint trigger inventory_validate_account after insert or update on public.accounts
 deferrable initially deferred for each row execute function app.validate_inventory_binding();
create constraint trigger inventory_validate_binding after insert or update on public.control_account_bindings
 deferrable initially deferred for each row execute function app.validate_inventory_binding();

create function app.guard_inventory_control_entry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists (select 1 from public.control_account_bindings b where b.account_id=new.account_id and b.subledger_type='inventory')
   and coalesce(current_setting('app.inventory_source',true),'') <> coalesce((select s.id::text
     from public.inventory_accounting_sources s where s.control_account_id=new.account_id),'unconfigured') then
   raise exception 'INVENTORY_SOURCE_REQUIRED' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger transaction_entries_guard_inventory before insert or update on public.transaction_entries
 for each row execute function app.guard_inventory_control_entry();

create function app.guard_inventory_mapping_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if row(new.organization_id,new.type,new.subtype,new.currency,new.normal_balance,new.contra_account_id,new.account_role)
   is distinct from row(old.organization_id,old.type,old.subtype,old.currency,old.normal_balance,old.contra_account_id,old.account_role)
   and exists(select 1 from public.inventory_accounting_sources s
     where old.id in(s.control_account_id,s.cogs_account_id,s.offset_account_id)) then
   raise exception 'INVENTORY_MAPPING_IMMUTABLE' using errcode='23514';
 end if;
 return new;
end;
$$;
create trigger accounts_guard_inventory_mapping before update on public.accounts
 for each row execute function app.guard_inventory_mapping_account();
revoke all on function app.guard_inventory_mapping_account() from public,anon,authenticated;

create function public.configure_inventory_source(p_organization_id uuid,p_source_key text,p_actor_id uuid,
 p_effective_from date,p_control_account_id uuid,p_cogs_account_id uuid,p_offset_account_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_currency char(3); v_control public.accounts%rowtype; v_cogs public.accounts%rowtype; v_offset public.accounts%rowtype;
begin
 perform app.require_capability(p_organization_id,'inventory.configure');
 if not app.subscription_writes_allowed(p_organization_id) then raise exception 'SUBSCRIPTION_READ_ONLY' using errcode='42501'; end if;
 -- Lock account rows against concurrent entry construction before checking clean history.
 perform 1 from public.accounts where id in (p_control_account_id,p_cogs_account_id,p_offset_account_id) order by id for update;
 select * into v_control from public.accounts where id=p_control_account_id and organization_id=p_organization_id;
 v_cogs := app.require_account(p_organization_id,p_cogs_account_id,array['expense']::public.account_type[]);
 v_offset := app.require_account(p_organization_id,p_offset_account_id);
 v_currency := app.org_base_currency(p_organization_id);
 if v_control.id is null or v_control.account_role<>'control' or v_control.type<>'asset' or v_control.subtype<>'inventory'
   or v_control.normal_balance<>'debit' or v_control.is_archived or v_control.currency<>v_currency
   or not exists(select 1 from public.control_account_bindings where account_id=p_control_account_id and subledger_type='inventory')
   or v_cogs.account_role<>'posting' or v_cogs.subtype<>'cost_of_sales' or v_cogs.normal_balance<>'debit'
   or v_cogs.currency<>v_currency or v_cogs.contra_account_id is not null
   or v_offset.account_role<>'posting' or v_offset.currency<>v_currency or v_offset.contra_account_id is not null
   or v_offset.id=v_cogs.id or v_offset.subtype in ('inventory','cost_of_sales') then
   raise exception 'INVENTORY_MAPPING_INVALID' using errcode='23514';
 end if;
 if not exists(select 1 from public.organization_members where organization_id=p_organization_id and user_id=p_actor_id and status='active') then
   raise exception 'INVENTORY_ACTOR_INVALID' using errcode='23514';
 end if;
 if exists(select 1 from public.transaction_entries where account_id in(p_control_account_id,p_cogs_account_id)) then
   raise exception 'INVENTORY_MAPPING_HAS_HISTORY' using errcode='23514';
 end if;
 insert into public.inventory_accounting_sources(organization_id,source_key,actor_id,currency,effective_from,
   control_account_id,cogs_account_id,offset_account_id,created_by)
 values(p_organization_id,btrim(p_source_key),p_actor_id,v_currency,p_effective_from,p_control_account_id,p_cogs_account_id,p_offset_account_id,auth.uid()) returning id into v_id;
 perform app.write_audit(p_organization_id,'inventory.source_configured','inventory_source',v_id,null,
   jsonb_build_object('source_key',btrim(p_source_key),'actor_id',p_actor_id));
 return v_id;
end;
$$;

-- Exact JSON integers are strings at the wire boundary. The actor is authenticated
-- in this Ledger project and explicitly bound by an authorized administrator.
create function public.ingest_inventory_fact(p_organization_id uuid,p_source_id uuid,p_fact jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 v_source public.inventory_accounting_sources%rowtype; v_previous public.inventory_accounting_facts%rowtype;
 v_existing public.inventory_accounting_facts%rowtype; v_related public.inventory_accounting_facts%rowtype;
 v_fact public.inventory_accounting_facts%rowtype; v_id uuid:=gen_random_uuid(); v_tx uuid; v_lines jsonb;
 v_offset bigint; v_latest_version integer; v_valuation_version integer;
begin
 perform app.require_capability(p_organization_id,'inventory.ingest');
 perform app.require_capability(p_organization_id,'transactions.create');
 perform app.require_capability(p_organization_id,'transactions.post');
 perform app.require_capability(p_organization_id,'transactions.adjust');
 if exists(select 1 from public.organization_settings where organization_id=p_organization_id and require_adjustment_approval) then
   raise exception 'INVENTORY_ADJUSTMENT_APPROVAL_REQUIRED' using errcode='42501';
 end if;
 if not app.subscription_writes_allowed(p_organization_id) then raise exception 'SUBSCRIPTION_READ_ONLY' using errcode='42501'; end if;
 select * into v_source from public.inventory_accounting_sources where id=p_source_id and organization_id=p_organization_id for update;
 if not found or v_source.actor_id<>auth.uid() then raise exception 'INVENTORY_SOURCE_ACTOR_REQUIRED' using errcode='42501'; end if;
 if v_source.currency<>app.org_base_currency(p_organization_id) then raise exception 'INVENTORY_CURRENCY_CHANGED' using errcode='23514'; end if;
 if jsonb_typeof(p_fact) is distinct from 'object' or p_fact->>'schema_version' is distinct from '1'
   or p_fact->>'currency' is distinct from v_source.currency::text
   or p_fact->'negative_stock' is distinct from 'false'::jsonb then
   raise exception 'INVENTORY_FACT_INVALID' using errcode='22023';
 end if;
 if exists(select 1 from jsonb_object_keys(p_fact) k where k<>all(array[
   'schema_version','currency','negative_stock','sequence','movement_id','movement_version','valuation_id','valuation_version',
   'costing_method','policy_version','kind','effective_date','accounting_date','stock_quantity_after','inventory_delta_minor',
   'cogs_delta_minor','inventory_balance_after_minor','cogs_balance_after_minor','related_fact_id','reason'])) then
   raise exception 'INVENTORY_UNSUPPORTED_FACT_FIELD' using errcode='22023';
 end if;
 if exists(select 1 from unnest(array['sequence','inventory_delta_minor','cogs_delta_minor','inventory_balance_after_minor','cogs_balance_after_minor']) k
   where jsonb_typeof(p_fact->k) is distinct from 'string' or coalesce(p_fact->>k,'') !~ '^-?(0|[1-9][0-9]*)$') then
   raise exception 'INVENTORY_EXACT_INTEGER_REQUIRED' using errcode='22023';
 end if;
 select * into v_fact from jsonb_populate_record(null::public.inventory_accounting_facts,p_fact);
 if v_fact.sequence is null or v_fact.movement_id is null or v_fact.movement_version is null
   or v_fact.valuation_id is null or v_fact.valuation_version is null or v_fact.costing_method is null or v_fact.policy_version is null
   or v_fact.kind is null or v_fact.effective_date is null or v_fact.accounting_date is null or v_fact.stock_quantity_after is null
   or v_fact.stock_quantity_after<0 or v_fact.stock_quantity_after>='Infinity'::numeric
   or not isfinite(v_fact.effective_date) or not isfinite(v_fact.accounting_date)
   or v_fact.effective_date<v_source.effective_from or v_fact.accounting_date<v_fact.effective_date
   or v_fact.inventory_balance_after_minor<0 or (v_fact.inventory_delta_minor=0 and v_fact.cogs_delta_minor=0) then
   raise exception 'INVENTORY_FACT_INVALID' using errcode='22023';
 end if;
 select * into v_existing from public.inventory_accounting_facts
   where source_id=p_source_id and (sequence=v_fact.sequence
     or (movement_id=v_fact.movement_id and movement_version=v_fact.movement_version)
     or (valuation_id=v_fact.valuation_id and valuation_version=v_fact.valuation_version)) limit 1;
 if found then
   if v_existing.payload is distinct from p_fact then raise exception 'INVENTORY_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
   return v_existing.id;
 end if;
 select * into v_previous from public.inventory_accounting_facts where source_id=p_source_id order by sequence desc limit 1;
 if v_fact.sequence<>coalesce(v_previous.sequence,0)+1 then raise exception 'INVENTORY_SEQUENCE_GAP' using errcode='23514'; end if;
 if v_fact.inventory_balance_after_minor::numeric <> coalesce(v_previous.inventory_balance_after_minor,0)::numeric+v_fact.inventory_delta_minor
   or v_fact.cogs_balance_after_minor::numeric <> coalesce(v_previous.cogs_balance_after_minor,0)::numeric+v_fact.cogs_delta_minor then
   raise exception 'INVENTORY_SNAPSHOT_VARIANCE' using errcode='23514';
 end if;
 select max(movement_version) into v_latest_version from public.inventory_accounting_facts where source_id=p_source_id and movement_id=v_fact.movement_id;
 if v_fact.movement_version<>coalesce(v_latest_version,0)+1
   or (v_latest_version is not null and v_fact.kind<>'correction') then
   raise exception 'INVENTORY_MOVEMENT_VERSION_INVALID' using errcode='23514';
 end if;
 select max(valuation_version) into v_valuation_version from public.inventory_accounting_facts where source_id=p_source_id and valuation_id=v_fact.valuation_id;
 if v_fact.valuation_version<>coalesce(v_valuation_version,0)+1
   or (v_valuation_version is not null and v_fact.kind<>'correction') then
   raise exception 'INVENTORY_VALUATION_VERSION_INVALID' using errcode='23514';
 end if;
 if v_fact.kind in ('customer_return','supplier_return','correction') or v_latest_version is not null then
   select * into v_related from public.inventory_accounting_facts where id=v_fact.related_fact_id and source_id=p_source_id;
   if not found or (v_fact.kind='customer_return' and v_related.kind<>'decrease')
     or (v_fact.kind='supplier_return' and v_related.kind not in ('purchase','increase'))
     or (v_latest_version is not null and (v_related.movement_id<>v_fact.movement_id or v_related.movement_version<>v_latest_version)) then
     raise exception 'INVENTORY_RELATED_FACT_REQUIRED' using errcode='23514';
   end if;
 elsif v_fact.related_fact_id is not null then
   if not exists(select 1 from public.inventory_accounting_facts where id=v_fact.related_fact_id and source_id=p_source_id) then
     raise exception 'INVENTORY_RELATED_FACT_REQUIRED' using errcode='23514';
   end if;
 end if;
 if (v_fact.kind in ('adjustment','revaluation','correction','customer_return','supplier_return') or v_fact.accounting_date<>v_fact.effective_date)
   and nullif(btrim(v_fact.reason),'') is null then raise exception 'INVENTORY_REASON_REQUIRED' using errcode='22023'; end if;
 if (v_fact.kind in ('purchase','increase') and (v_fact.inventory_delta_minor<=0 or v_fact.cogs_delta_minor<>0))
   or (v_fact.kind='decrease' and (v_fact.inventory_delta_minor>=0 or v_fact.cogs_delta_minor::numeric<>-v_fact.inventory_delta_minor::numeric))
   or (v_fact.kind='customer_return' and (v_fact.inventory_delta_minor<=0 or v_fact.cogs_delta_minor::numeric<>-v_fact.inventory_delta_minor::numeric))
   or (v_fact.kind='supplier_return' and (v_fact.inventory_delta_minor>=0 or v_fact.cogs_delta_minor<>0)) then
   raise exception 'INVENTORY_TREATMENT_INVALID' using errcode='23514';
 end if;
 -- Backdating/corrections remain explicit source deltas. Ordinary source posting
 -- cannot override soft/hard closed periods or silently move the accounting date.
 perform app.begin_control_posting(p_organization_id,v_source.control_account_id,'inventory',v_id::text,v_fact.accounting_date,'subledger');
 perform set_config('app.inventory_source',p_source_id::text,true);
 v_offset := -(v_fact.inventory_delta_minor::numeric+v_fact.cogs_delta_minor::numeric);
 select jsonb_agg(jsonb_build_object('account_id',x.account_id,'side',case when x.amount>0 then 'debit' else 'credit' end,
   'amount_minor',abs(x.amount)::text)) into v_lines
 from (values(v_source.control_account_id,v_fact.inventory_delta_minor::numeric),
   (v_source.cogs_account_id,v_fact.cogs_delta_minor::numeric),(v_source.offset_account_id,v_offset::numeric)) x(account_id,amount) where x.amount<>0;
 v_tx:=app.create_and_post(p_organization_id,'adjustment',v_fact.accounting_date,v_lines,
   p_adjustment_reason=>coalesce(nullif(btrim(v_fact.reason),''),'Inventory Suit source fact'),
   p_currency_code=>v_source.currency,p_description=>'Inventory Suit: '||v_fact.kind,p_reference=>v_fact.movement_id,
   p_source=>'api',p_idempotency_key=>'inventory:'||p_source_id::text||':'||v_fact.sequence::text,
   p_metadata=>jsonb_build_object('inventory_fact_id',v_id,'inventory_source_id',p_source_id,
     'movement_id',v_fact.movement_id,'movement_version',v_fact.movement_version,'valuation_id',v_fact.valuation_id,'valuation_version',v_fact.valuation_version));
 insert into public.inventory_accounting_facts(id,organization_id,source_id,sequence,movement_id,movement_version,
   valuation_id,valuation_version,costing_method,policy_version,kind,effective_date,accounting_date,stock_quantity_after,
   inventory_delta_minor,cogs_delta_minor,inventory_balance_after_minor,cogs_balance_after_minor,related_fact_id,reason,transaction_id,payload,created_by)
 values(v_id,p_organization_id,p_source_id,v_fact.sequence,v_fact.movement_id,v_fact.movement_version,
   v_fact.valuation_id,v_fact.valuation_version,v_fact.costing_method,v_fact.policy_version,v_fact.kind,v_fact.effective_date,v_fact.accounting_date,v_fact.stock_quantity_after,
   v_fact.inventory_delta_minor,v_fact.cogs_delta_minor,v_fact.inventory_balance_after_minor,v_fact.cogs_balance_after_minor,v_fact.related_fact_id,v_fact.reason,v_tx,p_fact,auth.uid());
 perform app.write_audit(p_organization_id,'inventory.fact_posted','inventory_fact',v_id,null,
   jsonb_build_object('source_id',p_source_id,'sequence',v_fact.sequence::text,'transaction_id',v_tx));
 perform set_config('app.inventory_source','',true);
 perform app.end_control_posting();
 return v_id;
end;
$$;

-- Use the existing atomic account/binding command, including account quota checks.
create function public.create_inventory_control_account(p_organization_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform app.require_capability(p_organization_id,'inventory.configure');
 return public.create_account(p_organization_id,p_name,'asset','inventory',
   p_account_role=>'control',p_control_subledger_type=>'inventory');
end;
$$;

create function app.control_subledger_balance_before_inventory(p_organization_id uuid,p_control_account_id uuid,
  p_subledger_type public.control_subledger_type,p_as_of_date date)
returns table(provider_available boolean,balance_minor bigint,provider_reference text)
language sql stable security definer set search_path='' as $$
  select p_subledger_type in ('customer','supplier'),
    case when p_subledger_type='customer' then
      (select coalesce(sum(d.ar_effect_minor),0)::bigint from public.ar_documents d
        where d.organization_id=p_organization_id and d.control_account_id=p_control_account_id and d.document_date<=p_as_of_date)
    when p_subledger_type='supplier' then
      (select coalesce(sum(d.ap_effect_minor),0)::bigint from public.ap_documents d
        where d.organization_id=p_organization_id and d.control_account_id=p_control_account_id and d.document_date<=p_as_of_date)
    else null::bigint end,
    case when p_subledger_type='customer' then 'ar_documents:v1'
      when p_subledger_type='supplier' then 'ap_documents:v1' else 'not_implemented' end;
$$;

revoke all on function app.control_subledger_balance_before_inventory(uuid,uuid,public.control_subledger_type,date) from public,anon,authenticated;
create or replace function app.control_subledger_balance(p_organization_id uuid,p_control_account_id uuid,
 p_subledger_type public.control_subledger_type,p_as_of_date date)
returns table(provider_available boolean,balance_minor bigint,provider_reference text)
language plpgsql stable security definer set search_path='' as $$
begin
 if p_subledger_type<>'inventory' then
   return query select * from app.control_subledger_balance_before_inventory(p_organization_id,p_control_account_id,p_subledger_type,p_as_of_date);
 else
   return query select exists(select 1 from public.inventory_accounting_facts f join public.inventory_accounting_sources s on s.id=f.source_id
       where s.organization_id=p_organization_id and s.control_account_id=p_control_account_id),
     coalesce(sum(f.inventory_delta_minor),0)::bigint,'inventory-suit:versioned-facts:v1'::text
   from public.inventory_accounting_facts f join public.inventory_accounting_sources s on s.id=f.source_id
   where s.organization_id=p_organization_id and s.control_account_id=p_control_account_id and f.accounting_date<=p_as_of_date;
 end if;
end;
$$;

create function public.read_inventory_workspace(p_organization_id uuid,p_as_of_date date,p_offset integer default 0,p_limit integer default 25,p_fact_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_sources jsonb; v_facts jsonb; v_accounts jsonb; v_total bigint;
begin
 perform app.require_capability(p_organization_id,'inventory.read');
 if p_as_of_date is null or not isfinite(p_as_of_date) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 100 then
   raise exception 'INVENTORY_REPORT_RANGE_INVALID' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.source_key),'[]'::jsonb) into v_sources from (
   select s.*, totals.inventory::text as inventory_minor,totals.cogs::text as cogs_minor,
     gl.inventory::text as inventory_gl_minor,gl.cogs::text as cogs_gl_minor,gl.closing::text as cogs_closing_minor,
     (gl.inventory-totals.inventory)::text as inventory_variance_minor,(gl.cogs-totals.cogs)::text as cogs_variance_minor,
     latest.sequence::text as latest_sequence,latest.inventory_balance_after_minor::text as source_inventory_snapshot_minor,
     latest.cogs_balance_after_minor::text as source_cogs_snapshot_minor,
     (latest.inventory_balance_after_minor-all_facts.inventory)::text as source_inventory_variance_minor,
     (latest.cogs_balance_after_minor-all_facts.cogs)::text as source_cogs_variance_minor,
     case when latest.id is null then 'awaiting_source'
       when gl.inventory=totals.inventory and gl.cogs=totals.cogs and latest.inventory_balance_after_minor=all_facts.inventory
         and latest.cogs_balance_after_minor=all_facts.cogs then 'reconciled' else 'unreconciled' end as status
   from public.inventory_accounting_sources s
   cross join lateral (select coalesce(sum(f.inventory_delta_minor),0) inventory,coalesce(sum(f.cogs_delta_minor),0) cogs
     from public.inventory_accounting_facts f where f.source_id=s.id and f.accounting_date<=p_as_of_date) totals
   cross join lateral (select coalesce(sum(f.inventory_delta_minor),0) inventory,coalesce(sum(f.cogs_delta_minor),0) cogs
     from public.inventory_accounting_facts f where f.source_id=s.id) all_facts
   left join lateral (select * from public.inventory_accounting_facts f where f.source_id=s.id order by f.sequence desc limit 1) latest on true
   cross join lateral (select
     coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end) filter(where e.account_id=s.control_account_id),0) inventory,
     coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end) filter(where e.account_id=s.cogs_account_id and t.source<>'year_end_close'),0) cogs,
     coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end) filter(where e.account_id=s.cogs_account_id and t.source='year_end_close'),0) closing
     from public.transaction_entries e join public.transactions t on t.id=e.transaction_id
     where e.organization_id=s.organization_id and e.account_id in(s.control_account_id,s.cogs_account_id)
       and e.posted_at is not null and e.entry_date<=p_as_of_date) gl
   where s.organization_id=p_organization_id
 ) r;
 select count(*) into v_total from public.inventory_accounting_facts where organization_id=p_organization_id and accounting_date<=p_as_of_date and (p_fact_id is null or id=p_fact_id);
 select coalesce(jsonb_agg(to_jsonb(r) order by r.accounting_date desc,r.created_at desc,r.id),'[]'::jsonb) into v_facts from (
   select f.id,f.source_id,f.sequence::text,f.movement_id,f.movement_version,f.valuation_id,f.valuation_version,
     f.costing_method,f.policy_version,f.kind,f.effective_date,f.accounting_date,f.stock_quantity_after::text,
     f.inventory_delta_minor::text,f.cogs_delta_minor::text,f.related_fact_id,f.reason,f.transaction_id,f.created_at,
     t.journal_reference
   from public.inventory_accounting_facts f join public.transactions t on t.id=f.transaction_id
   where f.organization_id=p_organization_id and f.accounting_date<=p_as_of_date and (p_fact_id is null or f.id=p_fact_id)
   order by f.accounting_date desc,f.created_at desc,f.id limit p_limit offset p_offset
 ) r;
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'code',a.code,'type',a.type,'subtype',a.subtype,
   'role',a.account_role,'subledger',b.subledger_type) order by a.code,a.name),'[]'::jsonb) into v_accounts
 from public.accounts a left join public.control_account_bindings b on b.account_id=a.id
 where a.organization_id=p_organization_id and not a.is_archived and a.currency=app.org_base_currency(p_organization_id)
   and a.account_role<>'group';
 return jsonb_build_object('as_of_date',p_as_of_date,'currency',app.org_base_currency(p_organization_id),
   'sources',v_sources,'facts',v_facts,'accounts',v_accounts,'total',v_total,'offset',p_offset,'limit',p_limit);
end;
$$;
revoke all on function app.reject_inventory_evidence_change(),app.validate_inventory_binding(),app.guard_inventory_control_entry(),
 app.control_subledger_balance(uuid,uuid,public.control_subledger_type,date) from public,anon,authenticated;
revoke all on function public.configure_inventory_source(uuid,text,uuid,date,uuid,uuid,uuid),
 public.create_inventory_control_account(uuid,text),public.ingest_inventory_fact(uuid,uuid,jsonb),
 public.read_inventory_workspace(uuid,date,integer,integer,uuid) from public,anon;
grant execute on function public.configure_inventory_source(uuid,text,uuid,date,uuid,uuid,uuid),
 public.create_inventory_control_account(uuid,text),public.ingest_inventory_fact(uuid,uuid,jsonb),
 public.read_inventory_workspace(uuid,date,integer,integer,uuid) to authenticated;

-- Preserve the existing view columns and all previous source relationships.
create or replace view public.transaction_summaries
with (security_invoker = true) as
select
  t.id,
  t.organization_id,
  t.type,
  t.status,
  t.source,
  t.transaction_date,
  t.posting_date,
  t.currency_code,
  t.exchange_rate,
  t.description,
  t.reference,
  t.memo,
  t.adjustment_reason,
  t.counterparty_id,
  t.category_id,
  t.possible_duplicate,
  t.reverses_transaction_id,
  t.reversed_by_transaction_id,
  t.created_by,
  t.posted_by,
  t.posted_at,
  t.created_at,
  t.updated_at,
  coalesce(totals.debit_minor, 0) as amount_minor,
  coalesce(totals.base_debit_minor, 0) as base_amount_minor,
  coalesce(totals.line_count, 0) as line_count,
  credit_side.account_id as from_account_id,
  credit_side.account_name as from_account_name,
  debit_side.account_id as to_account_id,
  debit_side.account_name as to_account_name,
  cat.name as category_name,
  cp.name as counterparty_name,
  author.full_name as created_by_name,
  author.email as created_by_email,
  coalesce(tag_list.tags, array[]::text[]) as tags,
  coalesce(tag_list.tag_ids, array[]::uuid[]) as tag_ids,
  coalesce(files.attachment_count, 0) as attachment_count,
  t.journal_reference,
  coalesce(totals.debit_minor, 0) as debit_minor,
  coalesce(totals.credit_minor, 0) as credit_minor,
  coalesce(totals.base_debit_minor, 0) as base_debit_minor,
  coalesce(totals.base_credit_minor, 0) as base_credit_minor,
  t.correction_of_transaction_id,
  source_record.kind as source_record_kind,
  source_record.record_id as source_record_id,
  source_record.parent_id as source_record_parent_id
from public.transactions t
left join lateral (
  select
    coalesce(sum(e.amount_minor) filter (where e.side = 'debit'), 0)::bigint as debit_minor,
    coalesce(sum(e.amount_minor) filter (where e.side = 'credit'), 0)::bigint as credit_minor,
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'debit'), 0)::bigint as base_debit_minor,
    coalesce(sum(e.base_amount_minor) filter (where e.side = 'credit'), 0)::bigint as base_credit_minor,
    count(*)::int as line_count
  from public.transaction_entries e
  where e.transaction_id = t.id
) totals on true
left join lateral (
  select a.id as account_id, a.name as account_name
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = t.id and e.side = 'credit'
  order by e.base_amount_minor desc, e.entry_index
  limit 1
) credit_side on true
left join lateral (
  select a.id as account_id, a.name as account_name
  from public.transaction_entries e
  join public.accounts a on a.id = e.account_id
  where e.transaction_id = t.id and e.side = 'debit'
  order by e.base_amount_minor desc, e.entry_index
  limit 1
) debit_side on true
left join lateral (
  select array_agg(tg.name order by tg.name) as tags,
         array_agg(tg.id order by tg.name) as tag_ids
  from public.transaction_tags tt
  join public.tags tg on tg.id = tt.tag_id
  where tt.transaction_id = t.id
) tag_list on true
left join lateral (
  select count(*)::int as attachment_count
  from public.attachments attachment
  where attachment.entity_type = 'transaction' and attachment.entity_id = t.id
) files on true
left join lateral (
  select candidate.kind, candidate.record_id, candidate.parent_id
  from (
    select 'commitment'::text as kind, settlement.id as record_id,
           settlement.commitment_id as parent_id, 1 as precedence
    from public.commitment_settlements settlement
    where settlement.transaction_id = t.id
    union all
    select 'inventory'::text, fact.id, fact.source_id, 0
    from public.inventory_accounting_facts fact where fact.transaction_id=t.id
    union all
    select 'recurring'::text, occurrence.id, occurrence.rule_id, 2
    from public.recurring_occurrences occurrence
    where occurrence.transaction_id = t.id
    union all
    select 'import'::text, import_row.id, import_row.batch_id, 3
    from public.import_rows import_row
    where import_row.transaction_id = t.id
  ) candidate
  order by candidate.precedence
  limit 1
) source_record on true
left join public.categories cat on cat.id = t.category_id
left join public.counterparties cp on cp.id = t.counterparty_id
left join public.profiles author on author.id = t.created_by
where t.deleted_at is null;

