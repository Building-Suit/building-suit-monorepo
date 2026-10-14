BEGIN;
-- Preserve the legacy human gate. Dot's derived authority is accepted only
-- with exact guarded acceptance, executed mandatory checks and the frozen
-- ordinary-draft grant of the SAME bounded run. Completed receipts are replayable.
CREATE OR REPLACE FUNCTION control.publication_execution_is_eligible(p_task_id text, p_execution_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE((SELECT e.status='succeeded' OR (
 e.status='failed' AND t.status IN('passed','complete') AND v.status='passed'
 AND v.metadata->>'verifier_only_reacceptance'='true'
 AND v.metadata#>>'{verified_state,fingerprint}' ~ '^[0-9a-f]{64}$'
 AND a.event_type='verifier_reacceptance_authorized'
 AND (
  (a.source='human' AND v.metadata->>'preserved_execution'='true')
  OR (a.source='dot' AND v.metadata->>'preserved_failed_execution'='true'
   AND (a.payload->>'run_id') IS NOT NULL
   AND EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g
    JOIN control.workflow_runs run USING(run_id)
    WHERE g.run_id::text=a.payload->>'run_id' AND g.project_id=t.project_id AND g.workstream_slug=t.workstream_slug
    AND g.max_tasks=run.max_tasks AND g.repair_id=run.admitted_repair_id AND g.controller_fingerprint=run.controller_fingerprint)
   AND (
    ((control.current_run_publication_authority(e.task_id)->>'authorized')::boolean
     AND control.current_run_publication_authority(e.task_id)->>'run_id'=a.payload->>'run_id')
    OR (t.status='complete' AND EXISTS(SELECT 1 FROM control.pull_requests published
     JOIN control.task_events completed ON completed.task_id=published.task_id AND completed.event_type='publication_completed'
     WHERE published.task_id=e.task_id AND published.head_sha=e.commit_sha
      AND completed.payload->>'verification_run_id'=v.verification_run_id::text
      AND completed.payload->>'head_sha'=e.commit_sha))
   )
   AND jsonb_typeof(a.payload->'required_checks')='array' AND jsonb_array_length(a.payload->'required_checks')>0
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.payload->'required_checks') required WHERE NOT EXISTS(
    SELECT 1 FROM control.verification_results result WHERE result.verification_run_id=v.verification_run_id
    AND result.check_name=required AND result.status='pass' AND coalesce(result.metadata->>'required','true')<>'false'))
  )
 )
 AND a.payload->>'execution_id'=e.execution_id::text AND a.payload->>'attempt'=e.attempt::text
 AND EXISTS(SELECT 1 FROM control.task_events accepted WHERE accepted.task_id=e.task_id AND accepted.event_type='verifier_only_reaccepted'
   AND accepted.payload->>'verification_run_id'=v.verification_run_id::text AND accepted.payload->>'execution_id'=e.execution_id::text
   AND accepted.payload->>'approval_event_id'=a.event_id::text)
 AND EXISTS(SELECT 1 FROM control.verification_results r WHERE r.verification_run_id=v.verification_run_id)
 AND NOT EXISTS(SELECT 1 FROM control.verification_results r WHERE r.verification_run_id=v.verification_run_id
   AND (r.status NOT IN('pass','skipped') OR (coalesce(r.metadata->>'required','true')<>'false' AND r.status<>'pass')))
 ) FROM control.executions e JOIN control.tasks t USING(task_id)
 LEFT JOIN LATERAL(SELECT * FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1) v ON true
 LEFT JOIN control.task_events a ON a.event_id::text=v.metadata->>'approval_event_id' AND a.task_id=e.task_id
 WHERE e.task_id=p_task_id AND e.execution_id=p_execution_id
 AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1)),false);
$function$;


-- Keep the normal publication transition as the sole owner of task completion.
CREATE OR REPLACE FUNCTION control.complete_publication(p_task_id text, p_repository text, p_pr_number integer, p_head_branch text, p_base_branch text, p_url text, p_head_sha text, p_is_draft boolean, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  previous_status text;
  latest_execution_id bigint;
  latest_execution_status text;
  latest_verification_run_id bigint;
BEGIN

  SELECT status
  INTO previous_status
  FROM control.tasks
  WHERE task_id = p_task_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Unknown task: %',
      p_task_id;
  END IF;


  IF previous_status NOT IN (
    'passed',
    'complete'
  ) THEN
    RAISE EXCEPTION
      'Task % cannot be published from status %',
      p_task_id,
      previous_status;
  END IF;


  SELECT
    execution_id,
    status
  INTO
    latest_execution_id,
    latest_execution_status
  FROM control.executions
  WHERE task_id = p_task_id
  ORDER BY attempt DESC
  LIMIT 1;


  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Task % has no execution',
      p_task_id;
  END IF;


  IF NOT control.publication_execution_is_eligible(p_task_id,latest_execution_id) THEN
    RAISE EXCEPTION 'Latest execution % lacks successful implementation or exact guarded reacceptance',latest_execution_id;
  END IF;


  SELECT verification_run_id
  INTO latest_verification_run_id
  FROM control.verification_runs
  WHERE execution_id = latest_execution_id
  ORDER BY verification_run_id DESC
  LIMIT 1;


  IF latest_verification_run_id IS NULL THEN
    RAISE EXCEPTION
      'Task % has no verification evidence',
      p_task_id;
  END IF;


  IF EXISTS (
    SELECT 1
    FROM control.verification_results
    WHERE verification_run_id =
      latest_verification_run_id
      AND status IN (
        'fail',
        'not_run',
        'queued',
        'running'
      )
  ) THEN
    RAISE EXCEPTION
      'Task % has failing, pending, or unrun verification',
      p_task_id;
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM control.verification_results
    WHERE verification_run_id =
      latest_verification_run_id
  ) THEN
    RAISE EXCEPTION
      'Task % latest verification run has no evidence',
      p_task_id;
  END IF;


  IF NOT EXISTS (
    SELECT 1
    FROM control.verification_runs
    WHERE verification_run_id =
      latest_verification_run_id
      AND status = 'passed'
  ) THEN
    RAISE EXCEPTION
      'Task % latest verification run is not passed',
      p_task_id;
  END IF;


  UPDATE control.executions
  SET commit_sha = p_head_sha
  WHERE execution_id =
    latest_execution_id;


  INSERT INTO control.pull_requests (
    task_id,
    repository,
    pr_number,
    head_branch,
    base_branch,
    state,
    is_draft,
    url,
    head_sha,
    metadata
  )
  VALUES (
    p_task_id,
    p_repository,
    p_pr_number,
    p_head_branch,
    p_base_branch,
    'open',
    p_is_draft,
    p_url,
    p_head_sha,
    COALESCE(
      p_metadata,
      '{}'::jsonb
    )
  )
  ON CONFLICT (
    repository,
    pr_number
  )
  DO UPDATE SET
    task_id =
      EXCLUDED.task_id,
    head_branch =
      EXCLUDED.head_branch,
    base_branch =
      EXCLUDED.base_branch,
    state =
      'open',
    is_draft =
      EXCLUDED.is_draft,
    url =
      EXCLUDED.url,
    head_sha =
      EXCLUDED.head_sha,
    metadata =
      EXCLUDED.metadata;


  IF previous_status = 'passed' THEN

    UPDATE control.tasks
    SET
      status = 'complete',
      engine_stage = 'complete'
    WHERE task_id = p_task_id;


    INSERT INTO control.task_events (
      task_id,
      event_type,
      from_status,
      to_status,
      source,
      payload
    )
    VALUES (
      p_task_id,
      'publication_completed',
      'passed',
      'complete',
      'runner',
      jsonb_build_object(
        'repository',
          p_repository,
        'pr_number',
          p_pr_number,
        'head_branch',
          p_head_branch,
        'base_branch',
          p_base_branch,
        'head_sha',
          p_head_sha,
        'is_draft',
          p_is_draft,
        'verification_run_id',
          latest_verification_run_id
      )
    );

  END IF;


  RETURN jsonb_build_object(
    'published', true,
    'task_id', p_task_id,
    'task_status', 'complete',
    'execution_id', latest_execution_id,
    'verification_run_id', latest_verification_run_id,
    'repository', p_repository,
    'pr_number', p_pr_number,
    'head_branch', p_head_branch,
    'base_branch', p_base_branch,
    'head_sha', p_head_sha,
    'url', p_url
  );

END;
$function$;


GRANT EXECUTE ON FUNCTION control.publication_execution_is_eligible(text,bigint) TO bs_control_app;
COMMIT;
