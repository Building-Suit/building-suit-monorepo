BEGIN;
CREATE OR REPLACE FUNCTION control.reconcile_preexecution_auth_bindings(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE; r control.workflow_runs%ROWTYPE; old_config jsonb; c jsonb; entry text; expected jsonb := $catalog${"commands":[{"name":"shop-auth-unit","program":"node","args":["--test","apps/shop-suit/tests/unit/signup-otp-recovery.test.mjs"],"capabilities":["unit","otp-recovery"],"required":true,"timeout_ms":1800000,"changed_paths":["__verification-plan-only__/shop-auth-unit"]},{"name":"shop-auth-typecheck","program":"pnpm","args":["--filter","@building-suit/shop-suit","typecheck"],"capabilities":["typecheck"],"required":true,"timeout_ms":1800000,"changed_paths":["__verification-plan-only__/shop-auth-typecheck"]},{"name":"shop-auth-lint","program":"pnpm","args":["--filter","@building-suit/shop-suit","lint"],"capabilities":["lint"],"required":true,"timeout_ms":1800000,"changed_paths":["__verification-plan-only__/shop-auth-lint"]},{"name":"shop-auth-build","program":"pnpm","args":["--filter","@building-suit/shop-suit","build"],"capabilities":["build"],"required":true,"timeout_ms":1800000,"changed_paths":["__verification-plan-only__/shop-auth-build"]},{"name":"shop-auth-e2e","program":"pnpm","args":["exec","playwright","test","--config","apps/shop-suit/playwright.auth-otp.config.ts"],"capabilities":["browser","e2e","otp-recovery"],"required":true,"timeout_ms":1800000,"changed_paths":["__verification-plan-only__/shop-auth-e2e"]}],"legacy_plan_mappings":{"Focused unit/E2E coverage for confirmed existing email, unconfirmed existing email, invalid/expired OTP, resend, refresh and retry.":{"version":2,"kind":"group","commands":["shop-auth-unit","shop-auth-build","shop-auth-e2e"],"requires":["unit","browser","e2e","otp-recovery"]},"Run Shop auth-related tests plus Shop typecheck/lint/build.":{"version":2,"kind":"group","commands":["shop-auth-unit","shop-auth-typecheck","shop-auth-lint","shop-auth-build","shop-auth-e2e"],"requires":["unit","typecheck","lint","build","browser"]}}}$catalog$::jsonb;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 IF t.task_id IS DISTINCT FROM 'SS-LAUNCH-AUTH-EMAIL-001' OR t.workstream_slug IS DISTINCT FROM 'shop-suit'
 OR t.status NOT IN('ready','in_progress') OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task)
 OR t.verification_plan IS DISTINCT FROM $plan$["Focused unit/E2E coverage for confirmed existing email, unconfirmed existing email, invalid/expired OTP, resend, refresh and retry.","Run Shop auth-related tests plus Shop typecheck/lint/build."]$plan$::jsonb
 OR p_proof->>'task_id' IS DISTINCT FROM t.task_id OR p_proof->>'classification' IS DISTINCT FROM 'CONFIGURATION'
 OR p_proof->'config' IS DISTINCT FROM expected OR p_proof->'plan' IS DISTINCT FROM t.verification_plan
 OR p_proof->>'execution_count' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'Exact reviewed preexecution binding proof required';END IF;
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=(p_proof->>'run_id')::uuid AND current_task_id=p_task FOR UPDATE;
 IF r.run_id IS NULL OR r.project_id<>t.project_id OR r.workstream_slug<>t.workstream_slug THEN RAISE EXCEPTION 'Original active run required';END IF;
 PERFORM control.reconcile_ordinary_run_task(r.run_id,p_task);
 IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=r.run_id AND revoked_at IS NULL)
 THEN RAISE EXCEPTION 'Operator run authorization required';END IF;
 FOR entry IN SELECT jsonb_object_keys(p_proof->'files') LOOP
  IF coalesce(p_proof#>>ARRAY['files',entry],'') !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid executable source evidence';END IF;
 END LOOP;
 IF NOT(p_proof->'files' ?& ARRAY['apps/shop-suit/package.json','apps/shop-suit/tests/unit/signup-otp-recovery.test.mjs','apps/shop-suit/tests/e2e/auth-otp.spec.ts','apps/shop-suit/tests/e2e/auth-otp-server.mjs','apps/shop-suit/playwright.auth-otp.config.ts','apps/shop-suit/app/utils/pendingOnboarding.ts']) THEN RAISE EXCEPTION 'Missing executable source evidence';END IF;
 SELECT verification_config INTO old_config FROM control.workstreams WHERE project_id=t.project_id AND slug=t.workstream_slug FOR UPDATE;
 FOR c IN SELECT value FROM jsonb_array_elements(expected->'commands') LOOP
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(old_config->'commands','[]')) x WHERE x->>'name'=c->>'name' AND x IS DISTINCT FROM c) THEN RAISE EXCEPTION 'Existing executable command conflict';END IF;
 END LOOP;
 FOR entry IN SELECT jsonb_object_keys(expected->'legacy_plan_mappings') LOOP
  IF old_config->'legacy_plan_mappings' ? entry AND old_config#>ARRAY['legacy_plan_mappings',entry] IS DISTINCT FROM expected#>ARRAY['legacy_plan_mappings',entry] THEN RAISE EXCEPTION 'Existing approved mapping conflict';END IF;
 END LOOP;
 IF (old_config->'commands') @> (expected->'commands') AND (old_config->'legacy_plan_mappings') @> (expected->'legacy_plan_mappings') THEN RETURN jsonb_build_object('reconciled',true,'idempotent',true,'product_attempts_added',0);END IF;
 UPDATE control.workstreams SET verification_config=jsonb_set(jsonb_set(coalesce(old_config,'{}'),'{commands}',
 coalesce(old_config->'commands','[]') || (SELECT coalesce(jsonb_agg(x),'[]') FROM jsonb_array_elements(expected->'commands') x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(old_config->'commands','[]')) y WHERE y->>'name'=x->>'name'))),
 '{legacy_plan_mappings}',coalesce(old_config->'legacy_plan_mappings','{}') || (expected->'legacy_plan_mappings')) WHERE project_id=t.project_id AND slug=t.workstream_slug;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(p_task,'preexecution_verification_bindings_reconciled','dot',jsonb_build_object('classification','CONFIGURATION','run_id',r.run_id,'proof',p_proof,'prior_verification_config',old_config,'product_attempts_added',0,'verification_pass_claimed',false));
 RETURN jsonb_build_object('reconciled',true,'product_attempts_added',0);
END $$;
REVOKE ALL ON FUNCTION control.reconcile_preexecution_auth_bindings(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_preexecution_auth_bindings(text,jsonb) TO bs_control_app;
COMMIT;
