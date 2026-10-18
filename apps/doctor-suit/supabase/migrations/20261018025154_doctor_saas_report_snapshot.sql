-- One statement supplies the full cohort, currency totals and page rows.
-- VOLATILE authority checks stay fresh; all financial projection reads share
-- the statement's MVCC snapshot without blocking a new held intent.
create or replace function doctor_private.saas_financial_status(p_page integer,p_size integer)returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();result jsonb;
begin
 if p_page is null or p_page<0 or p_size is null or p_size not between 1 and 100 then raise exception using errcode='22023',message='DOCTOR_PAGE_INVALID';end if;
 if not exists(select 1 from public.doctor_saas_quotes where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 with population as materialized(
  select i.*,q.currency,q.currency_exponent,q.amount_minor
  from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q on q.id=i.quote_id and q.subscriber_user_id=i.subscriber_user_id
  where i.subscriber_user_id=actor
 ),currencies as(
  select currency,currency_exponent,count(*)as held_intents,sum(amount_minor::numeric)as quoted_minor
  from population group by currency,currency_exponent
 ),page as(
  select *from population order by created_at desc,id limit p_size offset p_page::bigint*p_size
 )
 select jsonb_build_object('subscriber_user_id',actor,'scope','saas_only','data_mode','synthetic','payment_route','unconfigured',
  'invoices_available',false,'settlement_available',false,'lifecycle_available',false,'independent_financial_review','pending',
  'patient_revenue_included',false,'totals_scope','full_population','total',(select count(*)from population),
  'currencies',(select coalesce(jsonb_agg(jsonb_build_object('currency',currency,'currency_exponent',currency_exponent,'held_intents',held_intents,
   'quoted_minor',quoted_minor::text,'settled_minor',null)order by currency,currency_exponent),'[]'::jsonb)from currencies),
  'items',(select coalesce(jsonb_agg(jsonb_build_object('intent_id',p.id,'quote_id',p.quote_id,'state',p.state,'created_at',p.created_at,
   'reconciliation',doctor_private.saas_synthetic_reconciliation(p.id),
   'synthetic_event_ids',(select coalesce(jsonb_agg(e.id order by e.source_sequence,e.id),'[]'::jsonb)from public.doctor_saas_synthetic_events e where e.intent_id=p.id))order by p.created_at desc,p.id),'[]'::jsonb)from page p),
  'paid_activation_available',false,'live_activation',false)into result;
 return result;
end $$;
