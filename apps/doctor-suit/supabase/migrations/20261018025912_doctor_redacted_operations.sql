-- DOS-AE-009: subscriber-scoped synthetic diagnostics, never a readiness seal.
create index doctor_saas_intents_subscriber_created on public.doctor_saas_payment_intents(subscriber_user_id,created_at desc,id);
create function doctor_private.operations_status()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();result jsonb;
begin
 if not exists(select 1 from public.doctor_saas_quotes where subscriber_user_id=actor)
  and not exists(select 1 from public.doctor_saas_accounts where subscriber_user_id=actor)then perform doctor_private.require_owner_enrollment();end if;
 -- All changing counts share one statement snapshot. No patient content, raw
 -- callback, secret, endpoint, message recipient or other subscriber is returned.
 with intents as materialized(
  select doctor_private.saas_synthetic_reconciliation(id)as reconciliation from public.doctor_saas_payment_intents where subscriber_user_id=actor
 )
 select jsonb_build_object('subscriber_user_id',actor,'scope','own_saas_operations','data_mode','synthetic','state','diagnostics_only','observed_at',clock_timestamp(),
  'reconciliation',jsonb_build_object('held_intents',(select count(*)from intents),
   'unknown_review',(select count(*)from intents where reconciliation='unknown_review'),
   'discrepancy_review',(select count(*)from intents where reconciliation='discrepancy_review')),
  'privacy_intake',jsonb_build_object('awaiting_review',(select count(*)from public.doctor_privacy_requests where user_id=actor and state='awaiting_review'),'fulfillment_available',false),
  'payment_configuration','unconfigured','administration_configuration','unconfigured',
  'independent_financial_review','pending','independent_security_review','pending',
  'security_findings',jsonb_build_object('assessment','not_performed','critical',null,'high',null),
  'recovery',jsonb_build_object('qualification','pending','rpo',null,'rto',null,'whole_provider_qualified',false),
  'capacity',jsonb_build_object('approved_thresholds',null,'accepted_measurement',null,'provider_quota_cost_review','pending'),
  'incident_ownership','unconfigured','support_destination',null,'hosted_telemetry_available',false,
  'launch_decisions',jsonb_build_array('AE-D02','AE-D03','AE-D04','AE-D05','AE-D06','AE-D07','AE-D08','AE-D09','AE-D10'),
  'patient_payloads_included',false,'paid_activation_available',false,'live_activation',false)into result;
 return result;
end $$;
create function public.doctor_operations_status()returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.operations_status()$$;
revoke all on function doctor_private.operations_status(),public.doctor_operations_status()from public,anon,authenticated,service_role;
grant execute on function doctor_private.operations_status(),public.doctor_operations_status()to authenticated;
