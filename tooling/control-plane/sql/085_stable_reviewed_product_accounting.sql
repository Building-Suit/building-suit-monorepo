BEGIN;
-- A repaired source tree must not erase a previously proved product defect.
-- The trusted review is admitted against byte-bound v2 evidence. Only another
-- trusted review of that exact check can correct its classification; ordinary
-- observer/audit snapshots cannot refund a charge by labelling it UNKNOWN.
CREATE OR REPLACE FUNCTION control.product_retry_accounting(p_task text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 WITH entries AS (
 SELECT e.execution_id,e.attempt,e.status,
 CASE WHEN product.proved THEN 'PRODUCT_DEFECT' ELSE coalesce(c.classification,'OTHER') END AS classification,
 c.source,c.evidence,c.classification_id,coalesce(product.proved,false) AS charged
 FROM control.executions e
 LEFT JOIN LATERAL (SELECT * FROM control.product_attempt_classifications a WHERE a.execution_id=e.execution_id ORDER BY classification_id DESC LIMIT 1)c ON true
 LEFT JOIN LATERAL (SELECT bool_or(
  vr.status='fail' AND vr.trusted_receipt->>'version'='2' AND vr.trusted_registration IS NOT NULL
  AND review.evidence->>'classification'='PRODUCT_DEFECT'
  AND review.evidence->>'version'='2'
  AND review.evidence->>'task_id'=e.task_id
  AND (review.evidence->>'execution_id')::bigint=e.execution_id
  AND (review.evidence->>'verification_run_id')::bigint=vr.verification_run_id
  AND (review.evidence->>'check_id')::bigint=vr.verification_id
  AND review.evidence->'registered_command'=vr.trusted_registration
  AND review.evidence->'artifact'=vr.trusted_receipt->'artifact'
  AND review.evidence->>'source_fingerprint'=vr.trusted_receipt->>'source_fingerprint'
 ) AS proved FROM control.verification_results vr JOIN control.verification_failure_reviews review USING(verification_id) WHERE vr.execution_id=e.execution_id) product ON true
 WHERE e.task_id=p_task)
 SELECT jsonb_build_object('consumed',count(*) FILTER(WHERE charged),'genuine_product',count(*) FILTER(WHERE charged),
 'all_product',coalesce(bool_and(charged),false),'classifications',coalesce(jsonb_agg(to_jsonb(entries) ORDER BY attempt),'[]'::jsonb)) FROM entries;
$$;
ALTER FUNCTION control.product_retry_accounting(text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.product_retry_accounting(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.product_retry_accounting(text) TO bs_control_app,bs_control_observer,bs_control_verifier;
COMMIT;
