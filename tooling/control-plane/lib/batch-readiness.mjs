import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { resolveVerificationPlan } from '../runner/verification-mode.mjs'
import { mergeVerificationConfig, validateLocalSupabaseLifecycle } from './workstream-readiness.mjs'

export const BATCH_EVIDENCE_SHA256 = 'e2f0f02d37eea920dbe589c86888d287dce7a4a84410b8764346e6f74c7d6c5e'
export const BATCH_REPAIR_ID = 'CP-BATCH-READY-001'

export const RECONCILED_BATCH = Object.freeze({
  shared: Object.freeze([
    'BS-UI-ZN-DATA-001',
    'BS-UI-ZN-PATTERNS-001',
    'BS-UI-ZN-LEDGER-001',
    'BS-UI-ZN-SHOP-001',
    'BS-UI-ZN-OTHER-SUITS-001',
    'BS-UI-ZN-GENERATOR-001',
    'BS-UI-ZN-BROWSER-001',
    'BS-UI-ZN-FINAL-001',
  ]),
  'shop-suit': Object.freeze(['SS-SA-EVIDENCE-001', 'SS-SA-CUSTOM-OFFER-001']),
  'super-admin-suit': Object.freeze(['SAS-M1-CONFIG-001', 'SAS-M1-AUTH-001']),
})

const RECONCILED_TASK_IDS = new Set(Object.values(RECONCILED_BATCH).flat())

export const EXPECTED_RUNS = Object.freeze({
  shared: Object.freeze({ run_id: '4f3b1b7f-0c82-4667-a420-563a43953326', stored_max: 9, requested_max: 9 }),
  'shop-suit': Object.freeze({ run_id: 'dc3910cd-48be-42b4-9569-4c769e633a44', stored_max: 3, requested_max: 2 }),
  'super-admin-suit': Object.freeze({ run_id: 'e362bc39-996c-451c-8fac-9a47df92715c', stored_max: 2, requested_max: 2 }),
})

export function planActiveRunStart(run, requestedMax) {
  if (!run || run.status !== 'running') return { action:'start_new_run',requested_max:requestedMax }
  if (run.max_tasks === requestedMax) return { action:'reuse_active_run',run_id:run.run_id,max_tasks:run.max_tasks }
  return {
    action:'explicit_reconciliation_required',
    run_id:run.run_id,
    stored_max:run.max_tasks,
    requested_max:requestedMax,
    completed_tasks:run.completed_tasks,
    preserve_run_id:true,
  }
}

export function applyCompletionCredit({ run, taskId, idempotencyKey, credits = [] }) {
  const existing = credits.find(credit => credit.idempotency_key === idempotencyKey)
  if (existing) {
    if (existing.run_id !== run.run_id || existing.task_id !== taskId) {
      return { applied:false,reason:'idempotency_conflict' }
    }
    return { applied:false,idempotent:true,completed_tasks:run.completed_tasks }
  }
  if (run.status !== 'running' || run.current_task_id !== taskId) return { applied:false,reason:'task_not_attributed_to_run' }
  if (run.completed_tasks >= run.max_tasks) return { applied:false,reason:'run_budget_exhausted' }
  return {
    applied:true,
    idempotent:false,
    completed_tasks:run.completed_tasks+1,
    credit:{ run_id:run.run_id,task_id:taskId,idempotency_key:idempotencyKey },
  }
}

export function evaluateSafeResume({ run, controllerProof, admissions = [] }) {
  const reasons = []
  if (!run?.maintenance_requested) reasons.push('maintenance_not_requested')
  if (!controllerProof?.available || !controllerProof?.fingerprint || !controllerProof?.protocol) reasons.push('deployed_controller_proof_missing')
  if (controllerProof?.fingerprint === controllerProof?.protocol) reasons.push('controller_protocol_is_not_content_proof')
  if (run?.controller_protocol !== controllerProof?.protocol) reasons.push('controller_protocol_mismatch')
  if (run?.controller_fingerprint !== controllerProof?.fingerprint) reasons.push('controller_fingerprint_mismatch')
  if (admissions.length === 0) reasons.push('admission_set_missing')
  if (admissions.some(item => item.blockers?.length || item.current !== true)) reasons.push('admission_stale_or_blocked')
  return { resumable:reasons.length===0,reasons }
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sortedUnique(values) {
  return [...new Set(values.filter(Boolean))].sort()
}

export function canonicalVerificationConfig(existing = {}, patch = {}) {
  const merged = mergeVerificationConfig(existing, patch)
  return {
    ...merged,
    commands:[...(merged.commands ?? [])].sort((left, right) => String(left.name).localeCompare(String(right.name))),
  }
}

function workspacePackages(repositoryRoot) {
  const packages = new Map()
  for (const parent of ['apps', 'packages']) {
    const parentPath = path.join(repositoryRoot, parent)
    if (!existsSync(parentPath)) continue
    for (const entry of readdirSync(parentPath, { withFileTypes:true })) {
      if (!entry.isDirectory()) continue
      const packagePath = path.join(parentPath, entry.name)
      const manifestPath = path.join(packagePath, 'package.json')
      if (!existsSync(manifestPath)) continue
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        if (manifest.name) packages.set(manifest.name, { path:path.relative(repositoryRoot, packagePath), manifest })
      }
      catch {
        continue
      }
    }
  }
  return packages
}

function commandPackage(command = {}, repositoryRoot) {
  if (command.program !== 'pnpm' || command.args?.[0] !== '--filter') return null
  const name = String(command.args?.[1] ?? '')
  return workspacePackages(repositoryRoot).get(name) ?? { name, path:null, manifest:null }
}

function commandPathCandidates(command = {}, repositoryRoot) {
  const packageFilter = commandPackage(command, repositoryRoot)?.path ?? ''
  const cwd = command.cwd ?? packageFilter
  return (command.args ?? [])
    .filter(argument => typeof argument === 'string' && /[./]/.test(argument) && !argument.startsWith('-'))
    .filter(argument => /\.(?:mjs|cjs|js|ts|sql|json)$/.test(argument))
    .map(argument => path.join(cwd, argument))
}

const discoveryCache = new Map()

function playwrightDiscovery(command, repositoryRoot, packagePath, spec) {
  const cacheKey = JSON.stringify([repositoryRoot, command.program, command.args])
  if (discoveryCache.has(cacheKey)) return discoveryCache.get(cacheKey)
  const args = [...(command.args ?? [])]
  if (!args.includes('--list')) args.push('--list')
  const result = spawnSync(command.program, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, CI:'1' },
  })
  const normalizedSpec = String(spec ?? '').replaceAll('\\', '/')
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.replaceAll('\\', '/')
  const discovered = result.status === 0 && normalizedSpec && (
    output.includes(normalizedSpec) || output.includes(path.basename(normalizedSpec))
  )
  const discovery = {
    command: [command.program, ...args],
    exit_code: result.status,
    signal: result.signal,
    discovery_succeeded: discovered,
    failure: discovered ? null : (result.error?.code ?? 'playwright_list_did_not_discover_declared_spec'),
    application_path: packagePath,
  }
  discoveryCache.set(cacheKey, discovery)
  return discovery
}

function commandAvailability(command, repositoryRoot) {
  const packageEntry = commandPackage(command, repositoryRoot)
  const packageFilter = packageEntry?.path ?? ''
  const paths = commandPathCandidates(command, repositoryRoot)
  const cwdMissing = Boolean(repositoryRoot && command.cwd && !existsSync(path.join(repositoryRoot, command.cwd)))
  const missing_paths = repositoryRoot
    ? paths.filter(candidate => !existsSync(path.join(repositoryRoot, candidate)))
    : paths
  let rootScriptExists = true
  if (repositoryRoot && command.program === 'pnpm' && packageEntry == null
    && command.args?.[0] && !['exec', '--filter'].includes(command.args[0])) {
    try {
      const rootManifest = JSON.parse(readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'))
      rootScriptExists = Boolean(rootManifest.scripts?.[command.args[0]])
    }
    catch {
      rootScriptExists = false
    }
  }
  let playwright = null
  if (command.capabilities?.includes('browser')) {
    const spec = command.args?.find(argument => /\.spec\.(?:ts|js|mjs)$/.test(argument)) ?? null
    const discovery = repositoryRoot && packageFilter && spec
      ? playwrightDiscovery(command, repositoryRoot, packageFilter, spec)
      : { discovery_succeeded:false, failure:'playwright_target_or_parent_missing' }
    playwright = {
      application_path:packageFilter || null,
      spec,
      spec_exists:Boolean(repositoryRoot && spec && existsSync(path.join(repositoryRoot,packageFilter,spec))),
      test_match_proven:discovery.discovery_succeeded,
      ...discovery,
      workers_one:command.args?.includes('--workers=1') === true,
      retries_zero:command.args?.includes('--retries=0') === true,
    }
  }
  return {
    name: command.name,
    safe_argv: Boolean(command.program && Array.isArray(command.args ?? [])),
    declared_paths: paths,
    missing_paths,
    cwd_missing: cwdMissing,
    package_exists: packageEntry == null || packageEntry.manifest != null,
    script_exists: packageEntry?.manifest
      ? Boolean(packageEntry.manifest.scripts?.[command.args?.[2]]) || command.args?.[2] === 'exec'
      : rootScriptExists,
    playwright,
    available: Boolean(repositoryRoot) && !cwdMissing && missing_paths.length === 0
      && (packageEntry == null || packageEntry.manifest != null)
      && (packageEntry == null || command.args?.[2] === 'exec' || Boolean(packageEntry.manifest?.scripts?.[command.args?.[2]]))
      && rootScriptExists
      && (!playwright || (playwright.spec_exists && playwright.test_match_proven && playwright.workers_one && playwright.retries_zero)),
  }
}

function currentReview(evidence, taskId) {
  return (evidence.readiness_review ?? []).find(item => item.task_id === taskId) ?? {}
}

function workflow(evidence, slug) {
  return (evidence.workstreams ?? []).find(item => item.slug === slug) ?? {}
}

function activeRun(evidence, slug) {
  return (evidence.recent_runs ?? []).find(item => item.workstream_slug === slug && item.status === 'running') ?? null
}

function taskAdmission(task, evidence, registry, repositoryRoot) {
  const packet = task.packet ?? {}
  const review = currentReview(evidence, task.task_id)
  const workstream = workflow(evidence, task.workstream_slug)
  const repairConfig = registry?.workstreams?.[task.workstream_slug]?.verification_config ?? {}
  const verificationConfig = canonicalVerificationConfig(
    mergeVerificationConfig(evidence.project?.verification_config, workstream.verification_config),
    repairConfig,
  )
  const parentSnapshot = evidence.task_parent_snapshots?.[task.task_id] ?? null
  const taskRepositoryRoot = parentSnapshot?.verified === true && parentSnapshot.repository_root
    ? parentSnapshot.repository_root
    : repositoryRoot
  const plan = resolveVerificationPlan({
    entries: packet.task?.verification_plan ?? [],
    configuredCommands: verificationConfig.commands ?? [],
    legacyMappings: verificationConfig.legacy_plan_mappings ?? {},
    phase: 'pre_implementation',
  })
  const commands = sortedUnique(plan.checks.map(check => check.name))
    .map(name => plan.checks.find(check => check.name === name))
  const command_availability = commands.map(command => commandAvailability(command, taskRepositoryRoot))
  const missing_commands = command_availability.filter(item => !item.available)
  const blocking_decisions = (packet.decisions ?? [])
    .filter(decision => decision.blocking && decision.status !== 'approved')
    .map(decision => decision.id)
  const hard_dependencies = (packet.dependencies ?? [])
    .filter(dependency => dependency.dependency_type === 'hard' && dependency.status !== 'complete')
    .map(dependency => ({ task_id: dependency.task_id, status: dependency.status }))
  const pending_internal_dependencies = hard_dependencies
    .filter(dependency => RECONCILED_TASK_IDS.has(dependency.task_id))
  const incomplete_external_dependencies = hard_dependencies
    .filter(dependency => !RECONCILED_TASK_IDS.has(dependency.task_id))
  const runOrder = RECONCILED_BATCH[task.workstream_slug] ?? []
  const taskOrdinal = runOrder.indexOf(task.task_id)
  const pending_run_predecessors = taskOrdinal < 1 ? [] : runOrder.slice(0,taskOrdinal)
    .filter(taskId => evidence.tasks.find(candidate => candidate.task_id === taskId)?.packet?.task?.status !== 'complete')
  const inRelease = (RECONCILED_BATCH[task.workstream_slug] ?? []).includes(task.task_id)
  const publication = review.publication_current ?? {}
  const databaseLifecycle = verificationConfig.database
    ? validateLocalSupabaseLifecycle(verificationConfig.database)
    : { valid:false,reason:'local_database_contract_not_registered',commands:[] }
  const planText = JSON.stringify(packet.task?.verification_plan ?? []).toLowerCase()
  const databaseRequired = /database|supabase|sql|rpc|pgtap|db:test/.test(planText)
  const browserChecks = commands.filter(command => command.capabilities?.includes('browser'))
  const blockers = []
  if (publication.contract_boundary_mismatch) blockers.push('publication_contract_refresh_required')
  if ((packet.publication_contract?.unresolved_scopes ?? []).length > 0) blockers.push('unresolved_publication_scopes')
  if ((review.publication_after_boundary_alignment_PREVIEW_ONLY?.exact_authorization_required ?? []).length > 0
    || (review.publication_after_boundary_alignment_PREVIEW_ONLY?.protected_authorization_required ?? []).length > 0) {
    blockers.push('post_refresh_authorization_review_required')
  }
  if (plan.unenforced.length > 0) blockers.push('verification_plan_mapping_required')
  if (plan.blockers.length > 0) blockers.push('verification_obligation_blocked')
  if (!parentSnapshot?.verified) blockers.push('task_parent_context_unverified')
  if (missing_commands.length > 0) blockers.push('verification_command_or_fixture_missing')
  if (databaseRequired && !databaseLifecycle.valid) blockers.push('database_lifecycle_missing_or_invalid')
  if (blocking_decisions.length > 0) blockers.push('blocking_decision_open')
  if (incomplete_external_dependencies.length > 0) blockers.push('incomplete_external_hard_dependency')

  return {
    task_id: task.task_id,
    workstream: task.workstream_slug,
    status: packet.task?.status ?? null,
    selected_for_reconciled_batch: inRelease,
    batch_admission: {
      dependency_admissible: incomplete_external_dependencies.length === 0,
      pending_internal_dependencies,
      incomplete_external_dependencies,
      pending_run_predecessors,
      execution_ready_now: pending_internal_dependencies.length === 0
        && incomplete_external_dependencies.length === 0
        && pending_run_predecessors.length === 0
        && blocking_decisions.length === 0,
      semantics: pending_internal_dependencies.length > 0 || pending_run_predecessors.length > 0
        ? 'admissible_waiting_for_predecessor' : 'no_dependency_wait',
    },
    execution_count: (task.executions ?? []).length,
    verification_run_count: (task.verification_runs ?? []).length,
    publication: {
      captured_contract_id: packet.publication_contract?.contract_id ?? null,
      captured_contract_fingerprint: packet.publication_contract?.contract_fingerprint ?? null,
      captured_boundary_mismatch: publication.contract_boundary_mismatch === true,
      captured_unresolved_scopes: packet.publication_contract?.unresolved_scopes ?? [],
      refresh_required: true,
      preview_used_as_authority: false,
      exact_authorization_required_after_preview: review.publication_after_boundary_alignment_PREVIEW_ONLY?.exact_authorization_required ?? [],
      protected_authorization_required_after_preview: review.publication_after_boundary_alignment_PREVIEW_ONLY?.protected_authorization_required ?? [],
      captured_authorizations: packet.publication_authorizations ?? { ordinary:[],protected:[] },
    },
    verification: {
      supplied_entry_count: (packet.task?.verification_plan ?? []).length,
      resolved_commands: commands.map(command => command.name),
      blockers: plan.blockers,
      deferred_product_outputs: plan.deferred,
      unmapped_entries: plan.unenforced,
      command_availability,
      all_required: plan.checks.every(check => check.required !== false),
    },
    repository_parent: parentSnapshot ?? {
      verified:false,
      fallback_repository_root_used_for_diagnostics:Boolean(repositoryRoot),
    },
    database: {
      required: databaseRequired,
      lifecycle: databaseLifecycle,
      registered_database_commands: commands.filter(command => command.capabilities?.includes('database')).map(command => command.name),
      shop_database_runner_proves_storage_http: false,
    },
    browser: {
      required: /browser|playwright|e2e/.test(planText),
      explicit_targets: browserChecks.map(command => ({ name:command.name,program:command.program,args:command.args })),
      inferred_from_application_path: browserChecks.length === 0,
    },
    decisions: packet.decisions ?? [],
    dependencies: packet.dependencies ?? [],
    unsatisfied_hard_dependencies: hard_dependencies,
    blocking_decisions,
    blockers: sortedUnique(blockers),
    candidate_ready: blockers.length === 0,
  }
}

export function validateBatchEvidence(evidence, rawEvidence) {
  const errors = []
  const digest = rawEvidence == null ? null : sha256(rawEvidence)
  if (digest !== BATCH_EVIDENCE_SHA256) errors.push('evidence_sha256_mismatch')
  if (evidence?.schema_version !== 'building-suit-batch-evidence-v1') errors.push('unsupported_evidence_schema')
  if (evidence?.transaction_read_only !== 'on') errors.push('evidence_not_captured_read_only')
  if (evidence?.release_authorized_by_this_report !== false) errors.push('evidence_improperly_authorizes_release')
  if ((evidence?.tasks ?? []).length !== 36) errors.push('captured_candidate_count_mismatch')
  for (const [slug, expected] of Object.entries(EXPECTED_RUNS)) {
    const run = activeRun(evidence, slug)
    if (!run || run.run_id !== expected.run_id) errors.push(`active_run_identity_mismatch:${slug}`)
  }
  return { valid: errors.length === 0, digest, errors }
}

export function validateCurrentStateSnapshot(snapshot, evidence) {
  const errors = []
  if (!snapshot) return { valid:false,errors:['current_state_snapshot_missing'] }
  if (snapshot.schema_version !== 'building-suit-batch-current-state-v1') errors.push('unsupported_current_state_schema')
  if (snapshot.captured_read_only !== true) errors.push('current_state_not_captured_read_only')
  const taskIds = new Set((evidence?.tasks ?? []).map(task => task.task_id))
  if (!Array.isArray(snapshot.tasks) || snapshot.tasks.some(task => !taskIds.has(task.task_id))) {
    errors.push('current_state_task_identity_mismatch')
  }
  for (const [slug, expected] of Object.entries(EXPECTED_RUNS)) {
    const run = snapshot.runs?.find(item => item.workstream_slug === slug)
    if (!run || run.run_id !== expected.run_id) errors.push(`current_state_run_identity_mismatch:${slug}`)
  }
  return { valid:errors.length === 0,errors,digest:snapshot.digest ?? null }
}

export function buildBatchAdmissionReport({ evidence, rawEvidence, registry = {}, repositoryRoot = null }) {
  const validation = validateBatchEvidence(evidence, rawEvidence)
  const currentState = validateCurrentStateSnapshot(evidence.current_state_snapshot, evidence)
  const candidates = (evidence.tasks ?? []).map(task => taskAdmission(task, evidence, registry, repositoryRoot))
  const runs = Object.fromEntries(Object.entries(EXPECTED_RUNS).map(([slug, expected]) => {
    const current = activeRun(evidence, slug)
    const startPlan = planActiveRunStart(current,expected.requested_max)
    const mismatch = startPlan.action === 'explicit_reconciliation_required'
    return [slug, {
      ...expected,
      captured_status: current?.status ?? null,
      captured_completed_tasks: current?.completed_tasks ?? null,
      captured_current_task_id: current?.current_task_id ?? null,
      captured_stop_requested: current?.stop_requested ?? null,
      budget_reconciliation_required: mismatch,
      reconciliation: mismatch ? {
        ...startPlan,
        action: 'explicit_in_place_budget_reconciliation',
        preserve_run_id: true,
        proposed_max_tasks: expected.requested_max,
        guessed_historical_credit: false,
      } : null,
    }]
  }))
  const selected = candidates.filter(candidate => candidate.selected_for_reconciled_batch)
  const controllerAvailable = evidence.n8n_controller_export?.available === true
  const registryTransition = Object.fromEntries(Object.entries(registry.workstreams ?? {}).map(([slug, entry]) => {
    const existing = workflow(evidence, slug).verification_config ?? {}
    const resulting = canonicalVerificationConfig(existing, entry.verification_config ?? {})
    return [slug, {
      existing,
      resulting,
      existing_fingerprint:sha256(JSON.stringify(existing)),
      resulting_fingerprint:sha256(JSON.stringify(resulting)),
      preserves_unrelated_keys:Object.keys(existing).every(key =>
        ['commands','legacy_plan_mappings'].includes(key)
        || Object.hasOwn(entry.verification_config ?? {}, key)
        || resulting[key] === existing[key],
      ),
    }]
  }))
  const releaseBlockers = sortedUnique([
    ...(!validation.valid ? validation.errors : []),
    ...(!currentState.valid ? currentState.errors : []),
    ...selected.flatMap(candidate => candidate.blockers.map(blocker => `${candidate.task_id}:${blocker}`)),
    ...(!controllerAvailable ? ['deployed_controller_export_unavailable'] : []),
    ...(Object.values(runs).some(run => run.budget_reconciliation_required) ? ['run_budget_reconciliation_required'] : []),
  ])
  const held = candidates.find(candidate => candidate.task_id === 'BS-SA-SHELL-001')
  const historicalTask = evidence.task_history_index?.['SS-SA-BRIDGE-001'] ?? evidence.task_history_index?.find?.(item => item.task_id === 'SS-SA-BRIDGE-001') ?? null
  const historicalEvents = (evidence.recent_task_events ?? []).filter(event => event.task_id === 'SS-SA-BRIDGE-001')
  const successfulExecution = historicalEvents.find(event => event.payload?.execution_id === 258 && event.payload?.execution_status === 'succeeded')
  const successfulVerification = historicalEvents.find(event => event.payload?.verification_run_id === 267 && event.event_type === 'verification_finished')
  const publication = historicalEvents.find(event => event.payload?.pr_number === 191 && event.event_type === 'publication_completed')

  return {
    schema_version: 'control-plane-batch-admission-v2',
    repair_id: BATCH_REPAIR_ID,
    non_mutating: true,
    evidence: validation,
    current_state: currentState,
    candidate_count: candidates.length,
    candidates,
    current_claims: candidates.filter(candidate => candidate.status === 'in_progress').map(candidate => ({
      task_id:candidate.task_id,
      workstream:candidate.workstream,
      execution_count:candidate.execution_count,
      verification_run_count:candidate.verification_run_count,
    })),
    reconciled_release_set: RECONCILED_BATCH,
    selected_candidate_count: selected.length,
    run_reconciliation: runs,
    registry_transition: registryTransition,
    controller_compatibility: {
      deployed_export_available: controllerAvailable,
      release_blocked_without_export: true,
      captured_reason: evidence.n8n_controller_export?.reason ?? null,
    },
    overlap_and_serialization: Object.fromEntries((evidence.workstreams ?? []).map(item => [item.slug,{
      serialized:item.concurrency_policy?.serialized !== false,
      active_claims:candidates.filter(candidate => candidate.workstream===item.slug && candidate.status==='in_progress').map(candidate => candidate.task_id),
    }])),
    preserved_holds: {
      'BS-SA-SHELL-001': {
        selected: false,
        blocking_decisions: held?.blocking_decisions ?? [],
        unchanged: (held?.blocking_decisions ?? []).includes('BS-SA-D001'),
      },
    },
    preserved_history: {
      task_id: 'SS-SA-BRIDGE-001',
      status: historicalTask?.status ?? null,
      execution_id: successfulExecution?.payload?.execution_id ?? null,
      verification_run_id: successfulVerification?.payload?.verification_run_id ?? null,
      pull_request_id: publication?.payload?.pr_number ?? null,
      evidence_complete: historicalTask?.status === 'complete' && Boolean(successfulExecution && successfulVerification && publication),
      recreate_or_retry: false,
    },
    release: {
      authorized: false,
      status: releaseBlockers.length === 0 ? 'READY_FOR_INDEPENDENT_REVIEW' : 'BLOCKED',
      blockers: releaseBlockers,
      admission_is_test_success: false,
    },
  }
}

export function buildGuardedRolloutPackage(report) {
  return {
    schema_version: 'control-plane-batch-rollout-v1',
    repair_id: BATCH_REPAIR_ID,
    mode: 'proposal-only',
    idempotency_key: `${BATCH_REPAIR_ID}:${report.evidence.digest}`,
    expected: {
      evidence_sha256: BATCH_EVIDENCE_SHA256,
      candidate_count: 36,
      run_reconciliation: report.run_reconciliation,
      registry_transition: report.registry_transition,
      no_active_task_executions_for_claims: true,
      deployed_controller_export_required: true,
    },
    apply: [
      're-read identities, revisions, run states, current tasks, recovery leases and deployed controller export',
      'request maintenance through the run lease control and wait for acknowledged quiescence',
      'apply versioned schema migration 028_batch_admission_safe_resume.sql',
      'apply reviewed registry patch through control.apply_batch_readiness_registry_patch',
      'refresh contracts transactionally and recompute unresolved scopes and authorization gates',
      'generate a fresh admission report and compare every expected identity and revision',
      'reconcile the existing Shop run budget in place only after explicit operator approval',
      'resume only an admitted run through a compatible lease-owning controller',
    ],
    rollback: [
      'request maintenance and wait for the controller lease to quiesce',
      'revoke the repair generation so claims and resume fail closed',
      'restore captured registry JSON from the migration audit event without changing task/history/run IDs',
      'refresh contracts from restored approved sources',
      'leave every run maintenance-blocked pending a new admission report; do not auto-unpause',
    ],
    may_resume: report.release.status !== 'BLOCKED',
    refusal_reasons: report.release.blockers,
  }
}
