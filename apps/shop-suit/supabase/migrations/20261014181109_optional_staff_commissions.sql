-- SS-BARBER-COMP-001. No backfill, payout, stock writes or historical repricing.
alter table public.invoice_items add constraint commission_line_tenant_key unique(id,shop_id), add constraint commission_line_invoice_key unique(id,shop_id,invoice_id);
create table public.commission_policy_versions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id) on delete restrict,
 request_id uuid not null, policy jsonb not null, reason text not null check(length(btrim(reason)) between 2 and 1000),
 actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(), unique(shop_id,request_id),unique(id,shop_id)
);
create index commission_policy_latest on public.commission_policy_versions(shop_id,created_at desc,id desc);
create table public.commission_line_assignments (
 line_id uuid primary key references public.invoice_items(id) on delete cascade,
 shop_id uuid not null references public.shops(id) on delete restrict,
 membership_id uuid not null, appointment_id uuid references public.appointments(id) on delete restrict,
 actor_profile_id uuid not null references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),
 foreign key(membership_id,shop_id) references public.shop_memberships(id,shop_id) on delete restrict,
 foreign key(line_id,shop_id) references public.invoice_items(id,shop_id) on delete cascade,
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id) on delete restrict,
 unique(appointment_id)
);
create table public.commission_snapshots (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id) on delete restrict,
 invoice_id uuid not null, line_id uuid not null unique references public.invoice_items(id) on delete restrict,
 membership_id uuid not null, employee_profile_id uuid not null references public.profiles(id) on delete restrict,
 employee_name text, appointment_id uuid references public.appointments(id) on delete restrict,
 item_type text not null check(item_type in('service','product')),
 policy_version_id uuid not null references public.commission_policy_versions(id) on delete restrict,
 policy_version text not null default 'SS-BARBER-COMP-001/v1',
 rate_type text not null check(rate_type in('percentage','fixed')),
 rate numeric(14,4) not null check(rate>=0), currency text not null,
 quantity numeric(12,3) not null check(quantity>0), net_line_amount numeric(12,2) not null check(net_line_amount>=0),
 original_commission numeric(14,2) not null check(original_commission>=0),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(invoice_id,shop_id) references public.invoices(id,shop_id) on delete restrict,
 foreign key(line_id,shop_id,invoice_id) references public.invoice_items(id,shop_id,invoice_id) on delete restrict,
 foreign key(policy_version_id,shop_id) references public.commission_policy_versions(id,shop_id) on delete restrict,
 foreign key(appointment_id,shop_id) references public.appointments(id,shop_id) on delete restrict,
 foreign key(membership_id,shop_id) references public.shop_memberships(id,shop_id) on delete restrict
);
create index commission_snapshot_invoice on public.commission_snapshots(invoice_id);
create index commission_snapshot_appointment on public.commission_snapshots(appointment_id) where appointment_id is not null;
create table public.commission_events (
 id uuid primary key default gen_random_uuid(), snapshot_id uuid not null references public.commission_snapshots(id) on delete restrict,
 kind text not null check(kind in('earned','return','correction','exported')),
 event_key text not null, amount numeric(14,2) not null,
 cumulative_fraction numeric not null default 0 check(cumulative_fraction between 0 and 1),
 reason text not null check(length(btrim(reason)) between 2 and 1000),
 actor_profile_id uuid references public.profiles(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(), unique(snapshot_id,event_key),
 check((kind='earned' and amount>=0) or (kind='return' and amount<=0) or kind='correction' or (kind='exported' and amount=0))
);
create unique index commission_one_earning on public.commission_events(snapshot_id) where kind='earned';
create unique index commission_one_export on public.commission_events(snapshot_id) where kind='exported';
create function shop_private.commission_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'COMMISSION_HISTORY_IMMUTABLE' using errcode='55000'; end; $$;
revoke all on function shop_private.commission_immutable() from public,anon,authenticated,service_role;
create trigger commission_policy_immutable before update or delete on public.commission_policy_versions for each row execute function shop_private.commission_immutable();
create trigger commission_snapshot_immutable before update or delete on public.commission_snapshots for each row execute function shop_private.commission_immutable();
create trigger commission_event_immutable before update or delete on public.commission_events for each row execute function shop_private.commission_immutable();
alter table public.commission_policy_versions enable row level security;
alter table public.commission_line_assignments enable row level security;
alter table public.commission_snapshots enable row level security;
alter table public.commission_events enable row level security;
revoke all on public.commission_policy_versions,public.commission_line_assignments,public.commission_snapshots,public.commission_events from public,anon,authenticated;
grant all on public.commission_policy_versions,public.commission_line_assignments,public.commission_snapshots,public.commission_events to service_role;

create function shop_private.commission_manager(p_shop_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'team.manage');
 if not exists(select 1 from public.shop_memberships m where m.shop_id=p_shop_id and m.profile_id=actor and m.status='active'
  and (m.role='owner' or exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
   where mr.membership_id=m.id and r.shop_id=p_shop_id and r.key='manager' and r.is_system))) then
  raise exception 'COMMISSION_MANAGER_REQUIRED' using errcode='42501'; end if;
 return actor;
end; $$;
revoke all on function shop_private.commission_manager(uuid) from public,anon,authenticated,service_role;

-- Whole-policy replacement is versioned atomically. Employees default disabled.
create function public.save_commission_policy(p_request_id uuid,p_shop_id uuid,p_policy jsonb,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid; previous public.commission_policy_versions%rowtype; employee jsonb; rate jsonb; result uuid;
begin
 actor:=shop_private.commission_manager(p_shop_id);
 perform 1 from public.shops where id=p_shop_id for update;
 if p_request_id is null or p_policy is null or jsonb_typeof(p_policy)<>'object'
  or jsonb_typeof(p_policy->'enabled') is distinct from 'boolean' or length(btrim(coalesce(p_reason,''))) not between 2 and 1000
  or coalesce(p_policy->>'currency','') !~ '^[A-Z]{3}$'
  or jsonb_typeof(p_policy->'employees') is distinct from 'array' then
  raise exception 'INVALID_COMMISSION_POLICY' using errcode='22023'; end if;
 select * into previous from public.commission_policy_versions where shop_id=p_shop_id and request_id=p_request_id;
 if found then
  if previous.policy<>p_policy or previous.reason<>btrim(p_reason) or previous.actor_profile_id<>actor then
   raise exception 'COMMISSION_REQUEST_CONFLICT' using errcode='23505'; end if;
  return previous.id;
 end if;
 if exists(select 1 from jsonb_array_elements(p_policy->'employees') e group by e->>'membershipId' having count(*)>1) then
  raise exception 'DUPLICATE_COMMISSION_EMPLOYEE' using errcode='22023'; end if;
 for employee in select value from jsonb_array_elements(p_policy->'employees') loop
  if jsonb_typeof(employee->'enabled') is distinct from 'boolean' or not exists(
   select 1 from public.shop_memberships where id=(employee->>'membershipId')::uuid and shop_id=p_shop_id and status='active') then
   raise exception 'INVALID_COMMISSION_EMPLOYEE' using errcode='23503'; end if;
 end loop;
 for rate in select value from jsonb_array_elements(jsonb_build_array(p_policy->'service',p_policy->'product'))
  union all select e->'service' from jsonb_array_elements(p_policy->'employees') e
  union all select e->'product' from jsonb_array_elements(p_policy->'employees') e loop
  if rate is null or rate='null'::jsonb then continue; end if;
  if jsonb_typeof(rate)<>'object' or coalesce(rate->>'type','') not in('percentage','fixed')
   or jsonb_typeof(rate->'rate') is distinct from 'number' then raise exception 'INVALID_COMMISSION_RATE' using errcode='22023'; end if;
  if (rate->>'rate')::numeric<0 or (rate->>'rate')::numeric>999999.9999 or round((rate->>'rate')::numeric,4)<>(rate->>'rate')::numeric
   or (rate->>'type'='percentage' and (rate->>'rate')::numeric>100) then raise exception 'INVALID_COMMISSION_RATE' using errcode='22023'; end if;
 end loop;
 insert into public.commission_policy_versions(shop_id,request_id,policy,reason,actor_profile_id)
 values(p_shop_id,p_request_id,p_policy,btrim(p_reason),actor) returning id into result;
 return result;
end; $$;
revoke all on function public.save_commission_policy(uuid,uuid,jsonb,text) from public,anon;
grant execute on function public.save_commission_policy(uuid,uuid,jsonb,text) to authenticated;

-- Optional draft attribution. Does not derive a service completion from payment.
create function public.assign_sale_commission(p_shop_id uuid,p_line_id uuid,p_membership_id uuid,p_appointment_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; line public.invoice_items%rowtype; sale public.invoices%rowtype;
begin
 actor:=shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 select * into line from public.invoice_items where id=p_line_id and shop_id=p_shop_id;
 if not found then raise exception 'COMMISSION_LINE_NOT_FOUND' using errcode='P0002'; end if;
 select * into sale from public.invoices where id=line.invoice_id and shop_id=p_shop_id for update;
 if not found then raise exception 'COMMISSION_LINE_NOT_FOUND' using errcode='P0002'; end if;
 perform shop_private.assert_location_access(p_shop_id,sale.location_id,true);
 if sale.status<>'draft' then raise exception 'COMMISSION_ASSIGNMENT_FINALIZED' using errcode='55000'; end if;
 if p_membership_id is null then delete from public.commission_line_assignments where line_id=p_line_id; return; end if;
 if not exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id
  where m.id=p_membership_id and m.shop_id=p_shop_id and m.status='active' and p.status='active'
   and (m.role='owner' or exists(select 1 from public.membership_location_assignments a where a.membership_id=m.id and a.location_id=sale.location_id))) then
  raise exception 'INVALID_COMMISSION_EMPLOYEE' using errcode='23503'; end if;
 if line.item_type='service' then
  if line.quantity<>1 or not exists(select 1 from public.appointments a where a.id=p_appointment_id and a.shop_id=p_shop_id
   and a.sale_id=sale.id and a.location_id=sale.location_id and a.assigned_membership_id=p_membership_id
   and a.service_id=line.service_id and a.status not in('cancelled','no_show')) then
   raise exception 'COMMISSION_FULFILLMENT_REQUIRED' using errcode='23514'; end if;
 elsif line.item_type<>'product' or p_appointment_id is not null then
  raise exception 'INVALID_COMMISSION_LINE' using errcode='22023'; end if;
 insert into public.commission_line_assignments(line_id,shop_id,membership_id,appointment_id,actor_profile_id)
 values(p_line_id,p_shop_id,p_membership_id,p_appointment_id,actor)
 on conflict(line_id) do update set membership_id=excluded.membership_id,appointment_id=excluded.appointment_id,
 actor_profile_id=excluded.actor_profile_id,created_at=clock_timestamp();
end; $$;
revoke all on function public.assign_sale_commission(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.assign_sale_commission(uuid,uuid,uuid,uuid) to authenticated;

-- Internal hook for future returns: cumulative, monotonic, serialized, append-only.
-- Financial amount is net of tax/fees. Item quantity and money for the same return
-- use max(fractions), so integration must send cumulative values for this line.
create function shop_private.adjust_commission_return(p_snapshot_id uuid,p_event_key text,p_net_returned numeric,p_quantity_returned numeric,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare s public.commission_snapshots%rowtype; fraction numeric; prior numeric; delta numeric; payable numeric; invoice_refunds numeric;
 correction public.sale_corrections%rowtype;
begin
 select * into s from public.commission_snapshots where id=p_snapshot_id;
 if not found then raise exception 'COMMISSION_SNAPSHOT_NOT_FOUND'; end if;
 perform 1 from public.invoices where id=s.invoice_id for update;
 if p_event_key is null or p_net_returned is null or p_quantity_returned is null or p_net_returned<0 or p_net_returned>s.net_line_amount
  or p_quantity_returned<0 or p_quantity_returned>s.quantity or length(btrim(coalesce(p_reason,''))) not between 2 and 1000 then
  raise exception 'INVALID_COMMISSION_RETURN' using errcode='22023'; end if;
 select i.total_amount into payable from public.invoices i where i.id=s.invoice_id;
 select * into correction from public.sale_corrections c where c.invoice_id=s.invoice_id;
 select coalesce(sum(a.amount),0) into invoice_refunds from public.customer_payment_adjustments a
 join public.customer_payment_allocations alloc on alloc.id=a.original_allocation_id where alloc.invoice_id=s.invoice_id;
 -- A full sale correction closes the sale, even when it refunds no money or
 -- only the paid portion. It always reverses the entire original earning.
 fraction:=greatest(case when correction.id is not null then 1 else 0 end,
 case when s.net_line_amount>0 then p_net_returned/s.net_line_amount else 0 end,
 p_quantity_returned/s.quantity,case when payable>0 then least(1,invoice_refunds/payable) else 0 end);
 if not exists(select 1 from public.commission_events where snapshot_id=s.id and kind='earned') then return; end if;
 select coalesce(max(cumulative_fraction),0),coalesce(-sum(amount),0) into prior,delta
 from public.commission_events where snapshot_id=s.id and kind='return';
 if fraction<prior then raise exception 'COMMISSION_RETURN_NOT_CUMULATIVE' using errcode='22023'; end if;
 delta:=case when fraction=1 then s.original_commission else round(s.original_commission*fraction,2) end-delta;
 if fraction=prior then return; end if;
 insert into public.commission_events(snapshot_id,kind,event_key,amount,cumulative_fraction,reason,actor_profile_id)
 values(s.id,'return','return:'||p_event_key,-delta,fraction,btrim(p_reason),correction.created_by_profile_id);
end; $$;
revoke all on function shop_private.adjust_commission_return(uuid,text,numeric,numeric,text) from public,anon,authenticated,service_role;

create function shop_private.reconcile_commission(p_invoice_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.commission_snapshots%rowtype; paid boolean; refunded numeric; payable numeric;
 correction public.sale_corrections%rowtype;
begin
 perform 1 from public.invoices where id=p_invoice_id for update;
 select * into correction from public.sale_corrections c where c.invoice_id=p_invoice_id;
 -- invoice_outstanding also returns zero for a void/return. Closure is not
 -- proof of payment, and a corrected sale can never create a new earning.
 select correction.id is null and shop_private.invoice_outstanding(p_invoice_id)=0,total_amount
 into paid,payable from public.invoices where id=p_invoice_id and status='issued';
 for s in select * from public.commission_snapshots where invoice_id=p_invoice_id order by id loop
  if paid and (s.item_type='product' or exists(select 1 from public.appointments a where a.id=s.appointment_id
   and a.shop_id=s.shop_id and a.sale_id=s.invoice_id and a.assigned_membership_id=s.membership_id and a.status='completed')) then
   insert into public.commission_events(snapshot_id,kind,event_key,amount,reason)
   values(s.id,'earned','earned',s.original_commission,'Fully paid and fulfilled') on conflict do nothing;
  end if;
  select coalesce(sum(a.amount),0) into refunded from public.customer_payment_adjustments a
   join public.customer_payment_allocations alloc on alloc.id=a.original_allocation_id where alloc.invoice_id=p_invoice_id;
  if correction.id is not null then
   perform shop_private.adjust_commission_return(s.id,'sale-correction:'||correction.id::text,
    s.net_line_amount,s.quantity,correction.reason);
  elsif refunded>0 then
   -- The helper also considers payment adjustments; zero inputs here preserve
   -- the common cumulative money/quantity contract without changing refunds.
   perform shop_private.adjust_commission_return(s.id,'financial:'||refunded::text,0,0,'Customer payment refund or reversal');
  end if;
 end loop;
end; $$;
revoke all on function shop_private.reconcile_commission(uuid) from public,anon,authenticated,service_role;

create function shop_private.capture_commission() returns trigger language plpgsql security definer set search_path='' as $$
declare policy public.commission_policy_versions%rowtype; line record; employee jsonb; rate jsonb;
begin
 if old.status<>'draft' or new.status<>'issued' then return new; end if;
 select * into policy from public.commission_policy_versions where shop_id=new.shop_id order by created_at desc,id desc limit 1;
 if not found or not (policy.policy->>'enabled')::boolean or policy.policy->>'currency'<>new.currency then return new; end if;
 for line in select i.*,a.membership_id,a.appointment_id,m.profile_id,coalesce(m.team_full_name,p.display_name,p.email_snapshot) employee_name
  from public.invoice_items i join public.commission_line_assignments a on a.line_id=i.id and a.shop_id=i.shop_id
  join public.shop_memberships m on m.id=a.membership_id and m.shop_id=i.shop_id
  join public.profiles p on p.id=m.profile_id where i.invoice_id=new.id and m.status='active' and p.status='active' order by i.id loop
  select value into employee from jsonb_array_elements(policy.policy->'employees') where value->>'membershipId'=line.membership_id::text;
  if employee is null or not (employee->>'enabled')::boolean then continue; end if;
  rate:=coalesce(nullif(employee->line.item_type::text,'null'::jsonb),nullif(policy.policy->line.item_type::text,'null'::jsonb));
  if rate is null then continue; end if;
  -- Recheck the live fulfillment identity at finalization. Stale attribution
  -- yields no earning and must never fail ordinary checkout.
  if line.item_type='service' and not exists(select 1 from public.appointments a where a.id=line.appointment_id
   and a.shop_id=new.shop_id and a.sale_id=new.id and a.service_id=line.service_id and a.location_id=new.location_id
   and a.assigned_membership_id=line.membership_id and a.status not in('cancelled','no_show') and line.quantity=1) then continue; end if;
  insert into public.commission_snapshots(shop_id,invoice_id,line_id,membership_id,employee_profile_id,employee_name,
   appointment_id,item_type,policy_version_id,rate_type,rate,currency,quantity,net_line_amount,original_commission)
  values(new.shop_id,new.id,line.id,line.membership_id,line.profile_id,line.employee_name,line.appointment_id,line.item_type::text,
   policy.id,rate->>'type',(rate->>'rate')::numeric,new.currency,line.quantity,line.total_amount,
   round(case rate->>'type' when 'percentage' then line.total_amount*(rate->>'rate')::numeric/100 else line.quantity*(rate->>'rate')::numeric end,2));
 end loop;
 perform shop_private.reconcile_commission(new.id);
 return new;
end; $$;
revoke all on function shop_private.capture_commission() from public,anon,authenticated,service_role;
create trigger zz_commission_capture after update of status on public.invoices for each row execute function shop_private.capture_commission();

create function shop_private.commission_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare sale uuid;
begin
 if tg_table_name in ('appointments','sale_corrections') then
  sale:=case when tg_table_name='appointments' then (to_jsonb(new)->>'sale_id')::uuid
   else (to_jsonb(new)->>'invoice_id')::uuid end;
 elsif tg_table_name='customer_payment_allocations' then sale:=new.invoice_id;
 else select invoice_id into sale from public.customer_payment_allocations where id=new.original_allocation_id;
 end if;
 if sale is not null then perform shop_private.reconcile_commission(sale); end if;
 return new;
end; $$;
revoke all on function shop_private.commission_notification() from public,anon,authenticated,service_role;
create trigger commission_payment_notification after insert on public.customer_payment_allocations for each row execute function shop_private.commission_notification();
create trigger commission_refund_notification after insert on public.customer_payment_adjustments for each row execute function shop_private.commission_notification();
create trigger commission_sale_correction_notification after insert on public.sale_corrections for each row execute function shop_private.commission_notification();
create trigger commission_fulfillment_notification after update of status,sale_id on public.appointments for each row execute function shop_private.commission_notification();

create function public.commission_history(p_shop_id uuid,p_invoice_id uuid default null,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform shop_private.commission_manager(p_shop_id);
 return jsonb_build_object('policy',coalesce((select jsonb_build_object('id',id,'policy',policy,'reason',reason,'createdAt',created_at)
  from public.commission_policy_versions where shop_id=p_shop_id order by created_at desc,id desc limit 1),
  '{"policy":{"enabled":false,"employees":[]}}'::jsonb),
  'totalCount',(select count(*) from public.commission_snapshots where shop_id=p_shop_id and (p_invoice_id is null or invoice_id=p_invoice_id)),
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',coalesce(p.display_name,p.email_snapshot)) order by m.id) from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=p_shop_id and m.status='active'),'[]'::jsonb),
  'lines',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'invoiceId',s.invoice_id,'lineId',s.line_id,
   'employeeName',s.employee_name,'membershipId',s.membership_id,'currency',s.currency,'rateType',s.rate_type,'rate',s.rate,
   'policyVersionId',s.policy_version_id,'netLineAmount',s.net_line_amount,'estimate',s.original_commission,
   'earned',coalesce((select sum(e.amount) from public.commission_events e where e.snapshot_id=s.id and e.kind='earned'),0),
   'adjustments',coalesce((select sum(e.amount) from public.commission_events e where e.snapshot_id=s.id and e.kind in('return','correction')),0),
   'exported',exists(select 1 from public.commission_events e where e.snapshot_id=s.id and e.kind='exported'),
   'postExportAdjustments',coalesce((select sum(e.amount) from public.commission_events e where e.snapshot_id=s.id and e.kind in('return','correction')
    and e.created_at>(select x.created_at from public.commission_events x where x.snapshot_id=s.id and x.kind='exported')),0),
   'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at,e.id) from public.commission_events e where e.snapshot_id=s.id),'[]'::jsonb)) order by s.created_at,s.id)
   from (select * from public.commission_snapshots where shop_id=p_shop_id and (p_invoice_id is null or invoice_id=p_invoice_id) order by created_at desc,id desc limit 100 offset greatest(0,coalesce(p_offset,0))) s),'[]'::jsonb));
end; $$;
revoke all on function public.commission_history(uuid,uuid,integer) from public,anon;
grant execute on function public.commission_history(uuid,uuid,integer) to authenticated;

create function public.record_commission_adjustment(p_shop_id uuid,p_snapshot_id uuid,p_request_id uuid,p_kind text,p_amount numeric,p_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; s public.commission_snapshots%rowtype; e public.commission_events%rowtype;
begin
 actor:=shop_private.commission_manager(p_shop_id);
 select * into s from public.commission_snapshots where id=p_snapshot_id and shop_id=p_shop_id;
 if not found then raise exception 'COMMISSION_SNAPSHOT_NOT_FOUND' using errcode='P0002'; end if;
 perform 1 from public.invoices where id=s.invoice_id for update;
 if p_request_id is null or p_kind is null or p_kind not in('correction','exported') or p_amount is null or round(p_amount,2)<>p_amount
  or (p_kind='exported' and p_amount<>0) or length(btrim(coalesce(p_reason,''))) not between 2 and 1000
  or not exists(select 1 from public.commission_events where snapshot_id=s.id and kind='earned') then
  raise exception 'INVALID_COMMISSION_ADJUSTMENT' using errcode='22023'; end if;
 select * into e from public.commission_events where snapshot_id=s.id and event_key=p_request_id::text;
 if found then
  if e.kind<>p_kind or e.amount<>p_amount or e.reason<>btrim(p_reason) or e.actor_profile_id<>actor then
   raise exception 'COMMISSION_REQUEST_CONFLICT' using errcode='23505'; end if;
  return;
 end if;
 insert into public.commission_events(snapshot_id,kind,event_key,amount,reason,actor_profile_id)
 values(s.id,p_kind,p_request_id::text,p_amount,btrim(p_reason),actor);
end; $$;
revoke all on function public.record_commission_adjustment(uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.record_commission_adjustment(uuid,uuid,uuid,text,numeric,text) to authenticated;

create function public.commission_assignment_context(p_shop_id uuid,p_invoice_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare location uuid;
begin
 perform shop_private.assert_shop_write_access(p_shop_id,'sales.manage');
 select i.location_id into location from public.invoices i where i.id=p_invoice_id and i.shop_id=p_shop_id and i.status='draft';
 if not found then
  raise exception 'COMMISSION_DRAFT_NOT_FOUND' using errcode='P0002'; end if;
 perform shop_private.assert_location_access(p_shop_id,location,true);
 return jsonb_build_object('lines',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'name',i.item_name,'itemType',i.item_type,
  'membershipId',a.membership_id,'appointmentId',a.appointment_id,'appointments',coalesce((select jsonb_agg(jsonb_build_object('id',ap.id,
  'membershipId',ap.assigned_membership_id,'label',coalesce(p.display_name,p.email_snapshot)||' · '||ap.starts_at::text) order by ap.starts_at,ap.id)
  from public.appointments ap join public.shop_memberships m on m.id=ap.assigned_membership_id join public.profiles p on p.id=m.profile_id
  where ap.shop_id=p_shop_id and ap.sale_id=p_invoice_id and ap.service_id=i.service_id and ap.status not in('cancelled','no_show')),'[]'::jsonb)) order by i.line_order,i.id)
  from public.invoice_items i left join public.commission_line_assignments a on a.line_id=i.id where i.invoice_id=p_invoice_id and i.shop_id=p_shop_id),'[]'::jsonb));
end; $$;
revoke all on function public.commission_assignment_context(uuid,uuid) from public,anon;
grant execute on function public.commission_assignment_context(uuid,uuid) to authenticated;
