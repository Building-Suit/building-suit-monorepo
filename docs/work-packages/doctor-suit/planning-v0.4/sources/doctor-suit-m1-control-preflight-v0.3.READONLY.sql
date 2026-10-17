-- Doctor Suit / M1 — CONTROL DATABASE READ-ONLY PREFLIGHT (v0.3)
-- Prepared 2026-10-16. SAFE TO RUN ON THE INTENDED CONTROL DATABASE.
-- No tasks, registrations, approvals, decisions, grants or workflows are changed.
-- Do NOT run the older doctor-suit-m1-tasks-v0.2.DRAFT.sql as an importer.
-- Output: exactly one JSON report in the final SELECT; copy that JSON for review.
-- This script deliberately checks for missing control objects before reading them.
-- SQL only, compatible with a standard PostgreSQL query editor (no psql macros).

BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL search_path = pg_catalog;

DO $doctor_suit_preflight$
DECLARE
  report jsonb := '{}'::jsonb;
  item jsonb;
  present_objects jsonb;
  missing_columns jsonb;
  function_defs jsonb;
  view_def text;
BEGIN
  -- These facts do not depend on any control-plane schema.
  report := jsonb_build_object(
    'report_version', 'doctor-suit-m1-preflight-v0.3',
    'database_name', current_database(),
    'server_version', current_setting('server_version'),
    'transaction_read_only', current_setting('transaction_read_only'),
    'control_schema_exists', EXISTS(
      SELECT 1 FROM pg_namespace WHERE nspname = 'control'
    ),
    'safe_to_import', false,
    'import_or_activation_performed', false
  );

  SELECT coalesce(jsonb_agg(jsonb_build_object('name', x.name, 'exists',
    to_regclass(x.name) IS NOT NULL) ORDER BY x.name), '[]'::jsonb)
  INTO present_objects
  FROM (VALUES
    ('control.projects'), ('control.workstreams'), ('control.suits'),
    ('control.tasks'), ('control.requirements'), ('control.decisions'),
    ('control.task_requirements'), ('control.task_dependencies'),
    ('control.task_decisions'), ('control.task_events'),
    ('control.workflow_runs'), ('control.executions'),
    ('control.ready_tasks'), ('control.publication_readiness_contracts'),
    ('control.task_admission_generations')
  ) AS x(name);
  report := report || jsonb_build_object('control_objects', present_objects);

  -- Inventory *required* columns; do not disclose arbitrary data or secrets.
  SELECT coalesce(jsonb_agg(x.relation_name || '.' || x.column_name
    ORDER BY x.relation_name, x.column_name), '[]'::jsonb)
  INTO missing_columns
  FROM (VALUES
    ('projects','project_id'),('projects','slug'),('projects','github_repository'),
    ('projects','default_model_profile'),('projects','active'),
    ('projects','allowed_publication_paths'),
    ('workstreams','project_id'),('workstreams','slug'),('workstreams','suit_slug'),
    ('workstreams','stack_key'),('workstreams','application_path'),
    ('workstreams','active'),('workstreams','model_profile'),
    ('workstreams','retry_policy_id'),('workstreams','verification_config'),
    ('suits','slug'),('suits','app_path'),('suits','stack_key'),('suits','status'),
    ('tasks','task_id'),('tasks','suit_slug'),('tasks','project_id'),
    ('tasks','workstream_slug'),('tasks','sequence'),('tasks','status'),
    ('tasks','engine_stage'),('tasks','metadata'),('tasks','verification_plan'),
    ('requirements','suit_slug'),('requirements','requirement_id'),
    ('decisions','suit_slug'),('decisions','decision_id'),('decisions','status'),
    ('task_dependencies','task_id'),('task_dependencies','depends_on_task_id'),
    ('task_requirements','task_id'),('task_requirements','requirement_id'),
    ('task_decisions','task_id'),('task_decisions','decision_id'),
    ('workflow_runs','run_id'),('workflow_runs','suit_slug'),('workflow_runs','status'),
    ('executions','task_id'),('executions','status')
  ) AS x(relation_name,column_name)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace=n.oid
    JOIN pg_attribute a ON a.attrelid=c.oid
    WHERE n.nspname='control' AND c.relname=x.relation_name
      AND a.attname=x.column_name AND a.attnum>0 AND NOT a.attisdropped
  );
  report := report || jsonb_build_object('missing_required_columns', missing_columns);

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'signature', x.signature,
    'exists', to_regprocedure(x.signature) IS NOT NULL,
    'definition_md5', CASE WHEN to_regprocedure(x.signature) IS NOT NULL
      THEN md5(pg_get_functiondef(to_regprocedure(x.signature))) END
  ) ORDER BY x.signature), '[]'::jsonb)
  INTO function_defs
  FROM (VALUES
    ('control.generic_task_packet(text)'),
    ('control.refresh_publication_readiness_contract(text,text)'),
    ('control.resolved_retry_policy(text)')
  ) AS x(signature);
  report := report || jsonb_build_object('consumer_functions', function_defs);

  IF to_regclass('control.ready_tasks') IS NOT NULL THEN
    BEGIN
      SELECT md5(pg_get_viewdef(to_regclass('control.ready_tasks'), true))
      INTO view_def;
      report := report || jsonb_build_object('ready_tasks_view_md5', view_def);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('ready_tasks_view_error', SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;

  -- Product/workstream route discovery. Capture only non-sensitive routing fields.
  IF to_regclass('control.projects') IS NOT NULL
     AND to_regclass('control.workstreams') IS NOT NULL
     AND to_regclass('control.suits') IS NOT NULL THEN
    BEGIN
      EXECUTE $route_query$
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'project_slug', p.slug,
          'project_active', p.active,
          'github_repository', p.github_repository,
          'workstream_slug', w.slug,
          'workstream_active', w.active,
          'suit_slug', w.suit_slug,
          'stack_key', w.stack_key,
          'application_path', w.application_path,
          'suit_status', s.status,
          'suit_app_path', s.app_path,
          'effective_profile', coalesce(w.model_profile, p.default_model_profile),
          'retry_policy_source', CASE WHEN w.retry_policy_id IS NOT NULL
            THEN 'workstream' WHEN p.retry_policy_id IS NOT NULL THEN 'project' ELSE 'global' END,
          'registered_verification_commands',
            CASE WHEN jsonb_typeof(w.verification_config->'commands')='array'
              THEN jsonb_array_length(w.verification_config->'commands') ELSE 0 END
        ) ORDER BY p.slug,w.slug), '[]'::jsonb)
        FROM control.projects p
        JOIN control.workstreams w ON w.project_id=p.project_id
        LEFT JOIN control.suits s ON s.slug=w.suit_slug
        WHERE p.slug IN ('doctor-suit','clinic-suit')
          OR w.slug IN ('doctor-suit','clinic-suit')
          OR w.suit_slug IN ('doctor-suit','clinic-suit')
          OR w.application_path='apps/doctor-suit'
      $route_query$ INTO item;
      report := report || jsonb_build_object('matching_registered_routes', item);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('route_scan_error', SQLSTATE || ': ' || SQLERRM);
    END;
  ELSE
    report := report || jsonb_build_object('matching_registered_routes', null,
      'route_scan_note', 'control.projects, workstreams and suits must exist');
  END IF;

  IF to_regclass('control.tasks') IS NOT NULL THEN
    BEGIN
      EXECUTE $task_query$
        SELECT jsonb_build_object(
          'count', count(*),
          'status_counts', coalesce((SELECT jsonb_object_agg(x.status, x.n)
            FROM (SELECT status, count(*) n FROM control.tasks
              WHERE task_id LIKE 'DOS-M1-%'
                 OR suit_slug IN ('doctor-suit','clinic-suit')
                 OR suit_slug LIKE 'doctor-suit-%'
                 OR suit_slug LIKE 'clinic-suit-%'
              GROUP BY status) x),'{}'::jsonb),
          'task_samples', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.task_id)
            FROM (SELECT task_id,suit_slug,workstream_slug,status,engine_stage,
              metadata->>'handoff_manifest_sha256' AS handoff_hash
              FROM control.tasks
              WHERE task_id LIKE 'DOS-M1-%'
                 OR suit_slug IN ('doctor-suit','clinic-suit')
                 OR suit_slug LIKE 'doctor-suit-%'
                 OR suit_slug LIKE 'clinic-suit-%'
              ORDER BY task_id LIMIT 40) s),'[]'::jsonb)
        )
        FROM control.tasks
        WHERE task_id LIKE 'DOS-M1-%'
           OR suit_slug IN ('doctor-suit','clinic-suit')
           OR suit_slug LIKE 'doctor-suit-%'
           OR suit_slug LIKE 'clinic-suit-%'
      $task_query$ INTO item;
      report := report || jsonb_build_object('existing_clinic_doctor_tasks', item);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('task_scan_error', SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;

  IF to_regclass('control.requirements') IS NOT NULL THEN
    BEGIN
      EXECUTE $requirements_query$
        SELECT jsonb_build_object('count',count(*),
          'ids', coalesce((SELECT jsonb_agg(requirement_id ORDER BY requirement_id)
            FROM (SELECT requirement_id FROM control.requirements
              WHERE requirement_id LIKE 'DOS-M1-%'
              OR suit_slug IN ('doctor-suit','clinic-suit')
              OR suit_slug LIKE 'doctor-suit-%'
              OR suit_slug LIKE 'clinic-suit-%'
              ORDER BY requirement_id LIMIT 40) subset),'[]'::jsonb))
        FROM control.requirements
        WHERE requirement_id LIKE 'DOS-M1-%'
          OR suit_slug IN ('doctor-suit','clinic-suit')
          OR suit_slug LIKE 'doctor-suit-%'
          OR suit_slug LIKE 'clinic-suit-%'
      $requirements_query$ INTO item;
      report := report || jsonb_build_object('existing_clinic_doctor_requirements', item);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('requirements_scan_error', SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;

  IF to_regclass('control.decisions') IS NOT NULL THEN
    BEGIN
      EXECUTE $decisions_query$
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'decision_id', decision_id,'suit_slug',suit_slug,'status',status)
          ORDER BY decision_id), '[]'::jsonb)
        FROM control.decisions
        WHERE decision_id LIKE 'DOS-M1-%'
          OR suit_slug IN ('doctor-suit','clinic-suit')
          OR suit_slug LIKE 'doctor-suit-%'
          OR suit_slug LIKE 'clinic-suit-%'
      $decisions_query$ INTO item;
      report := report || jsonb_build_object('existing_clinic_doctor_decisions', item);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('decisions_scan_error', SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;

  IF to_regclass('control.workflow_runs') IS NOT NULL THEN
    BEGIN
      EXECUTE $runs_query$
        SELECT jsonb_build_object('count', count(*),
          'running_count', count(*) FILTER (WHERE status IN ('running','resuming')))
        FROM control.workflow_runs
        WHERE suit_slug IN ('doctor-suit','clinic-suit')
          OR suit_slug LIKE 'doctor-suit-%'
          OR suit_slug LIKE 'clinic-suit-%'
      $runs_query$ INTO item;
      report := report || jsonb_build_object('existing_clinic_doctor_runs', item);
    EXCEPTION WHEN OTHERS THEN
      report := report || jsonb_build_object('runs_scan_error', SQLSTATE || ': ' || SQLERRM);
    END;
  END IF;

  -- Clear top-level next-action diagnosis. Never confuse completeness of this
  -- read-only snapshot with execution or import authorization.
  report := report || jsonb_build_object(
    'diagnosis', CASE
      WHEN (report->>'control_schema_exists')::boolean IS NOT TRUE
        THEN 'CONTROL_SCHEMA_NOT_FOUND_IN_SELECTED_DATABASE'
      WHEN jsonb_array_length(report->'missing_required_columns') > 0
        THEN 'CONTROL_SCHEMA_COLUMNS_DIFFER_FROM_SOURCE_CONTRACT'
      WHEN report ? 'route_scan_error'
        THEN 'ROUTING_SCHEMA_QUERY_FAILED'
      WHEN jsonb_typeof(report->'matching_registered_routes') <> 'array'
        THEN 'CONTROL_ROUTING_NOT_INSPECTABLE'
      WHEN jsonb_array_length(report->'matching_registered_routes') = 0
        THEN 'DOCTOR_SUIT_WORKSTREAM_NOT_REGISTERED'
      WHEN jsonb_array_length(report->'matching_registered_routes') > 1
        THEN 'AMBIGUOUS_DOCTOR_SUIT_ROUTING'
      WHEN report ? 'task_scan_error' OR report ? 'requirements_scan_error'
        OR report ? 'decisions_scan_error' OR report ? 'runs_scan_error'
        THEN 'EXISTING_HISTORY_QUERY_FAILED'
      ELSE 'SCHEMA_AND_ROUTE_EXIST_BUT_IMPORT_CONSUMER_AND_EXECUTION_HOLD_UNVERIFIED'
    END,
    'next_action', 'Share this JSON report for compatibility review. Do not execute the v0.2 draft import.'
  );

  -- Transaction-local configuration is not a persistent database write.
  -- Used to return one consolidated JSON value in a normal query-result table.
  PERFORM set_config('doctor_suit.m1_preflight_result', report::text, true);
END;
$doctor_suit_preflight$;

SELECT current_setting('doctor_suit.m1_preflight_result', true)::jsonb
  AS doctor_suit_m1_preflight_report;
ROLLBACK;
