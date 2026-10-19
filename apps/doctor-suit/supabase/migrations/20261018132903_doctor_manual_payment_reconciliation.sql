-- DOS-AE-005: read-only SaaS manual-payment reconciliation. No live acceptance,
-- invoice, settlement, patient-revenue or lifecycle authority is introduced.
create function doctor_private.manual_payment_reconciliation(
 p_review_queue boolean,p_from timestamptz,p_until timestamptz,p_status text,p_page integer
)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();result jsonb;
begin
 if p_review_queue is null or p_page is null or p_page not between 1 and 1000000
  or p_status is null or p_status not in('all','submitted','under_review','rejected','funds_verified','activated')
  or(p_from is not null and(not pg_catalog.isfinite(p_from)or p_from<'0001-01-01Z'::timestamptz or p_from>'9999-12-31 23:59:59.999999Z'::timestamptz))
  or(p_until is not null and(not pg_catalog.isfinite(p_until)or p_until<'0001-01-01Z'::timestamptz or p_until>'9999-12-31 23:59:59.999999Z'::timestamptz))
  or(p_from is not null and p_until is not null and p_from>=p_until)then
  raise exception using errcode='22023',message='DOCTOR_MANUAL_REPORT_QUERY_INVALID';
 end if;
 if p_review_queue then perform doctor_private.require_manual_reviewer();end if;
 -- Materialize the complete authorized notice cohort and its latest immutable
 -- evidence in ONE statement snapshot, including totals and the selected page.
 -- Dates select notice creation [from,until), not bank cash-flow dates.
 with evidence as materialized(
  select n.id,n.subscriber_user_id,n.intent_id,n.created_at,n.requires_attention,
   q.id as quote_id,q.terms_version_id,q.amount_minor,q.currency,q.currency_exponent,
   coalesce(r.action,'submitted')as status,coalesce(r.revision,0)as revision,
   f.id as funds_id,f.received_minor,f.currency as received_currency,f.received_at,f.verified_at,
   p.id as period_id,p.started_at,p.ends_at,
   (f.id is not null and f.received_minor=q.amount_minor and f.currency=q.currency
    and f.recipient_account_key=recipient.account_key and f.verified_by<>n.subscriber_user_id
    and exists(select 1 from public.doctor_manual_payment_reviews v where v.notice_id=n.id
     and v.action='funds_verified'and v.funds_id=f.id and v.actor_user_id=f.verified_by))as funds_bound,
   coalesce(p.kind='manual_paid'and doctor_private.manual_paid_period_valid(p),false)as period_bound
  from public.doctor_manual_payment_notices n
  join public.doctor_saas_payment_intents i on i.id=n.intent_id and i.subscriber_user_id=n.subscriber_user_id
  join public.doctor_saas_quotes q on q.id=i.quote_id and q.subscriber_user_id=n.subscriber_user_id
  join public.doctor_manual_payment_recipients recipient on recipient.id=n.recipient_id
  left join lateral(select h.* from public.doctor_manual_payment_reviews h where h.notice_id=n.id order by h.revision desc limit 1)r on true
  left join public.doctor_manual_received_funds f on f.notice_id=n.id
  left join public.doctor_saas_periods p on p.id=r.period_id
  where(p_review_queue or n.subscriber_user_id=actor)
   and(p_from is null or n.created_at>=p_from)and(p_until is null or n.created_at<p_until)
 ),population as materialized(
  select *,((status in('funds_verified','activated'))<>funds_bound
   or(status='activated')<>period_bound)as discrepancy
  from evidence where p_status='all'or status=p_status
 ),currencies as(
  select currency,currency_exponent,count(*)as notices,sum(amount_minor::numeric)::text as claimed_minor,
   count(*)filter(where status in('submitted','under_review'))as pending_count,
   coalesce(sum(amount_minor::numeric)filter(where status in('submitted','under_review')),0)::text as pending_minor,
   count(*)filter(where status='rejected')as rejected_count,
   coalesce(sum(amount_minor::numeric)filter(where status='rejected'),0)::text as rejected_minor,
   count(*)filter(where funds_bound)as verified_count,
   coalesce(sum(received_minor::numeric)filter(where funds_bound),0)::text as verified_minor,
   count(*)filter(where funds_bound and period_bound)as activated_count,
   coalesce(sum(received_minor::numeric)filter(where funds_bound and period_bound),0)::text as activated_minor,
   count(*)filter(where funds_bound and not period_bound)as awaiting_activation_count,
   coalesce(sum(received_minor::numeric)filter(where funds_bound and not period_bound),0)::text as awaiting_activation_minor,
   count(*)filter(where requires_attention)as attention_count,count(*)filter(where discrepancy)as discrepancy_count
  from population group by currency,currency_exponent
 ),page as(select * from population order by created_at desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('actor_user_id',actor,'review_queue',p_review_queue,'scope','saas_manual_only','data_mode','synthetic',
  'totals_scope','filtered_full_population','date_basis','notice_created_at','observed_at',statement_timestamp(),
  'from',p_from,'until',p_until,'status',p_status,'page',p_page,'page_size',25,'total',(select count(*)from population),
  'live_activation',false,'patient_revenue_included',false,'invoices_available',false,'settlement_available',false,'independent_financial_review','pending',
  'currencies',coalesce((select jsonb_agg(to_jsonb(c)order by c.currency,c.currency_exponent)from currencies c),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'subscriber_user_id',subscriber_user_id,'intent_id',intent_id,
   'quote_id',quote_id,'terms_id',terms_version_id,'created_at',created_at,'status',status,'revision',revision,
   'amount_minor',amount_minor::text,'currency',currency,'currency_exponent',currency_exponent,'requires_attention',requires_attention,
   'discrepancy',discrepancy,'funds_id',funds_id,'received_minor',received_minor::text,'received_currency',received_currency,
   'received_at',received_at,'verified_at',verified_at,'funds_bound',funds_bound,'period_id',period_id,
   'period_started_at',started_at,'period_ends_at',ends_at,'period_bound',period_bound)order by created_at desc,id)from page),'[]'::jsonb))into result;
 return result;
end $$;
create function public.doctor_manual_payment_reconciliation(
 p_review_queue boolean default false,p_from timestamptz default null,p_until timestamptz default null,
 p_status text default'all',p_page integer default 1
)returns jsonb language sql volatile security invoker set search_path=''as $$
 select doctor_private.manual_payment_reconciliation(p_review_queue,p_from,p_until,p_status,p_page)
$$;
revoke all on function doctor_private.manual_payment_reconciliation(boolean,timestamptz,timestamptz,text,integer),public.doctor_manual_payment_reconciliation(boolean,timestamptz,timestamptz,text,integer)from public,anon,authenticated,service_role;
grant execute on function doctor_private.manual_payment_reconciliation(boolean,timestamptz,timestamptz,text,integer),public.doctor_manual_payment_reconciliation(boolean,timestamptz,timestamptz,text,integer)to authenticated;
