import { fingerprint } from '../../runner/task-preflight.mjs'
export function executionPreflightFixture() {
  const identity = {
    database: 'control_test',
    user: 'control_runner',
    server_address: '127.0.0.1',
    server_port: 5432,
    server_version_num: '170000',
    control_schema: 'control',
    task_packet_contract: 'control.generic_task_packet(text)',
  }
  const identityFingerprint = fingerprint(identity)
  return {
    packet: {
      task: {
        task_id: 'CP-TEST-001',
        title: 'Ready task',
        description: 'Exercise deterministic readiness.',
        model_profile: 'standard',
        status: 'in_progress',
        acceptance_criteria: ['Preflight passes.'],
        verification_plan: ['control-plane-tests'],
      },
      suit: { slug: 'control-plane', status: 'active', stack_key: 'control-plane', app_path: 'tooling/control-plane' },
      project: {
        active: true,
        allowed_publication_paths: ['tooling/'],
      },
      workstream: {
        active: true,
        application_path: 'tooling/control-plane',
        concurrency_policy: { serialized: true },
        publication_config: {
          merge_authorized: false,
          deployment_authorized: false,
          hosted_database_changes_authorized: false,
          review_required_before_integration: true,
        },
        verification_config: {
          commands: [{
            name: 'control-plane-tests',
            program: 'node',
            args: ['--test', 'tooling/control-plane/tests/generic-control-plane.test.mjs'],
            required: true,
          }],
        },
      },
      dependencies: [{ task_id: 'CP-TEST-000', dependency_type: 'hard', status: 'complete' }],
      decisions: [{ id: 'CP-D01', blocking: true, status: 'approved' }],
      retry_policy: {
        policy_id: 'critical-five',
        max_attempts: 5,
        attempt_profiles: ['standard', 'standard', 'deep', 'deep', 'deep'],
      },
      publication_contract: {
        contract_id: 1,
        contract_version: 1,
        source: 'unit-fixture',
        required_paths: [],
        unresolved_scopes: [],
        contract_fingerprint: 'fixture',
        task_paths: [],
        source_paths: [],
        workstream_paths: ['tooling/control-plane/'],
        project_paths: ['tooling/'],
      },
      publication_authorizations: { ordinary: [], protected: [] },
      execution_admission: {
        ready: true,
        reason: 'admitted',
        publication_current: true,
        publication_authority_current: true,
        maintenance_requested: false,
        run_id: null,
        run_owned: false,
      },
    },
    runtime: {
      control_database: {
        identity,
        actual_fingerprint: identityFingerprint,
        expected_fingerprint: identityFingerprint,
      },
      repository: {
        root_valid: true,
        integration_sha: '1'.repeat(40),
        integration_commit_present: true,
        parent: { parent_branch: 'stg', parent_sha: '1'.repeat(40), parent_pr: null },
        parent_commit_present: true,
        parent_consistent: true,
        worktree_target: { status: 'ready', path: '/tmp/control-plane-cp-test-001' },
        dependencies_ready: true,
      },
      executables: { node: true, git: true, gh: true, psql: true, pnpm: true, codex: true },
      environment: { valid: true, missing: [] },
    },
    executions: [],
    serializationConflicts: [],
  }
}

