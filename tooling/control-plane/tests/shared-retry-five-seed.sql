\set ON_ERROR_STOP on
INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles) VALUES('foundation-three','Old fixture',3,'["standard","deep","review"]') ON CONFLICT DO NOTHING;
UPDATE control.workstreams SET publication_config='{"merge_authorized":false,"deployment_authorized":false,"hosted_database_changes_authorized":false}',retry_policy_id='foundation-three' WHERE slug='shared';
INSERT INTO control.tasks(task_id,suit_slug,sequence,title,description,status,acceptance_criteria,verification_plan,metadata,project_id,workstream_slug,retry_policy_id)
SELECT task,'shared',ordinal,task,'only disposable database','failed','["fixture"]','["git diff --check"]','{"allowed_paths":[]}',project_id,'shared','foundation-three'
FROM (VALUES('CP-FIVE-PRODUCT-001',91001),('CP-FIVE-INFRA-001',91002),('CP-FIVE-GATE-001',91003),('CP-FIVE-REVIEW-001',91004)) f(task,ordinal) CROSS JOIN control.projects WHERE slug='building-suit';
INSERT INTO control.executions(task_id,attempt,status,model_profile,model_name,reasoning_effort,worktree_path,branch_name,parent_branch,parent_sha,resolved_retry_policy,metadata)
SELECT t.task_id,a,'failed',CASE a WHEN 1 THEN 'standard' WHEN 2 THEN 'deep' ELSE 'review' END,CASE WHEN a>=3 THEN 'gpt-6-astra' ELSE 'gpt-6.1-sol' END,CASE WHEN a=1 THEN 'medium' ELSE 'high' END,'/tmp/fixture','codex/shared/fixture','stg',repeat('a',40),
'{"policy_id":"foundation-three","max_attempts":3,"attempt_profiles":["standard","deep","review"]}',
CASE WHEN t.task_id='CP-FIVE-INFRA-001' THEN '{"verification_probe_failures":[{"name":"planned","status":"not_run","failure_class":"verification-product-defect","selection_reason":"generator_disposable_fixture_runner_not_registered"}]}'::jsonb
ELSE '{"verification_probe_failures":[{"name":"actual-assertion","status":"fail","failure_class":"verification-product-defect"}]}'::jsonb END
FROM control.tasks t CROSS JOIN LATERAL generate_series(1,CASE WHEN t.task_id='CP-FIVE-GATE-001' THEN 5 ELSE 3 END) a WHERE t.task_id LIKE 'CP-FIVE-%';
UPDATE control.executions SET metadata=metadata||'{"verification_probe_verified_state":{"base_sha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","files":[{"file":"apps/ledger-suit/tests/e2e/fixture.spec.ts","object":"original-test"},{"file":"packages/ui/src/table.vue","object":"original-product"}]}}'::jsonb WHERE task_id='CP-FIVE-REVIEW-001';
CREATE TABLE five_historical_executions AS SELECT to_jsonb(e) AS snapshot FROM control.executions e WHERE task_id LIKE 'CP-FIVE-%';
