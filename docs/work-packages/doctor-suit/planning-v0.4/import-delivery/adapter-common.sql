-- Rendered offline. Parent chooses the authenticated Automation connector target.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE doctor_import_input ON COMMIT DROP AS SELECT __INPUT__ AS doc, __BINDINGS__ AS bindings;
CREATE FUNCTION pg_temp.doctor_assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',message; END IF; END $$;
SELECT pg_advisory_xact_lock(hashtextextended('doctor-plan-storage:f71b3b2b-d56b-4f7e-94f5-0b8c379a1088',0));
SELECT 1 FROM control.projects WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' FOR UPDATE;
SELECT pg_temp.doctor_assert((SELECT to_jsonb(p)-'created_at'-'updated_at' FROM control.projects p WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088')=(SELECT bindings->'project_snapshot' FROM doctor_import_input),'Project snapshot drift or wrong target');
SELECT pg_temp.doctor_assert(EXISTS(SELECT 1 FROM control.projects WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088' AND slug='building-suit' AND github_repository='Building-Suit/building-suit-monorepo' AND active),'Wrong/inactive project');
CREATE TEMP TABLE doctor_project_before ON COMMIT DROP AS SELECT to_jsonb(p)-'created_at'-'updated_at' AS doc FROM control.projects p WHERE project_id='f71b3b2b-d56b-4f7e-94f5-0b8c379a1088';
SELECT pg_temp.doctor_assert(md5(pg_get_functiondef('control.create_task_with_publication_contract(text,text,text,integer,integer,text,text,text,text,text,jsonb,jsonb,text,jsonb)'::regprocedure))=(SELECT bindings->>'create_function_md5' FROM doctor_import_input),'Creation function fingerprint drift');
SELECT pg_temp.doctor_assert(md5(pg_get_functiondef('control.refresh_publication_readiness_contract(text,text)'::regprocedure))=(SELECT bindings->>'refresh_function_md5' FROM doctor_import_input),'Refresh function fingerprint drift');
SELECT pg_temp.doctor_assert(md5(pg_get_viewdef('control.ready_tasks'::regclass,true))=(SELECT bindings->>'ready_view_md5' FROM doctor_import_input),'Ready predicate fingerprint drift');
SELECT pg_temp.doctor_assert((__CATALOG__)=(SELECT bindings->>'catalog_md5' FROM doctor_import_input),'Control schema/constraint/trigger fingerprint drift');
SELECT pg_temp.doctor_assert(EXISTS(SELECT 1 FROM control.retry_policies p,doctor_import_input i WHERE p.policy_id=i.bindings->>'retry_policy_id' AND p.active AND jsonb_array_length(p.attempt_profiles)=p.max_attempts AND p.max_attempts>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.attempt_profiles) a WHERE a<>'deep')),'Missing active all-deep retry route');
CREATE FUNCTION pg_temp.doctor_assert_stopped() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.ready_tasks WHERE suit_slug='doctor-suit'),'Doctor task became ready');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.workflow_runs WHERE suit_slug='doctor-suit'),'Doctor workflow/claim history exists');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.executions e JOIN control.tasks t USING(task_id) WHERE t.suit_slug='doctor-suit'),'Doctor execution history exists');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.publication_preexecution_authorizations a JOIN control.tasks t USING(task_id) WHERE t.suit_slug='doctor-suit'),'Doctor publication authorization exists');
 PERFORM pg_temp.doctor_assert(NOT EXISTS(SELECT 1 FROM control.tasks WHERE suit_slug='doctor-suit' AND (status<>'planned' OR engine_stage<>'pending')),'Doctor execution state changed');
END $$;
SELECT pg_temp.doctor_assert_stopped();
