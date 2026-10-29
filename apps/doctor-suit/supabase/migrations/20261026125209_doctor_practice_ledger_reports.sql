-- Synthetic issue-date-cohort reporting only. No recognized-revenue/tax, settlement or provider-payout claim.
-- A source relation supplies full-population metric contributions and immutable trace references.
create function doctor_private.practice_financial_report_sources(p_practice uuid,p_location uuid,p_from timestamptz,p_until timestamptz,p_status text)
returns table(metric text,unit text,source_kind text,source_id uuid,source_revision integer,location_id uuid,charge_id uuid,charge_version_id uuid,currency text,currency_exponent integer,contribution numeric,source_at timestamptz,cohort_issued_at timestamptz,source_label text,state text,reason_code text)
language sql stable security invoker set search_path=''as $$
 with versions as materialized(select v.* from public.doctor_visit_charge_versions v where v.practice_id=p_practice and(p_location is null or v.location_id=p_location)),
 firsts as(select v.charge_id,(array_agg(v.created_at order by v.revision))[1]issued_at,count(*)history_count,min(v.revision)first_revision from versions v group by v.charge_id),
 latest as(select distinct on(v.charge_id)v.* from versions v order by v.charge_id,v.revision desc),
 cohort as materialized(select c.*,f.issued_at,f.history_count,f.first_revision from latest c join firsts f using(charge_id)where(p_from is null or f.issued_at>=p_from)and(p_until is null or f.issued_at<p_until)),
 intents as materialized(select i.*,s.revision event_revision,s.state event_state,s.reason_code event_reason,s.created_at event_at from public.doctor_practice_payment_intents i join cohort c on c.charge_id=i.charge_id and c.practice_id=i.practice_id and c.location_id=i.location_id
 cross join lateral(select * from public.doctor_practice_payment_events e where e.intent_id=i.id order by e.revision desc limit 1)s),
 entries as materialized(select e.*,i.charge_id,i.charge_version_id,i.event_state,
  (a.entry_id is not null and a.charge_id=i.charge_id and a.charge_version_id=i.charge_version_id and a.amount_minor=e.amount_minor and e.amount_minor=i.amount_minor and e.kind=i.kind and e.original_entry_id is not distinct from i.original_entry_id and e.patient_id=i.patient_id and e.currency=i.currency and e.currency_exponent=i.currency_exponent)allocation_valid,
  exists(select 1 from doctor_private.synthetic_practice_payment_acceptances t where t.intent_id=i.id and t.outcome='accepted')accepted
 from public.doctor_practice_ledger_entries e join intents i on i.id=e.intent_id and i.practice_id=e.practice_id and i.location_id=e.location_id
 left join public.doctor_practice_payment_allocations a on a.entry_id=e.id),
 balances as materialized(select c.id,
 coalesce((select sum(case e.kind when'collection'then e.amount_minor::numeric else-e.amount_minor::numeric end)from entries e where e.charge_id=c.charge_id and e.allocation_valid and e.currency=c.currency and e.currency_exponent=c.currency_exponent),0)net,
 (select count(*)from intents i where i.charge_id=c.charge_id and i.event_state in('pending','unknown'))unresolved
 from cohort c),
 findings as materialized(
 select c.charge_id,'charge'::text kind,c.id item,c.revision item_revision,c.id version_id,c.currency,c.currency_exponent,c.created_at at_time,'charge_history_gap'::text code from cohort c where c.first_revision<>1 or c.history_count<>c.revision
 union all select i.charge_id,'intent_event',i.id,i.event_revision,i.charge_version_id,i.currency,i.currency_exponent,i.event_at,'posted_receipt_missing'from intents i where i.event_state='posted'and not exists(select 1 from entries e where e.intent_id=i.id)
 union all select e.charge_id,'ledger',e.id,null,e.charge_version_id,e.currency,e.currency_exponent,e.created_at,'allocation_missing_or_changed'from entries e where not e.allocation_valid
 union all select e.charge_id,'ledger',e.id,null,e.charge_version_id,e.currency,e.currency_exponent,e.created_at,'unaccepted_posted_entry'from entries e where not e.accepted
 union all select e.charge_id,'ledger',e.id,null,e.charge_version_id,e.currency,e.currency_exponent,e.created_at,'ledger_status_mismatch'from entries e where e.event_state<>'posted'
 union all select e.charge_id,'ledger',e.id,null,e.charge_version_id,e.currency,e.currency_exponent,e.created_at,'source_currency_mismatch'from entries e join cohort c on c.charge_id=e.charge_id where e.currency<>c.currency or e.currency_exponent<>c.currency_exponent
 union all select c.charge_id,'charge',c.id,c.revision,c.id,c.currency,c.currency_exponent,c.created_at,'allocated_balance_outside_charge'from cohort c join balances b on b.id=c.id where b.net<0 or b.net>c.amount_minor),
 selected as materialized(select c.*,b.net,b.unresolved,case when b.net<0 or b.net>c.amount_minor then'discrepancy'when b.net=c.amount_minor then'covered'when b.net=0 then'uncollected'else'partial'end balance_state
 from cohort c join balances b on b.id=c.id where p_status='all'or(p_status='outstanding'and b.net<c.amount_minor)or(p_status='covered'and b.net=c.amount_minor)or(p_status='attention'and(b.unresolved>0 or exists(select 1 from findings f where f.charge_id=c.charge_id))))
 select 'charges','minor','charge',c.id,c.revision,c.location_id,c.charge_id,c.id,c.currency,c.currency_exponent,c.amount_minor::numeric,c.created_at,c.issued_at,c.label,c.balance_state,null::text from selected c
 union all select 'outstanding','minor','charge',c.id,c.revision,c.location_id,c.charge_id,c.id,c.currency,c.currency_exponent,greatest(c.amount_minor::numeric-c.net,0),c.created_at,c.issued_at,c.label,c.balance_state,null from selected c where c.amount_minor::numeric-c.net>0
 union all select 'credit','minor','charge',c.id,c.revision,c.location_id,c.charge_id,c.id,c.currency,c.currency_exponent,greatest(c.net-c.amount_minor::numeric,0),c.created_at,c.issued_at,c.label,c.balance_state,null from selected c where c.net>c.amount_minor
 union all select case e.kind when'collection'then'collections'else'refunds'end,'minor','ledger',e.id,null,e.location_id,e.charge_id,e.charge_version_id,e.currency,e.currency_exponent,e.amount_minor::numeric,e.created_at,c.issued_at,c.label,'posted',null from entries e join selected c on c.charge_id=e.charge_id
 union all select case i.kind when'collection'then'reserved_collections'else'reserved_refunds'end,'minor','intent_event',i.id,i.event_revision,i.location_id,i.charge_id,i.charge_version_id,i.currency,i.currency_exponent,i.amount_minor::numeric,i.event_at,c.issued_at,c.label,i.event_state,i.event_reason from intents i join selected c on c.charge_id=i.charge_id where i.event_state in('pending','unknown')
 union all select 'unknown','count','intent_event',i.id,i.event_revision,i.location_id,i.charge_id,i.charge_version_id,i.currency,i.currency_exponent,1::numeric,i.event_at,c.issued_at,c.label,i.event_state,i.event_reason from intents i join selected c on c.charge_id=i.charge_id where i.event_state='unknown'
 union all select 'discrepancies','count',f.kind,f.item,f.item_revision,c.location_id,c.charge_id,f.version_id,f.currency,f.currency_exponent,1::numeric,f.at_time,c.issued_at,c.label,'attention',f.code from findings f join selected c on c.charge_id=f.charge_id
$$;
create function doctor_private.practice_financial_report(p_practice uuid,p_location uuid,p_from timestamptz,p_until timestamptz,p_status text,p_metric text,p_currency text,p_exponent integer,p_page integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;guard_location uuid;result jsonb;observed timestamptz;begin
 select coalesce(p_location,(select id from public.locations where practice_id=p_practice order by id limit 1))into guard_location;
 actor:=doctor_private.practice_billing_owner(p_practice,guard_location,false);
 if p_status is null or p_status not in('all','outstanding','covered','attention')or p_metric is null or p_metric not in('charges','collections','refunds','outstanding','credit','reserved_collections','reserved_refunds','unknown','discrepancies')
 or p_page is null or p_page<1 or p_page>1000000 or(p_currency is null)<>(p_exponent is null)
 or(p_currency is not null and(p_currency!~'^[A-Z]{3}$'or p_exponent<0 or p_exponent>4))
 or(p_from is not null and not isfinite(p_from))or(p_until is not null and not isfinite(p_until))or(p_from is not null and p_until is not null and p_until<=p_from)then raise exception using errcode='22023',message='DOCTOR_FINANCIAL_REPORT_QUERY_INVALID';end if;
 observed:=clock_timestamp();
 with population as materialized(select * from doctor_private.practice_financial_report_sources(p_practice,p_location,p_from,p_until,p_status)),
 grouped as(select r.currency,r.currency_exponent,
 coalesce(sum(r.contribution)filter(where metric='charges'),0)::text charges_minor,coalesce(sum(r.contribution)filter(where metric='collections'),0)::text collections_minor,
 coalesce(sum(r.contribution)filter(where metric='refunds'),0)::text refunds_minor,coalesce(sum(r.contribution)filter(where metric='outstanding'),0)::text outstanding_minor,
 coalesce(sum(r.contribution)filter(where metric='credit'),0)::text credit_minor,coalesce(sum(r.contribution)filter(where metric='reserved_collections'),0)::text reserved_collection_minor,
 coalesce(sum(r.contribution)filter(where metric='reserved_refunds'),0)::text reserved_refund_minor,coalesce(sum(r.contribution)filter(where metric='unknown'),0)::text unknown_count,
 coalesce(sum(r.contribution)filter(where metric='discrepancies'),0)::text discrepancy_count
 from population r group by r.currency,r.currency_exponent),
 filtered as materialized(select * from population r where r.metric=p_metric and(p_currency is null or(r.currency=p_currency and r.currency_exponent=p_exponent))),
 page as(select * from filtered order by source_at desc,source_kind,source_id,coalesce(source_revision,0),coalesce(reason_code,'') limit 25 offset(p_page-1)*25)
 select jsonb_build_object('actor_user_id',actor,'practice_id',p_practice,'location_id',p_location,'from',p_from,'until',p_until,'status',p_status,'metric',p_metric,'source_currency',p_currency,'source_exponent',p_exponent,'page',p_page,
 'date_basis','first_charge_issue_utc_inclusive_start_exclusive_end','balance_basis','current_latest_charge_with_full_linked_history','observed_at',observed,
 'totals',coalesce((select jsonb_agg(to_jsonb(g)order by g.currency,g.currency_exponent)from grouped g),'[]'::jsonb),
 'total',(select count(*)from filtered),'items',coalesce((select jsonb_agg(to_jsonb(r)-'contribution'||jsonb_build_object('contribution',r.contribution::text)order by r.source_at desc,r.source_kind,r.source_id,coalesce(r.source_revision,0),coalesce(r.reason_code,''))from page r),'[]'::jsonb),
 'data_mode','synthetic','external_transport_enabled',false,'live_collection',false,'tax_invoice_available',false,'tax_applicability','unreviewed','provider_payout','unavailable','saas_ledger_included',false)into result;
 return result;
end $$;
create function public.doctor_practice_financial_report(p_practice uuid,p_location uuid default null,p_from timestamptz default null,p_until timestamptz default null,p_status text default'all',p_metric text default'charges',p_currency text default null,p_exponent integer default null,p_page integer default 1)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.practice_financial_report(p_practice,p_location,p_from,p_until,p_status,p_metric,p_currency,p_exponent,p_page)$$;
revoke all on function doctor_private.practice_financial_report_sources(uuid,uuid,timestamptz,timestamptz,text),doctor_private.practice_financial_report(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,integer),public.doctor_practice_financial_report(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.practice_financial_report(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,integer),public.doctor_practice_financial_report(uuid,uuid,timestamptz,timestamptz,text,text,text,integer,integer)to authenticated;
-- Exact immutable source drilldown. A later current balance/event cannot replace the requested snapshot.
create function doctor_private.practice_financial_source(p_practice uuid,p_location uuid,p_kind text,p_source uuid,p_revision integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid;guard_location uuid;charge public.doctor_visit_charge_versions;price public.doctor_service_price_versions;entry public.doctor_practice_ledger_entries;intent public.doctor_practice_payment_intents;event public.doctor_practice_payment_events;place public.locations;result jsonb;item jsonb;extra jsonb:='{}'::jsonb;patient uuid;source_location uuid;actual_revision integer;
begin
 select coalesce(p_location,(select id from public.locations where practice_id=p_practice order by id limit 1))into guard_location;
 actor:=doctor_private.practice_billing_owner(p_practice,guard_location,false);
 if p_source is null or p_kind is null or p_kind not in('charge','ledger','intent_event')or(p_revision is not null and p_revision<1)or(p_kind='ledger'and p_revision is not null)or(p_kind='intent_event'and p_revision is null)then raise exception using errcode='22023',message='DOCTOR_FINANCIAL_SOURCE_QUERY_INVALID';end if;
 if p_kind='charge'then
  select * into charge from public.doctor_visit_charge_versions where practice_id=p_practice and id=p_source and(p_location is null or location_id=p_location);
  if charge.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  if p_revision is not null and p_revision<>charge.revision then raise exception using errcode='22023',message='DOCTOR_FINANCIAL_SOURCE_QUERY_INVALID';end if;
  select * into price from public.doctor_service_price_versions where id=charge.price_id and practice_id=p_practice and location_id=charge.location_id;
  item:=doctor_private.billing_charge_projection(charge);extra:=jsonb_build_object('price',doctor_private.billing_price_projection(price));patient:=charge.patient_id;source_location:=charge.location_id;actual_revision:=charge.revision;
 elsif p_kind='ledger'then
  select * into entry from public.doctor_practice_ledger_entries where practice_id=p_practice and id=p_source and(p_location is null or location_id=p_location);
  if entry.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  select * into intent from public.doctor_practice_payment_intents where id=entry.intent_id and practice_id=p_practice and location_id=entry.location_id;
  item:=to_jsonb(entry)-'amount_minor'-'receipt_number'||jsonb_build_object('amount_minor',entry.amount_minor::text,'receipt_number',entry.receipt_number::text,'receipt_label','SYN-'||lpad(entry.receipt_number::text,greatest(8,length(entry.receipt_number::text)),'0'));
  extra:=jsonb_build_object('intent',to_jsonb(intent)-'amount_minor'||jsonb_build_object('amount_minor',intent.amount_minor::text),
   'allocation',(select to_jsonb(a)-'amount_minor'||jsonb_build_object('amount_minor',a.amount_minor::text)from public.doctor_practice_payment_allocations a where a.entry_id=entry.id),
   'original_receipt_label',(select'SYN-'||lpad(e.receipt_number::text,greatest(8,length(e.receipt_number::text)),'0')from public.doctor_practice_ledger_entries e where e.id=entry.original_entry_id and e.practice_id=p_practice and e.location_id=entry.location_id));
  patient:=entry.patient_id;source_location:=entry.location_id;actual_revision:=null;
 else
  select * into intent from public.doctor_practice_payment_intents where practice_id=p_practice and id=p_source and(p_location is null or location_id=p_location);
  if intent.id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  select * into event from public.doctor_practice_payment_events where intent_id=intent.id and revision=p_revision;
  if event.intent_id is null then raise exception using errcode='42501',message='DOCTOR_BILLING_SOURCE_REQUIRED';end if;
  item:=to_jsonb(event);extra:=jsonb_build_object('intent',to_jsonb(intent)-'amount_minor'||jsonb_build_object('amount_minor',intent.amount_minor::text),'current_event_revision',(select max(revision)from public.doctor_practice_payment_events where intent_id=intent.id));
  patient:=intent.patient_id;source_location:=intent.location_id;actual_revision:=event.revision;
 end if;
 select * into place from public.locations where id=source_location and practice_id=p_practice;
 result:=jsonb_build_object('actor_user_id',actor,'practice_id',p_practice,'requested_location_id',p_location,'location_id',source_location,'kind',p_kind,'source_id',p_source,'source_revision',actual_revision,
 'patient_id',patient,'patient_name',(select display_name from public.practice_patients where id=patient and practice_id=p_practice),'clinic_name',place.name,'timezone',place.timezone,'record',item,'details',extra,
 'data_mode','synthetic','external_transport_enabled',false,'live_collection',false,'tax_invoice_available',false,'tax_applicability','unreviewed','provider_payout','unavailable','saas_ledger_included',false);
 return result;
end $$;
create function public.doctor_practice_financial_source(p_practice uuid,p_kind text,p_source uuid,p_revision integer default null,p_location uuid default null)returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.practice_financial_source(p_practice,p_location,p_kind,p_source,p_revision)$$;
revoke all on function doctor_private.practice_financial_source(uuid,uuid,text,uuid,integer),public.doctor_practice_financial_source(uuid,text,uuid,integer,uuid)from public,anon,authenticated,service_role;
grant execute on function doctor_private.practice_financial_source(uuid,uuid,text,uuid,integer),public.doctor_practice_financial_source(uuid,text,uuid,integer,uuid)to authenticated;
