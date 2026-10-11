BEGIN;
CREATE OR REPLACE FUNCTION control.operator_gate_offers(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT coalesce(jsonb_agg(offer),'[]') FROM jsonb_array_elements(control.operator_gate_offers_external_v1(p_run)) offer
 WHERE (offer->>'action'<>'external-evidence-acknowledgement'
 OR control.external_evidence_status(offer->>'task_id',(offer->>'verification_id')::bigint)->>'eligible'='true')
 AND (offer->>'action'<>'product-retry-extension' OR NOT EXISTS(
 SELECT 1 FROM control.operator_invocation_extensions extension
 WHERE extension.run_id=p_run AND extension.task_id=offer->>'task_id' AND extension.kind='product-retry-extension'
 AND extension.consumed_at IS NULL AND extension.revoked_at IS NULL));
$$;
COMMIT;
