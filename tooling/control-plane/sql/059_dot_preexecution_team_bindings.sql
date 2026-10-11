BEGIN;
CREATE OR REPLACE FUNCTION control.reconcile_preexecution_team_bindings(p_task text,p_proof jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE t control.tasks%ROWTYPE; r control.workflow_runs%ROWTYPE; old_config jsonb; c jsonb; entry text; expected jsonb := $catalog${"commands": [{"name": "shop-team-database", "program": "pnpm", "args": ["db:test:shop"], "capabilities": ["database"], "required": true, "timeout_ms": 1800000, "changed_paths": ["__verification-plan-only__/shop-team-database"]}, {"name": "shop-team-unit", "program": "node", "args": ["--test", "apps/shop-suit/tests/unit/team.test.mjs"], "capabilities": ["unit"], "required": true, "timeout_ms": 1800000, "changed_paths": ["__verification-plan-only__/shop-team-unit"]}, {"name": "shop-team-quality", "program": "pnpm", "args": ["exec", "turbo", "run", "typecheck", "lint", "build", "--filter=@building-suit/shop-suit"], "capabilities": ["typecheck", "lint", "build"], "required": true, "timeout_ms": 1800000, "changed_paths": ["__verification-plan-only__/shop-team-quality"]}, {"name": "shop-team-browser", "program": "pnpm", "args": ["exec", "playwright", "test", "--config", "packages/testing/playwright.shop-ux.config.ts", "cross-workflow-usability.spec.ts", "--grep", "retail routes, labels and responsive states"], "capabilities": ["browser", "e2e"], "required": true, "timeout_ms": 1800000, "changed_paths": ["__verification-plan-only__/shop-team-browser"]}], "legacy_plan_mappings": {"DB tests for role CRUD, permission escalation denial, invitation races/replay, existing/new user acceptance, suspension and owner continuity.": {"version": 2, "kind": "group", "commands": ["shop-team-database", "shop-team-unit"], "requires": ["database", "unit"]}, "Full pnpm db:test:shop if Shop schema/RPCs change.": {"version": 2, "kind": "group", "commands": ["shop-team-database"], "requires": ["database"]}, "EN/AR desktop/mobile Team E2E and Shop typecheck/lint/build.": {"version": 2, "kind": "group", "commands": ["shop-team-quality", "shop-team-browser"], "requires": ["browser", "e2e", "typecheck", "lint", "build"]}}}$catalog$::jsonb;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 IF t.task_id IS DISTINCT FROM 'SS-LAUNCH-TEAM-001' OR t.workstream_slug IS DISTINCT FROM 'shop-suit'
 OR t.status NOT IN('ready','in_progress') OR EXISTS(SELECT 1 FROM control.executions WHERE task_id=p_task)
 OR t.verification_plan IS DISTINCT FROM $plan$["DB tests for role CRUD, permission escalation denial, invitation races/replay, existing/new user acceptance, suspension and owner continuity.", "Full pnpm db:test:shop if Shop schema/RPCs change.", "EN/AR desktop/mobile Team E2E and Shop typecheck/lint/build."]$plan$::jsonb
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
 IF NOT(p_proof->'files' ?& ARRAY['apps/shop-suit/package.json','apps/shop-suit/tests/unit/team.test.mjs','apps/shop-suit/supabase/tests/shop_team_management.sql','apps/shop-suit/supabase/tests/shop_plan_limits.sql','tooling/database/test-shop-local.mjs','apps/shop-suit/tests/e2e/cross-workflow-usability.spec.ts','packages/testing/playwright.shop-ux.config.ts']) THEN RAISE EXCEPTION 'Missing executable source evidence';END IF;
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
REVOKE ALL ON FUNCTION control.reconcile_preexecution_team_bindings(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_preexecution_team_bindings(text,jsonb) TO bs_control_app;
COMMIT;
