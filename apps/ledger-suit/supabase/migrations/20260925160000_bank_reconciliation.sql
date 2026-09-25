-- V2-IMP-010 / approved V2-D08: exact bank reconciliation without reposting.
create type public.bank_reconciliation_status as enum ('review','completed','reopened');
create type public.bank_statement_line_status as enum ('unmatched','matched','unresolved');

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  bank_account_id uuid not null,
  currency_code char(3) not null references public.currencies(code),
  statement_start date not null check (isfinite(statement_start)),
  statement_end date not null check (isfinite(statement_end) and statement_end >= statement_start),
  opening_balance_minor bigint not null,
  closing_balance_minor bigint not null,
  file_name text not null check (nullif(btrim(file_name),'') is not null),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  status public.bank_reconciliation_status not null default 'review',
  import_errors jsonb not null default '[]' check (jsonb_typeof(import_errors)='array'),
  completed_ledger_balance_minor bigint,
  completed_outstanding_minor bigint,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(id,organization_id),
  unique(organization_id,file_sha256),
  foreign key(bank_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  check ((status='completed')=(completed_at is not null)),
  check ((completed_at is null)=(completed_by is null))
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  source_row integer not null check(source_row>0),
  transaction_date date,
  amount_minor bigint,
  description text not null default '',
  external_reference text,
  line_identity text not null,
  status public.bank_statement_line_status not null,
  validation_error text,
  duplicate_of_line_id uuid,
  raw_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(id,organization_id),
  unique(reconciliation_id,source_row),
  foreign key(reconciliation_id,organization_id) references public.bank_reconciliations(id,organization_id) on delete restrict,
  foreign key(duplicate_of_line_id,organization_id) references public.bank_statement_lines(id,organization_id) on delete restrict,
  check ((validation_error is null and transaction_date is not null and amount_minor is not null and amount_minor<>0)
      or (validation_error is not null and status='unresolved')),
  check (duplicate_of_line_id is null or validation_error='DUPLICATE_STATEMENT_LINE')
);
create index bank_statement_lines_reconciliation on public.bank_statement_lines(reconciliation_id,source_row);
create index bank_statement_lines_identity on public.bank_statement_lines(organization_id,line_identity);

create table public.bank_match_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  idempotency_key text not null check(nullif(btrim(idempotency_key),'') is not null),
  request_payload jsonb not null,
  statement_total_minor bigint not null,
  ledger_total_minor bigint not null,
  active boolean not null default true,
  matched_by uuid not null references public.profiles(id) on delete restrict,
  matched_at timestamptz not null default now(),
  unmatched_by uuid references public.profiles(id) on delete restrict,
  unmatched_at timestamptz,
  unmatch_reason text,
  unique(id,organization_id),
  unique(organization_id,idempotency_key),
  foreign key(reconciliation_id,organization_id) references public.bank_reconciliations(id,organization_id) on delete restrict,
  check ((active and unmatched_at is null and unmatched_by is null and unmatch_reason is null)
    or (not active and unmatched_at is not null and unmatched_by is not null and nullif(btrim(unmatch_reason),'') is not null))
);
create table public.bank_match_lines (
  organization_id uuid not null,
  match_group_id uuid not null,
  statement_line_id uuid not null,
  primary key(match_group_id,statement_line_id),
  foreign key(match_group_id,organization_id) references public.bank_match_groups(id,organization_id) on delete restrict,
  foreign key(statement_line_id,organization_id) references public.bank_statement_lines(id,organization_id) on delete restrict
);
create table public.bank_match_transactions (
  organization_id uuid not null,
  match_group_id uuid not null,
  transaction_id uuid not null,
  bank_effect_minor bigint not null check(bank_effect_minor<>0),
  primary key(match_group_id,transaction_id),
  foreign key(match_group_id,organization_id) references public.bank_match_groups(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict
);

create table public.bank_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  statement_line_id uuid not null,
  transaction_id uuid not null,
  offset_account_id uuid not null,
  reason text not null check(nullif(btrim(reason),'') is not null),
  idempotency_key text not null check(nullif(btrim(idempotency_key),'') is not null),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(transaction_id), unique(statement_line_id),
  unique(organization_id,idempotency_key),
  foreign key(reconciliation_id,organization_id) references public.bank_reconciliations(id,organization_id) on delete restrict,
  foreign key(statement_line_id,organization_id) references public.bank_statement_lines(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(offset_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);

-- These are posted bank-account movements not yet present on the statement.
-- Their signed bank effect is explicit in the reconciliation equation.
create table public.bank_outstanding_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  reconciliation_id uuid not null,
  transaction_id uuid not null,
  bank_effect_minor bigint not null check(bank_effect_minor<>0),
  reason text not null check(nullif(btrim(reason),'') is not null),
  active boolean not null default true,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  removed_by uuid references public.profiles(id) on delete restrict,
  removed_at timestamptz,
  removal_reason text,
  unique(id,organization_id),
  foreign key(reconciliation_id,organization_id) references public.bank_reconciliations(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  check ((active and removed_at is null and removed_by is null and removal_reason is null)
    or (not active and removed_at is not null and removed_by is not null and nullif(btrim(removal_reason),'') is not null))
);
create unique index bank_outstanding_active_transaction on public.bank_outstanding_items(reconciliation_id,transaction_id) where active;

create table public.bank_reconciliation_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  reconciliation_id uuid not null,
  event_type text not null,
  statement_line_id uuid,
  match_group_id uuid,
  transaction_id uuid,
  reason text,
  before_data jsonb,
  after_data jsonb,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  occurred_at timestamptz not null default now(),
  foreign key(reconciliation_id,organization_id) references public.bank_reconciliations(id,organization_id) on delete restrict,
  foreign key(statement_line_id,organization_id) references public.bank_statement_lines(id,organization_id) on delete restrict,
  foreign key(match_group_id,organization_id) references public.bank_match_groups(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict
);
create index bank_reconciliation_events_history on public.bank_reconciliation_events(reconciliation_id,occurred_at,id);

insert into public.capabilities(key,domain,description) values
 ('bank.read','bank','Read bank reconciliation workspaces and history'),
 ('bank.import','bank','Import and correct bank statement lines'),
 ('bank.match','bank','Match, unmatch, and manage outstanding bank items'),
 ('bank.adjust','bank','Post explicit bank reconciliation adjustments'),
 ('bank.complete','bank','Complete an exactly balanced reconciliation'),
 ('bank.reopen','bank','Reopen a completed reconciliation with a recorded reason') on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role,c.key from (values('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c where c.domain='bank' and (c.key<>'bank.reopen' or r.role in ('owner','admin')) on conflict do nothing;
insert into public.role_capabilities(role,capability_key) values('viewer','bank.read') on conflict do nothing;

alter table public.bank_reconciliations enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_match_groups enable row level security;
alter table public.bank_match_lines enable row level security;
alter table public.bank_match_transactions enable row level security;
alter table public.bank_adjustments enable row level security;
alter table public.bank_outstanding_items enable row level security;
alter table public.bank_reconciliation_events enable row level security;
create policy bank_reconciliations_read on public.bank_reconciliations for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_statement_lines_read on public.bank_statement_lines for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_match_groups_read on public.bank_match_groups for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_match_lines_read on public.bank_match_lines for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_match_transactions_read on public.bank_match_transactions for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_adjustments_read on public.bank_adjustments for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_outstanding_items_read on public.bank_outstanding_items for select to authenticated using(app.has_capability(organization_id,'bank.read'));
create policy bank_reconciliation_events_read on public.bank_reconciliation_events for select to authenticated using(app.has_capability(organization_id,'bank.read'));
revoke all on public.bank_reconciliations,public.bank_statement_lines,public.bank_match_groups,
 public.bank_match_lines,public.bank_match_transactions,public.bank_adjustments,public.bank_outstanding_items,
 public.bank_reconciliation_events from public,anon,authenticated;
grant select on public.bank_reconciliations,public.bank_statement_lines,public.bank_match_groups,
 public.bank_match_lines,public.bank_match_transactions,public.bank_adjustments,public.bank_outstanding_items,
 public.bank_reconciliation_events to authenticated;

create function app.bank_line_identity(p_account uuid,p_date date,p_amount bigint,p_reference text,p_description text)
returns text language sql immutable set search_path='' as $$
 select encode(extensions.digest(concat_ws('|',p_account::text,p_date::text,p_amount::text,
   lower(regexp_replace(coalesce(btrim(p_reference),''),'\s+',' ','g')),
   lower(regexp_replace(coalesce(btrim(p_description),''),'\s+',' ','g'))),'sha256'),'hex');
$$;

create function app.bank_account_effect(p_organization_id uuid,p_bank_account_id uuid,p_transaction_id uuid)
returns bigint language sql stable security definer set search_path='' as $$
 select coalesce(sum(case when e.side='debit' then e.amount_minor else -e.amount_minor end),0)::bigint
 from public.transaction_entries e join public.transactions t on t.id=e.transaction_id and t.organization_id=e.organization_id
 where e.organization_id=p_organization_id and e.account_id=p_bank_account_id and e.transaction_id=p_transaction_id
   and e.posted_at is not null and t.status='posted';
$$;

create function app.bank_assert_editable(p_reconciliation_id uuid,p_organization_id uuid)
returns public.bank_reconciliations language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype;
begin
 select * into r from public.bank_reconciliations where id=p_reconciliation_id and organization_id=p_organization_id for update;
 if not found then raise exception 'BANK_RECONCILIATION_NOT_FOUND' using errcode='42501'; end if;
 if r.status='completed' then raise exception 'BANK_RECONCILIATION_COMPLETED' using errcode='55000'; end if;
 return r;
end; $$;

create function public.import_bank_statement(
 p_organization_id uuid,p_bank_account_id uuid,p_file_name text,p_file_sha256 text,
 p_statement_start date,p_statement_end date,p_opening_balance_minor bigint,p_closing_balance_minor bigint,
 p_currency_code text,p_rows jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype; a public.accounts%rowtype; x jsonb; n integer:=0;
 d date; amount bigint; validation text; identity text; duplicate_id uuid; errors jsonb:='[]'; valid_sum numeric:=0;
begin
 perform app.require_capability(p_organization_id,'bank.import');
 if p_statement_start is null or p_statement_end is null or not isfinite(p_statement_start) or not isfinite(p_statement_end)
   or p_statement_end<p_statement_start or p_opening_balance_minor is null or p_closing_balance_minor is null
   or nullif(btrim(p_file_name),'') is null or lower(p_file_sha256)!~'^[0-9a-f]{64}$'
   or jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)=0 then
   raise exception 'BANK_INVALID_IMPORT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('bank-import:'||p_organization_id::text||':'||p_bank_account_id::text,0));
 a:=app.require_account(p_organization_id,p_bank_account_id,array['asset']::public.account_type[]);
 if a.account_role<>'posting' or a.subtype<>'bank' or a.currency<>upper(p_currency_code) then
   raise exception 'BANK_ACCOUNT_CURRENCY_REQUIRED' using errcode='23514'; end if;
 if exists(select 1 from public.bank_reconciliations where organization_id=p_organization_id and file_sha256=lower(p_file_sha256)) then
   raise exception 'BANK_DUPLICATE_FILE' using errcode='23505'; end if;
 insert into public.bank_reconciliations(organization_id,bank_account_id,currency_code,statement_start,statement_end,
   opening_balance_minor,closing_balance_minor,file_name,file_sha256,created_by)
 values(p_organization_id,p_bank_account_id,a.currency,p_statement_start,p_statement_end,p_opening_balance_minor,
   p_closing_balance_minor,btrim(p_file_name),lower(p_file_sha256),auth.uid()) returning * into r;
 for x in select value from jsonb_array_elements(p_rows) loop
   n:=n+1; validation:=null; d:=null; amount:=null; duplicate_id:=null;
   begin d:=(x->>'date')::date; if not isfinite(d) or d<p_statement_start or d>p_statement_end then validation:='DATE_OUTSIDE_STATEMENT'; end if;
   exception when others then validation:='INVALID_DATE'; end;
   if coalesce(x->>'amount_minor','')~'^-?[0-9]+$' then
     begin amount:=(x->>'amount_minor')::bigint; exception when numeric_value_out_of_range then validation:=coalesce(validation,'INVALID_AMOUNT'); end;
   else validation:=coalesce(validation,'INVALID_AMOUNT'); end if;
   if amount=0 then validation:=coalesce(validation,'ZERO_AMOUNT'); end if;
   if nullif(btrim(coalesce(x->>'description','')),'') is null then validation:=coalesce(validation,'DESCRIPTION_REQUIRED'); end if;
   if validation is null then
     identity:=app.bank_line_identity(p_bank_account_id,d,amount,x->>'external_reference',x->>'description');
     select l.id into duplicate_id from public.bank_statement_lines l join public.bank_reconciliations b on b.id=l.reconciliation_id
       where l.organization_id=p_organization_id and b.bank_account_id=p_bank_account_id and l.line_identity=identity
         and l.validation_error is null order by l.created_at,l.id limit 1;
     if duplicate_id is not null then validation:='DUPLICATE_STATEMENT_LINE'; else valid_sum:=valid_sum+amount; end if;
   else identity:=encode(extensions.digest(r.id::text||':'||n::text,'sha256'),'hex'); end if;
   insert into public.bank_statement_lines(organization_id,reconciliation_id,source_row,transaction_date,amount_minor,
     description,external_reference,line_identity,status,validation_error,duplicate_of_line_id,raw_data)
   values(p_organization_id,r.id,n,d,amount,coalesce(x->>'description',''),nullif(btrim(x->>'external_reference'),''),identity,
     case when validation is null then 'unmatched'::public.bank_statement_line_status else 'unresolved' end,validation,duplicate_id,x);
 end loop;
 if p_opening_balance_minor+valid_sum<>p_closing_balance_minor then
   errors:=errors||jsonb_build_array(jsonb_build_object('code','STATEMENT_BALANCE_MISMATCH','expected_minor',(p_opening_balance_minor+valid_sum)::text,'closing_minor',p_closing_balance_minor::text)); end if;
 update public.bank_reconciliations set import_errors=errors where id=r.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,after_data,actor_id)
 values(p_organization_id,r.id,'statement.imported',jsonb_build_object('file_sha256',lower(p_file_sha256),'rows',n,'valid_total_minor',valid_sum::text,'errors',errors),auth.uid());
 perform app.write_audit(p_organization_id,'bank.statement_imported','bank_reconciliation',r.id,null,
   jsonb_build_object('bank_account_id',p_bank_account_id,'rows',n,'file_sha256',lower(p_file_sha256)));
 return r.id;
end; $$;

create function public.correct_bank_statement_line(p_organization_id uuid,p_statement_line_id uuid,p_transaction_date date,
 p_amount_minor bigint,p_description text,p_external_reference text,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare l public.bank_statement_lines%rowtype; r public.bank_reconciliations%rowtype; identity text; duplicate_id uuid; errors jsonb:='[]'; valid_sum numeric;
begin
 perform app.require_capability(p_organization_id,'bank.import');
 if p_transaction_date is null or not isfinite(p_transaction_date) or p_amount_minor is null or p_amount_minor=0
   or nullif(btrim(p_description),'') is null or nullif(btrim(p_reason),'') is null then
   raise exception 'BANK_INVALID_CORRECTION' using errcode='22023'; end if;
 select * into l from public.bank_statement_lines where id=p_statement_line_id and organization_id=p_organization_id;
 if not found then raise exception 'BANK_STATEMENT_LINE_NOT_FOUND' using errcode='42501'; end if;
 r:=app.bank_assert_editable(l.reconciliation_id,p_organization_id);
 select * into l from public.bank_statement_lines where id=p_statement_line_id and reconciliation_id=r.id and organization_id=p_organization_id for update;
 if l.status='matched' then raise exception 'BANK_MATCHED_LINE_NOT_CORRECTABLE' using errcode='55000'; end if;
 if p_transaction_date<r.statement_start or p_transaction_date>r.statement_end then raise exception 'BANK_DATE_OUTSIDE_STATEMENT' using errcode='22023'; end if;
 identity:=app.bank_line_identity(r.bank_account_id,p_transaction_date,p_amount_minor,p_external_reference,p_description);
 select other.id into duplicate_id from public.bank_statement_lines other join public.bank_reconciliations batch on batch.id=other.reconciliation_id
   where other.organization_id=p_organization_id and batch.bank_account_id=r.bank_account_id and other.line_identity=identity
     and other.id<>l.id and other.validation_error is null order by other.created_at,other.id limit 1;
 if duplicate_id is not null then raise exception 'BANK_DUPLICATE_STATEMENT_LINE' using errcode='23505'; end if;
 update public.bank_statement_lines set transaction_date=p_transaction_date,amount_minor=p_amount_minor,description=btrim(p_description),
   external_reference=nullif(btrim(p_external_reference),''),line_identity=identity,status='unmatched',validation_error=null,duplicate_of_line_id=null,
   raw_data=jsonb_build_object('date',p_transaction_date,'amount_minor',p_amount_minor::text,'description',btrim(p_description),'external_reference',nullif(btrim(p_external_reference),''))
   where id=l.id;
 select coalesce(sum(amount_minor),0) into valid_sum from public.bank_statement_lines where reconciliation_id=r.id and validation_error is null;
 if r.opening_balance_minor+valid_sum<>r.closing_balance_minor then errors:=jsonb_build_array(jsonb_build_object('code','STATEMENT_BALANCE_MISMATCH',
   'expected_minor',(r.opening_balance_minor+valid_sum)::text,'closing_minor',r.closing_balance_minor::text)); end if;
 update public.bank_reconciliations set import_errors=errors,updated_at=now() where id=r.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,statement_line_id,reason,before_data,after_data,actor_id)
 values(p_organization_id,r.id,'line.corrected',l.id,btrim(p_reason),to_jsonb(l)-'raw_data',
   jsonb_build_object('date',p_transaction_date,'amount_minor',p_amount_minor::text,'description',btrim(p_description),'external_reference',nullif(btrim(p_external_reference),'')),auth.uid());
 perform app.write_audit(p_organization_id,'bank.line_corrected','bank_statement_line',l.id,to_jsonb(l)-'raw_data',
   jsonb_build_object('date',p_transaction_date,'amount_minor',p_amount_minor::text,'reason',btrim(p_reason)));
end; $$;

create function public.match_bank_items(p_organization_id uuid,p_reconciliation_id uuid,p_statement_line_ids uuid[],p_transaction_ids uuid[],p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype; v_match_id uuid:=gen_random_uuid(); payload jsonb; existing public.bank_match_groups%rowtype;
 statement_total numeric; ledger_total numeric; line_count bigint; transaction_count bigint;
begin
 perform app.require_capability(p_organization_id,'bank.match'); r:=app.bank_assert_editable(p_reconciliation_id,p_organization_id);
 if coalesce(array_length(p_statement_line_ids,1),0)=0 or coalesce(array_length(p_transaction_ids,1),0)=0 or nullif(btrim(p_idempotency_key),'') is null
   or (select count(*) from unnest(p_statement_line_ids)x)<>(select count(distinct x) from unnest(p_statement_line_ids)x)
   or (select count(*) from unnest(p_transaction_ids)x)<>(select count(distinct x) from unnest(p_transaction_ids)x) then
   raise exception 'BANK_MATCH_SELECTION_REQUIRED' using errcode='22023'; end if;
 payload:=jsonb_build_object('reconciliation_id',r.id,'line_ids',(select jsonb_agg(x order by x) from unnest(p_statement_line_ids)x),
   'transaction_ids',(select jsonb_agg(x order by x) from unnest(p_transaction_ids)x));
 select * into existing from public.bank_match_groups where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then if existing.request_payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return existing.id; end if;
 perform pg_advisory_xact_lock(hashtextextended('bank-match:'||p_organization_id::text||':'||r.bank_account_id::text,0));
 select count(*),sum(l.amount_minor) into line_count,statement_total from public.bank_statement_lines l
   where l.organization_id=p_organization_id and l.reconciliation_id=r.id and l.id=any(p_statement_line_ids)
     and l.status='unmatched' and l.validation_error is null;
 select count(*),sum(app.bank_account_effect(p_organization_id,r.bank_account_id,t.id)) into transaction_count,ledger_total
   from public.transactions t where t.organization_id=p_organization_id and t.id=any(p_transaction_ids) and t.status='posted'
     and t.transaction_date<=r.statement_end
     and exists(select 1 from public.transaction_entries bank_entry where bank_entry.transaction_id=t.id
       and bank_entry.account_id=r.bank_account_id and bank_entry.currency_code=r.currency_code)
     and app.bank_account_effect(p_organization_id,r.bank_account_id,t.id)<>0;
 if line_count<>array_length(p_statement_line_ids,1) or transaction_count<>array_length(p_transaction_ids,1)
   or exists(select 1 from public.bank_match_transactions mt join public.bank_match_groups g on g.id=mt.match_group_id
     join public.bank_reconciliations matched_batch on matched_batch.id=g.reconciliation_id
     where g.active and g.organization_id=p_organization_id and matched_batch.bank_account_id=r.bank_account_id
       and mt.transaction_id=any(p_transaction_ids)) then
   raise exception 'BANK_ITEMS_NOT_MATCHABLE' using errcode='23514'; end if;
 if statement_total is distinct from ledger_total or statement_total=0 then
   raise exception 'BANK_MATCH_NOT_EXACT' using errcode='23514'; end if;
 insert into public.bank_match_groups(id,organization_id,reconciliation_id,idempotency_key,request_payload,statement_total_minor,ledger_total_minor,matched_by)
 values(v_match_id,p_organization_id,r.id,p_idempotency_key,payload,statement_total::bigint,ledger_total::bigint,auth.uid());
 insert into public.bank_match_lines select p_organization_id,v_match_id,x from unnest(p_statement_line_ids)x;
 insert into public.bank_match_transactions select p_organization_id,v_match_id,t.id,app.bank_account_effect(p_organization_id,r.bank_account_id,t.id)
   from public.transactions t where t.organization_id=p_organization_id and t.id=any(p_transaction_ids);
 update public.bank_statement_lines set status='matched' where id=any(p_statement_line_ids);
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,match_group_id,after_data,actor_id)
 values(p_organization_id,r.id,'match.created',v_match_id,payload||jsonb_build_object('total_minor',statement_total::text),auth.uid());
 perform app.write_audit(p_organization_id,'bank.match_created','bank_match_group',v_match_id,null,payload);
 return v_match_id;
end; $$;

create function public.unmatch_bank_items(p_organization_id uuid,p_match_group_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare g public.bank_match_groups%rowtype; r public.bank_reconciliations%rowtype;
begin
 perform app.require_capability(p_organization_id,'bank.match');
 if nullif(btrim(p_reason),'') is null then raise exception 'BANK_REASON_REQUIRED' using errcode='22023'; end if;
 select * into g from public.bank_match_groups where id=p_match_group_id and organization_id=p_organization_id for update;
 if not found or not g.active then raise exception 'BANK_ACTIVE_MATCH_NOT_FOUND' using errcode='42501'; end if;
 r:=app.bank_assert_editable(g.reconciliation_id,p_organization_id);
 update public.bank_match_groups set active=false,unmatched_by=auth.uid(),unmatched_at=now(),unmatch_reason=btrim(p_reason) where id=g.id;
 update public.bank_statement_lines l set status='unmatched' from public.bank_match_lines ml where ml.match_group_id=g.id and ml.statement_line_id=l.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,match_group_id,reason,before_data,actor_id)
 values(p_organization_id,r.id,'match.removed',g.id,btrim(p_reason),g.request_payload,auth.uid());
 perform app.write_audit(p_organization_id,'bank.match_removed','bank_match_group',g.id,jsonb_build_object('active',true),jsonb_build_object('active',false,'reason',btrim(p_reason)));
end; $$;

create function public.create_bank_adjustment(p_organization_id uuid,p_reconciliation_id uuid,p_statement_line_id uuid,
 p_offset_account_id uuid,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype; l public.bank_statement_lines%rowtype; offset_account public.accounts%rowtype;
 existing public.bank_adjustments%rowtype; payload jsonb; transaction_id uuid; match_id uuid; lines jsonb;
begin
 perform app.require_capability(p_organization_id,'bank.adjust'); perform app.require_capability(p_organization_id,'transactions.adjust');
 perform app.require_capability(p_organization_id,'transactions.create'); perform app.require_capability(p_organization_id,'transactions.post');
 r:=app.bank_assert_editable(p_reconciliation_id,p_organization_id);
 if nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'BANK_REASON_REQUIRED' using errcode='22023'; end if;
 payload:=jsonb_build_object('reconciliation_id',r.id,'line_id',p_statement_line_id,'offset_account_id',p_offset_account_id,'reason',btrim(p_reason));
 select * into existing from public.bank_adjustments where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then if existing.request_payload<>payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return existing.transaction_id; end if;
 select * into l from public.bank_statement_lines where id=p_statement_line_id and reconciliation_id=r.id and organization_id=p_organization_id for update;
 if not found or l.status<>'unmatched' or l.validation_error is not null then raise exception 'BANK_LINE_NOT_ADJUSTABLE' using errcode='23514'; end if;
 if exists(select 1 from public.organization_settings where organization_id=p_organization_id and require_adjustment_approval) then
   raise exception 'BANK_ADJUSTMENT_APPROVAL_REQUIRED' using errcode='42501'; end if;
 offset_account:=app.require_account(p_organization_id,p_offset_account_id);
 if offset_account.account_role<>'posting' or offset_account.currency<>r.currency_code or p_offset_account_id=r.bank_account_id then
   raise exception 'BANK_OFFSET_ACCOUNT_REQUIRED' using errcode='23514'; end if;
 lines:=jsonb_build_array(
   jsonb_build_object('account_id',r.bank_account_id,'side',case when l.amount_minor>0 then 'debit' else 'credit' end,'amount_minor',abs(l.amount_minor)),
   jsonb_build_object('account_id',p_offset_account_id,'side',case when l.amount_minor>0 then 'credit' else 'debit' end,'amount_minor',abs(l.amount_minor)));
 transaction_id:=app.create_and_post(p_organization_id,'adjustment',l.transaction_date,lines,p_currency_code=>r.currency_code,
   p_description=>l.description,p_reference=>coalesce(l.external_reference,'BANK-ADJUSTMENT'),p_adjustment_reason=>btrim(p_reason),
   p_source=>'api',p_idempotency_key=>'bank-adjustment:'||p_idempotency_key,
   p_metadata=>jsonb_build_object('bank_reconciliation_id',r.id,'bank_statement_line_id',l.id));
 insert into public.bank_adjustments(organization_id,reconciliation_id,statement_line_id,transaction_id,offset_account_id,reason,idempotency_key,request_payload,created_by)
 values(p_organization_id,r.id,l.id,transaction_id,p_offset_account_id,btrim(p_reason),p_idempotency_key,payload,auth.uid());
 match_id:=public.match_bank_items(p_organization_id,r.id,array[l.id],array[transaction_id],'bank-adjustment-match:'||p_idempotency_key);
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,statement_line_id,match_group_id,transaction_id,reason,after_data,actor_id)
 values(p_organization_id,r.id,'adjustment.posted',l.id,match_id,transaction_id,btrim(p_reason),payload,auth.uid());
 return transaction_id;
end; $$;

create function public.add_bank_outstanding_item(p_organization_id uuid,p_reconciliation_id uuid,p_transaction_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype; effect bigint; id uuid;
begin
 perform app.require_capability(p_organization_id,'bank.match'); r:=app.bank_assert_editable(p_reconciliation_id,p_organization_id);
 if nullif(btrim(p_reason),'') is null then raise exception 'BANK_REASON_REQUIRED' using errcode='22023'; end if;
 effect:=app.bank_account_effect(p_organization_id,r.bank_account_id,p_transaction_id);
 if effect=0 or exists(select 1 from public.bank_match_transactions mt join public.bank_match_groups g on g.id=mt.match_group_id
   join public.bank_reconciliations matched_batch on matched_batch.id=g.reconciliation_id
   where g.active and matched_batch.bank_account_id=r.bank_account_id and mt.transaction_id=p_transaction_id) then
   raise exception 'BANK_TRANSACTION_NOT_OUTSTANDING' using errcode='23514'; end if;
 insert into public.bank_outstanding_items(organization_id,reconciliation_id,transaction_id,bank_effect_minor,reason,created_by)
 values(p_organization_id,r.id,p_transaction_id,effect,btrim(p_reason),auth.uid()) returning bank_outstanding_items.id into id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,transaction_id,reason,after_data,actor_id)
 values(p_organization_id,r.id,'outstanding.added',p_transaction_id,btrim(p_reason),jsonb_build_object('id',id,'effect_minor',effect::text),auth.uid());
 return id;
end; $$;

create function public.remove_bank_outstanding_item(p_organization_id uuid,p_outstanding_item_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare item public.bank_outstanding_items%rowtype; r public.bank_reconciliations%rowtype;
begin
 perform app.require_capability(p_organization_id,'bank.match'); if nullif(btrim(p_reason),'') is null then raise exception 'BANK_REASON_REQUIRED' using errcode='22023'; end if;
 select * into item from public.bank_outstanding_items where id=p_outstanding_item_id and organization_id=p_organization_id and active for update;
 if not found then raise exception 'BANK_OUTSTANDING_NOT_FOUND' using errcode='42501'; end if;
 r:=app.bank_assert_editable(item.reconciliation_id,p_organization_id);
 update public.bank_outstanding_items set active=false,removed_by=auth.uid(),removed_at=now(),removal_reason=btrim(p_reason) where id=item.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,transaction_id,reason,before_data,actor_id)
 values(p_organization_id,r.id,'outstanding.removed',item.transaction_id,btrim(p_reason),jsonb_build_object('id',item.id,'effect_minor',item.bank_effect_minor::text),auth.uid());
end; $$;

create function public.complete_bank_reconciliation(p_organization_id uuid,p_reconciliation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype; ledger numeric; outstanding numeric;
begin
 perform app.require_capability(p_organization_id,'bank.complete'); r:=app.bank_assert_editable(p_reconciliation_id,p_organization_id);
 if jsonb_array_length(r.import_errors)>0 or exists(select 1 from public.bank_statement_lines where reconciliation_id=r.id and status<>'matched') then
   raise exception 'BANK_RECONCILIATION_INCOMPLETE' using errcode='23514'; end if;
 select coalesce(sum(case when e.side='debit' then e.amount_minor else -e.amount_minor end),0) into ledger
 from public.transaction_entries e where e.organization_id=p_organization_id and e.account_id=r.bank_account_id and e.entry_date<=r.statement_end and e.posted_at is not null;
 select coalesce(sum(bank_effect_minor),0) into outstanding from public.bank_outstanding_items where reconciliation_id=r.id and active;
 if r.closing_balance_minor+outstanding<>ledger then raise exception 'BANK_RECONCILIATION_NOT_BALANCED' using errcode='23514'; end if;
 update public.bank_reconciliations set status='completed',completed_ledger_balance_minor=ledger::bigint,
   completed_outstanding_minor=outstanding::bigint,completed_at=now(),completed_by=auth.uid(),updated_at=now() where id=r.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,after_data,actor_id)
 values(p_organization_id,r.id,'reconciliation.completed',jsonb_build_object('statement_minor',r.closing_balance_minor::text,
   'outstanding_minor',outstanding::text,'ledger_minor',ledger::text),auth.uid());
 perform app.write_audit(p_organization_id,'bank.reconciliation_completed','bank_reconciliation',r.id,null,
   jsonb_build_object('statement_minor',r.closing_balance_minor::text,'outstanding_minor',outstanding::text,'ledger_minor',ledger::text));
end; $$;

create function public.reopen_bank_reconciliation(p_organization_id uuid,p_reconciliation_id uuid,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare r public.bank_reconciliations%rowtype;
begin
 perform app.require_capability(p_organization_id,'bank.reopen');
 if nullif(btrim(p_reason),'') is null then raise exception 'BANK_REASON_REQUIRED' using errcode='22023'; end if;
 select * into r from public.bank_reconciliations where id=p_reconciliation_id and organization_id=p_organization_id for update;
 if not found or r.status<>'completed' then raise exception 'BANK_COMPLETED_RECONCILIATION_NOT_FOUND' using errcode='42501'; end if;
 update public.bank_reconciliations set status='reopened',completed_at=null,completed_by=null,updated_at=now() where id=r.id;
 insert into public.bank_reconciliation_events(organization_id,reconciliation_id,event_type,reason,before_data,after_data,actor_id)
 values(p_organization_id,r.id,'reconciliation.reopened',btrim(p_reason),jsonb_build_object('ledger_minor',r.completed_ledger_balance_minor::text,
   'outstanding_minor',r.completed_outstanding_minor::text,'completed_at',r.completed_at),jsonb_build_object('status','reopened'),auth.uid());
 perform app.write_audit(p_organization_id,'bank.reconciliation_reopened','bank_reconciliation',r.id,
   jsonb_build_object('status','completed'),jsonb_build_object('status','reopened','reason',btrim(p_reason)));
end; $$;

create function public.read_bank_reconciliation_workspace(p_organization_id uuid,p_reconciliation_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare selected_id uuid; r public.bank_reconciliations%rowtype; ledger numeric:=0; outstanding numeric:=0;
begin
 perform app.require_capability(p_organization_id,'bank.read');
 selected_id:=p_reconciliation_id;
 if selected_id is null then select id into selected_id from public.bank_reconciliations where organization_id=p_organization_id order by created_at desc limit 1; end if;
 if selected_id is not null then select * into r from public.bank_reconciliations where id=selected_id and organization_id=p_organization_id;
   if not found then raise exception 'BANK_RECONCILIATION_NOT_FOUND' using errcode='42501'; end if;
   select coalesce(sum(case when side='debit' then amount_minor else -amount_minor end),0) into ledger from public.transaction_entries
     where organization_id=p_organization_id and account_id=r.bank_account_id and entry_date<=r.statement_end and posted_at is not null;
   select coalesce(sum(bank_effect_minor),0) into outstanding from public.bank_outstanding_items where reconciliation_id=r.id and active;
 end if;
 return jsonb_build_object(
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'type',type,'subtype',subtype,'currency',currency,'role',account_role) order by name)
    from public.accounts where organization_id=p_organization_id and not is_archived and account_role='posting'),'[]'::jsonb),
  'reconciliations',coalesce((select jsonb_agg(jsonb_build_object('id',id,'bank_account_id',bank_account_id,'currency_code',currency_code,
    'statement_start',statement_start,'statement_end',statement_end,'opening_balance_minor',opening_balance_minor::text,'closing_balance_minor',closing_balance_minor::text,
    'file_name',file_name,'status',status,'import_errors',import_errors,'completed_at',completed_at) order by created_at desc)
    from public.bank_reconciliations where organization_id=p_organization_id),'[]'::jsonb),
  'selected_id',selected_id,
  'lines',coalesce((select jsonb_agg(jsonb_build_object('id',id,'source_row',source_row,'date',transaction_date,'amount_minor',amount_minor::text,
    'description',description,'external_reference',external_reference,'status',status,'validation_error',validation_error,'duplicate_of_line_id',duplicate_of_line_id) order by source_row)
    from public.bank_statement_lines where reconciliation_id=selected_id),'[]'::jsonb),
  'candidates',case when selected_id is null then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'date',t.transaction_date,
    'description',t.description,'reference',t.reference,'effect_minor',app.bank_account_effect(p_organization_id,r.bank_account_id,t.id)::text,'type',t.type) order by t.transaction_date,t.id)
    from public.transactions t where t.organization_id=p_organization_id and t.status='posted'
      and t.transaction_date<=r.statement_end and app.bank_account_effect(p_organization_id,r.bank_account_id,t.id)<>0
      and exists(select 1 from public.transaction_entries bank_entry where bank_entry.transaction_id=t.id
        and bank_entry.account_id=r.bank_account_id and bank_entry.currency_code=r.currency_code)
      and not exists(select 1 from public.bank_match_transactions mt join public.bank_match_groups g on g.id=mt.match_group_id
        join public.bank_reconciliations matched_batch on matched_batch.id=g.reconciliation_id
        where g.active and matched_batch.bank_account_id=r.bank_account_id and mt.transaction_id=t.id)
      and not exists(select 1 from public.bank_outstanding_items o where o.active and o.reconciliation_id=r.id and o.transaction_id=t.id)),'[]'::jsonb) end,
  'matches',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'active',g.active,'statement_total_minor',g.statement_total_minor::text,
    'ledger_total_minor',g.ledger_total_minor::text,'matched_at',g.matched_at,'unmatched_at',g.unmatched_at,'unmatch_reason',g.unmatch_reason,
    'line_ids',(select jsonb_agg(statement_line_id) from public.bank_match_lines where match_group_id=g.id),
    'transaction_ids',(select jsonb_agg(transaction_id) from public.bank_match_transactions where match_group_id=g.id)) order by g.matched_at desc)
    from public.bank_match_groups g where g.reconciliation_id=selected_id),'[]'::jsonb),
  'outstanding',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'transaction_id',o.transaction_id,'bank_effect_minor',o.bank_effect_minor::text,
    'reason',o.reason,'active',o.active,'created_at',o.created_at,'removal_reason',o.removal_reason) order by o.created_at)
    from public.bank_outstanding_items o where o.reconciliation_id=selected_id),'[]'::jsonb),
  'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'event_type',event_type,'statement_line_id',statement_line_id,'match_group_id',match_group_id,
    'transaction_id',transaction_id,'reason',reason,'before_data',before_data,'after_data',after_data,'occurred_at',occurred_at) order by occurred_at desc,id desc)
    from public.bank_reconciliation_events where reconciliation_id=selected_id),'[]'::jsonb),
  'equation',case when selected_id is null then null else jsonb_build_object('statement_minor',r.closing_balance_minor::text,
    'outstanding_minor',outstanding::text,'ledger_minor',ledger::text,'difference_minor',(r.closing_balance_minor+outstanding-ledger)::text) end);
end; $$;

revoke all on function app.bank_line_identity(uuid,date,bigint,text,text),app.bank_account_effect(uuid,uuid,uuid),
 app.bank_assert_editable(uuid,uuid) from public,anon,authenticated;
revoke all on function public.import_bank_statement(uuid,uuid,text,text,date,date,bigint,bigint,text,jsonb),
 public.correct_bank_statement_line(uuid,uuid,date,bigint,text,text,text),
 public.match_bank_items(uuid,uuid,uuid[],uuid[],text),public.unmatch_bank_items(uuid,uuid,text),
 public.create_bank_adjustment(uuid,uuid,uuid,uuid,text,text),public.add_bank_outstanding_item(uuid,uuid,uuid,text),
 public.remove_bank_outstanding_item(uuid,uuid,text),public.complete_bank_reconciliation(uuid,uuid),
 public.reopen_bank_reconciliation(uuid,uuid,text),public.read_bank_reconciliation_workspace(uuid,uuid) from public,anon;
grant execute on function public.import_bank_statement(uuid,uuid,text,text,date,date,bigint,bigint,text,jsonb),
 public.correct_bank_statement_line(uuid,uuid,date,bigint,text,text,text),
 public.match_bank_items(uuid,uuid,uuid[],uuid[],text),public.unmatch_bank_items(uuid,uuid,text),
 public.create_bank_adjustment(uuid,uuid,uuid,uuid,text,text),public.add_bank_outstanding_item(uuid,uuid,uuid,text),
 public.remove_bank_outstanding_item(uuid,uuid,text),public.complete_bank_reconciliation(uuid,uuid),
 public.reopen_bank_reconciliation(uuid,uuid,text),public.read_bank_reconciliation_workspace(uuid,uuid) to authenticated;

-- Evidence tables are append-only to ordinary callers. Lifecycle changes are
-- only available through the authorized functions above; event history itself
-- is immutable even to table owners during ordinary application operation.
create trigger bank_reconciliation_events_immutable before update or delete on public.bank_reconciliation_events
 for each row execute function app.reject_control_evidence_change();
create trigger bank_adjustments_immutable before update or delete on public.bank_adjustments
 for each row execute function app.reject_control_evidence_change();
create trigger bank_match_lines_immutable before update or delete on public.bank_match_lines
 for each row execute function app.reject_control_evidence_change();
create trigger bank_match_transactions_immutable before update or delete on public.bank_match_transactions
 for each row execute function app.reject_control_evidence_change();
