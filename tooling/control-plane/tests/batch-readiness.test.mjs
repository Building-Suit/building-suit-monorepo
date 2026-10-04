import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  applyCompletionCredit,
  buildBatchAdmissionReport,
  buildGuardedRolloutPackage,
  canonicalVerificationConfig,
  evaluateSafeResume,
  planActiveRunStart,
  RECONCILED_BATCH,
  validateBatchEvidence,
} from '../lib/batch-readiness.mjs'
import { resolveVerificationPlan } from '../runner/verification-mode.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const registry = JSON.parse(readFileSync(path.join(root, 'tooling/control-plane/batch-readiness/registry-patch.json'), 'utf8'))

function workflow() {
  return JSON.parse(readFileSync(path.join(root, 'tooling/control-plane/n8n/artifacts/pg0BEkbP9E4H4RqB.json'), 'utf8'))
}

function executeCodeNode(workflowValue, name, json) {
  const code = workflowValue.nodes.find(node => node.name === name)?.parameters?.jsCode
  assert.equal(typeof code, 'string', `missing Code node ${name}`)
  const run = new Function('$json', '$input', '$', code)
  return run(json, { first: () => ({ json }) }, () => ({ first: () => ({ json: {} }) }))[0].json
}

function switchDestination(workflowValue, nodeName, state) {
  const node = workflowValue.nodes.find(item => item.name === nodeName)
  const rules = node.parameters.rules.values
  const output = rules.findIndex(rule => rule.conditions.conditions[0].rightValue === state)
  return workflowValue.connections[nodeName].main[output][0].node
}

const ids = {
  shared: [...RECONCILED_BATCH.shared, 'BS-SA-SHELL-001'],
  'shop-suit': [...RECONCILED_BATCH['shop-suit'],
    'SS-OFFLINE-001','SS-EGY-ETA-001','SS-SET-001','SS-APPT-002','SS-BARBER-COMP-001','SS-SERV-002','SS-SALE-002','SS-VAL-001',
    'SS-WEB-SLUG-001','SS-WEB-PROFILE-001','SS-WEB-CATALOG-001','SS-WEB-PUBLIC-001','SS-WEB-APPT-ACCESS-001',
    'SS-WEB-CUSTOMER-PORTAL-001','SS-WEB-CHANGELOG-001','SS-WEB-LAUNCH-001'],
  'super-admin-suit': [...RECONCILED_BATCH['super-admin-suit'],
    'SAS-M1-REGISTRY-001','SAS-M1-SHOP-ADAPTER-001','SAS-M1-INSTAPAY-001','SAS-M1-BILLING-001',
    'SAS-M1-CUSTOM-OFFER-001','SAS-M1-AUDIT-001','SAS-M1-GATE-001'],
}

const capturedEdges = [
  ['BS-UI-ZN-DATA-001','BS-UI-ZN-PUBLIC-CHROME-001'],
  ['BS-UI-ZN-PATTERNS-001','BS-UI-ZN-DATA-001'],
  ['BS-UI-ZN-LEDGER-001','BS-UI-ZN-PATTERNS-001'],
  ['BS-UI-ZN-SHOP-001','BS-UI-ZN-LEDGER-001'],
  ['BS-UI-ZN-OTHER-SUITS-001','BS-UI-ZN-SHOP-001'],
  ['BS-UI-ZN-GENERATOR-001','BS-UI-ZN-OTHER-SUITS-001'],
  ['BS-UI-ZN-BROWSER-001','BS-UI-ZN-GENERATOR-001'],
  ['BS-UI-ZN-FINAL-001','BS-UI-ZN-BROWSER-001'],
  ['SS-SA-EVIDENCE-001','SS-SA-BRIDGE-001'],
  ['SS-SA-CUSTOM-OFFER-001','SS-SA-BRIDGE-001'],
  ['SS-SA-CUSTOM-OFFER-001','SS-SUB-001'],
  ['SAS-M1-CONFIG-001','SAS-M1-ARCH-001'],
  ['SAS-M1-CONFIG-001','SAS-M1-BOOT-001'],
  ['SAS-M1-AUTH-001','SAS-M1-CONFIG-001'],
]

const capturedExternalPrerequisites = new Set([
  'BS-UI-ZN-PUBLIC-CHROME-001','SS-SA-BRIDGE-001','SS-SUB-001','SAS-M1-ARCH-001','SAS-M1-BOOT-001',
])

function fixture() {
  const tasks = Object.entries(ids).flatMap(([workstream_slug, taskIds]) => taskIds.map((task_id, index) => ({
    task_id,
    workstream_slug,
    executions: [],
    verification_runs: [],
    packet: {
      task: {
        task_id,
        status: index === 0 ? 'in_progress' : 'planned',
        verification_plan: task_id === 'BS-UI-ZN-BROWSER-001'
          ? ['Ledger foundation Playwright spec with one worker and zero retries','Shop foundation Playwright spec with one worker and zero retries']
          : task_id === 'SS-SA-EVIDENCE-001'
            ? ['Storage RLS tests for owner, other tenant, anonymous and trusted review boundary.','Upload/read/signed-access expiry tests using disposable files.']
            : task_id === 'SAS-M1-CONFIG-001'
              ? ['Database tests for RLS denial, platform-admin authorization, immutable audit, config versioning and secret non-exposure.']
              : [],
      },
      decisions: task_id === 'BS-SA-SHELL-001'
        ? [{ id:'BS-SA-D001',status:'open',blocking:true }]
        : task_id === 'SS-EGY-ETA-001'
          ? [{ id:'TAX-D01',status:'open',blocking:true }]
          : [],
      dependencies: capturedEdges.filter(([child]) => child === task_id).map(([,parent]) => ({
        task_id:parent,
        dependency_type:'hard',
        status:capturedExternalPrerequisites.has(parent) ? 'complete'
          : Object.values(RECONCILED_BATCH).some(taskIds => taskIds[0] === parent) ? 'in_progress' : 'planned',
      })),
      publication_contract: { contract_id:index+1,contract_fingerprint:`fp-${task_id}`,unresolved_scopes:[] },
    },
  })))
  const recentRuns = [
    { run_id:'4f3b1b7f-0c82-4667-a420-563a43953326',workstream_slug:'shared',status:'running',max_tasks:9,completed_tasks:0,current_task_id:null,stop_requested:false },
    { run_id:'dc3910cd-48be-42b4-9569-4c769e633a44',workstream_slug:'shop-suit',status:'running',max_tasks:3,completed_tasks:0,current_task_id:null,stop_requested:false },
    { run_id:'e362bc39-996c-451c-8fac-9a47df92715c',workstream_slug:'super-admin-suit',status:'running',max_tasks:2,completed_tasks:0,current_task_id:null,stop_requested:false },
  ]
  return {
    schema_version:'building-suit-batch-evidence-v1',
    transaction_read_only:'on',
    release_authorized_by_this_report:false,
    tasks,
    workstreams:Object.keys(ids).map(slug => ({ slug,verification_config:{} })),
    readiness_review:tasks.map(task => ({
      task_id:task.task_id,
      publication_current:{ contract_boundary_mismatch:true },
      publication_after_boundary_alignment_PREVIEW_ONLY:{ exact_authorization_required:[],protected_authorization_required:[] },
    })),
    recent_runs:recentRuns,
    current_state_snapshot:{
      schema_version:'building-suit-batch-current-state-v1',captured_read_only:true,
      tasks:tasks.map(task => ({ task_id:task.task_id,status:task.packet.task.status })),runs:recentRuns,
    },
    task_parent_snapshots:Object.fromEntries(tasks.map(task => [task.task_id, {
      repository_root:root,parent_branch:'codex/fixture/parent',parent_sha:'a'.repeat(40),verified:true,
    }])),
    n8n_controller_export:{ available:false,reason:'fixture deliberately lacks deployed proof' },
    task_history_index:[{ task_id:'SS-SA-BRIDGE-001',status:'complete' }],
    recent_task_events:[
      { task_id:'SS-SA-BRIDGE-001',event_type:'execution_finished',payload:{ execution_id:258,execution_status:'succeeded' } },
      { task_id:'SS-SA-BRIDGE-001',event_type:'verification_finished',payload:{ execution_id:258,verification_run_id:267,failed:0 } },
      { task_id:'SS-SA-BRIDGE-001',event_type:'publication_completed',payload:{ verification_run_id:267,pr_number:191 } },
    ],
  }
}

test('versioned grouped obligations expand to semantically capable required commands', () => {
  const commands = registry.workstreams.shared.verification_config.commands
  const resolved = resolveVerificationPlan({
    entries:['Ledger/Shop migration unit tests'],
    configuredCommands:commands,
    legacyMappings:registry.workstreams.shared.verification_config.legacy_plan_mappings,
  })
  assert.deepEqual(resolved.checks.map(check => check.name), ['ledger-shared-ui-tests','shop-shared-ui-tests'])
  assert.equal(resolved.checks.every(check => check.required), true)
  assert.deepEqual(resolved.blockers, [])
  assert.deepEqual(resolved.unenforced, [])
})

test('verification groups fail closed when any required member is unknown or malformed', () => {
  const full = registry.workstreams.shared.verification_config
  const group = full.legacy_plan_mappings['all current Suit builds']
  for (const omitted of group.commands) {
    const resolved = resolveVerificationPlan({
      entries:['all current Suit builds'],
      configuredCommands:full.commands.filter(command => command.name !== omitted),
      legacyMappings:full.legacy_plan_mappings,
    })
    assert.equal(resolved.checks.length, 0)
    assert.deepEqual(resolved.unenforced, [])
    assert.equal(resolved.blockers[0].blocker, 'verification_group_member_unregistered')
    assert.deepEqual(resolved.blockers[0].unknown_references, [omitted])
  }

  for (const commands of [
    ['ledger-build', 'missing-build'],
    ['ledger-build', null],
    'ledger-build',
  ]) {
    const resolved = resolveVerificationPlan({
      entries:[{ version:2, kind:'group', obligation_id:'malformed-group', commands }],
      configuredCommands:full.commands,
    })
    assert.equal(resolved.checks.length, 0)
    assert.ok(resolved.blockers.length > 0)
  }
})

test('planned product tests are deferred pre-implementation but mandatory post-implementation outputs', () => {
  const config = registry.workstreams['shop-suit'].verification_config
  const preflight = resolveVerificationPlan({
    entries:['Upload/read/signed-access expiry tests using disposable files.'],
    configuredCommands:config.commands,
    legacyMappings:config.legacy_plan_mappings,
    phase:'pre_implementation',
  })
  assert.deepEqual(preflight.blockers, [])
  assert.equal(preflight.deferred.length, 1)
  assert.equal(preflight.deferred[0].required_post_implementation, true)
  assert.ok(preflight.deferred[0].expected_outputs.length > 0)

  const postImplementation = resolveVerificationPlan({
    entries:['Upload/read/signed-access expiry tests using disposable files.'],
    configuredCommands:config.commands,
    legacyMappings:config.legacy_plan_mappings,
    phase:'post_implementation',
  })
  assert.equal(postImplementation.blockers[0].kind, 'planned_test')
})

test('security and Storage obligations cannot alias to an unrelated green command', () => {
  const resolved = resolveVerificationPlan({
    entries:['Storage RLS tests for owner, other tenant, anonymous and trusted review boundary.'],
    configuredCommands:[{ name:'git-diff-check',program:'git',args:['diff','--check'],capabilities:['diff-check'] }],
    legacyMappings:{ 'Storage RLS tests for owner, other tenant, anonymous and trusted review boundary.':'git-diff-check' },
  })
  assert.equal(resolved.checks.length, 0)
  assert.equal(resolved.blockers[0].kind, 'semantic_mismatch')
  assert.ok(resolved.blockers[0].missing_capabilities.includes('storage-policy'))
})

test('planned and external obligations remain explicit blockers', () => {
  const config = registry.workstreams['shop-suit'].verification_config
  const resolved = resolveVerificationPlan({
    entries:['Upload/read/signed-access expiry tests using disposable files.','Supabase advisors/security review where available.'],
    configuredCommands:config.commands,
    legacyMappings:config.legacy_plan_mappings,
  })
  assert.deepEqual(resolved.blockers.map(item => item.kind), ['planned_test','external_gate'])
  assert.deepEqual(resolved.unenforced, [])
})

test('all 36 captured candidates are reported while holds, history, budgets, and controller proof fail closed', () => {
  const evidence = fixture()
  const report = buildBatchAdmissionReport({ evidence,rawEvidence:Buffer.from('{}'),registry,repositoryRoot:root })
  assert.equal(report.candidate_count, 36)
  assert.equal(report.selected_candidate_count, 12)
  assert.equal(report.preserved_holds['BS-SA-SHELL-001'].unchanged, true)
  assert.equal(report.preserved_history.execution_id, 258)
  assert.equal(report.preserved_history.verification_run_id, 267)
  assert.equal(report.preserved_history.pull_request_id, 191)
  assert.equal(report.preserved_history.evidence_complete, true)
  assert.equal(report.run_reconciliation['shop-suit'].budget_reconciliation_required, true)
  assert.equal(report.run_reconciliation['shop-suit'].preserve_run_id, undefined)
  assert.equal(report.run_reconciliation['shop-suit'].reconciliation.preserve_run_id, true)
  assert.ok(Object.values(report.registry_transition).every(item => item.preserves_unrelated_keys))
  assert.equal(report.release.status, 'BLOCKED')
  assert.ok(report.release.blockers.includes('deployed_controller_export_unavailable'))
  assert.equal(report.candidates.find(item => item.task_id==='SS-SA-EVIDENCE-001').verification.blockers.length, 0)
  assert.equal(report.candidates.find(item => item.task_id==='SS-SA-EVIDENCE-001').verification.deferred_product_outputs.length, 2)
})

test('captured hard graph is admission-valid while downstream tasks remain explicitly execution-waiting', () => {
  const evidence = fixture()
  const actualEdges = evidence.tasks.flatMap(task => task.packet.dependencies.map(dependency =>
    [task.task_id,dependency.task_id,dependency.dependency_type]))
  assert.deepEqual(actualEdges, capturedEdges.map(edge => [...edge,'hard']))
  assert.equal(actualEdges.length, 14)
  assert.equal(actualEdges.some(([child,parent]) =>
    child === 'SS-SA-CUSTOM-OFFER-001' && parent === 'SS-SA-EVIDENCE-001'), false)

  const report = buildBatchAdmissionReport({ evidence,rawEvidence:Buffer.from('{}'),registry,repositoryRoot:root })
  const selected = report.candidates.filter(candidate => candidate.selected_for_reconciled_batch)
  assert.equal(selected.every(candidate => candidate.batch_admission.dependency_admissible), true)
  assert.equal(selected.filter(candidate => candidate.batch_admission.execution_ready_now).length, 3)
  assert.equal(report.candidates.find(candidate => candidate.task_id === 'BS-UI-ZN-PATTERNS-001')
    .batch_admission.semantics, 'admissible_waiting_for_predecessor')
  assert.deepEqual(report.candidates.find(candidate => candidate.task_id === 'SS-SA-CUSTOM-OFFER-001')
    .batch_admission.pending_run_predecessors, ['SS-SA-EVIDENCE-001'])
  assert.deepEqual(report.candidates.find(candidate => candidate.task_id === 'SAS-M1-AUTH-001')
    .batch_admission.pending_internal_dependencies, [{ task_id:'SAS-M1-CONFIG-001',status:'in_progress' }])
})

test('SQL activation binds reviewed ordinals and combines dependency edges with serialized run order', () => {
  const migration = readFileSync(path.join(root, 'tooling/control-plane/sql/028_batch_admission_safe_resume.sql'), 'utf8')
  assert.match(migration, /match the reviewed run order/)
  assert.match(migration, /wait_edges\(waiter,prerequisite\)/)
  assert.match(migration, /earlier\.ordinal=later\.ordinal-1/)
  assert.match(migration, /Combined hard-dependency and run-order graph contains a cycle/)
  assert.doesNotMatch(migration, /ORDER BY admission\.ordinal FOR UPDATE OF admission,task SKIP LOCKED/)
})

test('Shared browser obligations target the declared applications with strict dispatcher flags', () => {
  const commands = registry.workstreams.shared.verification_config.commands.filter(command => command.capabilities?.includes('browser'))
  assert.equal(commands.length, 2)
  for (const command of commands) {
    assert.ok(command.args.includes('--workers=1'))
    assert.ok(command.args.includes('--retries=0'))
    assert.ok(command.args.includes('--repeat-each=2'))
    assert.equal(command.args.some(argument => argument.includes('packages/ui')), false)
    const spec = command.args.find(argument => argument.endsWith('.spec.ts'))
    const app = command.args[1].replace('@building-suit/','apps/')
    assert.equal(readFileSync(path.join(root,app,spec),'utf8').length > 0,true)
  }
  const report = buildBatchAdmissionReport({ evidence:fixture(),rawEvidence:Buffer.from('{}'),registry,repositoryRoot:root })
  const browser = report.candidates.find(item => item.task_id==='BS-UI-ZN-BROWSER-001')
  const discoveries = browser.verification.command_availability.filter(item => item.playwright)
  assert.equal(discoveries.length,2)
  assert.equal(discoveries.every(item => item.playwright.spec_exists && item.playwright.workers_one && item.playwright.retries_zero),true)
  assert.equal(discoveries.every(item => item.playwright.test_match_proven || item.playwright.failure),true)
})

test('command readiness checks package scripts and actual Playwright list discovery in the task parent', () => {
  const temporary = mkdtempSync(path.join(tmpdir(), 'cp-batch-parent-'))
  try {
    mkdirSync(path.join(temporary, 'apps/present/tests/e2e'), { recursive:true })
    writeFileSync(path.join(temporary, 'apps/present/package.json'), JSON.stringify({
      name:'@building-suit/present', scripts:{ build:'nuxt build' },
    }))
    writeFileSync(path.join(temporary, 'apps/present/tests/e2e/visible.spec.ts'), 'test("visible",()=>{})')
    const evidence = fixture()
    evidence.task_parent_snapshots = Object.fromEntries(evidence.tasks.map(task => [task.task_id, {
      repository_root:temporary,
      parent_branch:'codex/shared/fixture-parent',
      parent_sha:'a'.repeat(40),
      verified:true,
    }]))
    const altered = structuredClone(registry)
    altered.workstreams.shared.verification_config.commands = [{
      name:'missing-build', program:'pnpm', args:['--filter','@building-suit/missing','build'], capabilities:['build'], required:true,
    }, {
      name:'wrong-browser', program:'pnpm', args:['--filter','@building-suit/present','exec','playwright','test','tests/e2e/missing.spec.ts','--list','--workers=1','--retries=0'], capabilities:['browser'], required:true,
    }]
    altered.workstreams.shared.verification_config.legacy_plan_mappings = {
      'Ledger foundation Playwright spec with one worker and zero retries': { version:2,kind:'group',commands:['missing-build','wrong-browser'] },
    }
    const report = buildBatchAdmissionReport({ evidence,rawEvidence:Buffer.from('{}'),registry:altered,repositoryRoot:root })
    const browser = report.candidates.find(item => item.task_id === 'BS-UI-ZN-BROWSER-001')
    assert.ok(browser.blockers.includes('verification_command_or_fixture_missing'))
    assert.equal(browser.verification.command_availability[0].package_exists, false)
    assert.equal(browser.verification.command_availability[1].playwright.discovery_succeeded, false)
    assert.equal(browser.repository_parent.verified, true)
  }
  finally {
    rmSync(temporary, { recursive:true, force:true })
  }
})

test('rollout package is idempotent and refuses resume while report is blocked', () => {
  const evidence = fixture()
  const report = buildBatchAdmissionReport({ evidence,rawEvidence:Buffer.from('{}'),registry,repositoryRoot:root })
  const rollout = buildGuardedRolloutPackage(report)
  assert.match(rollout.idempotency_key,/^CP-BATCH-READY-001:/)
  assert.equal(rollout.may_resume,false)
  assert.ok(rollout.rollback.some(step => step.includes('do not auto-unpause')))
})

test('registry preview produces the exact canonical merge and preserves unrelated keys', () => {
  const existing = { mode:'focused',unrelated:{ keep:true },commands:[{ name:'existing',program:'node',args:['old.mjs'] }],legacy_plan_mappings:{ old:'existing' } }
  const patch = { commands:[{ name:'existing',program:'node',args:['new.mjs'] },{ name:'added',program:'node',args:['added.mjs'] }],legacy_plan_mappings:{ added:'added' } }
  const resulting = canonicalVerificationConfig(existing, patch)
  assert.deepEqual(resulting.unrelated, { keep:true })
  assert.deepEqual(resulting.commands.map(command => command.name), ['added','existing'])
  assert.deepEqual(resulting.legacy_plan_mappings, { old:'existing',added:'added' })
})

test('active run budget mismatch requires reconciliation and completion replay cannot double count', () => {
  const run = { run_id:'run-1',status:'running',max_tasks:3,completed_tasks:0,current_task_id:'SS-SA-EVIDENCE-001' }
  assert.deepEqual(planActiveRunStart(run,2), {
    action:'explicit_reconciliation_required',run_id:'run-1',stored_max:3,requested_max:2,completed_tasks:0,preserve_run_id:true,
  })
  const first = applyCompletionCredit({ run,taskId:'SS-SA-EVIDENCE-001',idempotencyKey:'run-1:SS-SA-EVIDENCE-001' })
  assert.equal(first.applied,true)
  const replay = applyCompletionCredit({
    run:{ ...run,completed_tasks:1,current_task_id:null },taskId:'SS-SA-EVIDENCE-001',idempotencyKey:first.credit.idempotency_key,credits:[first.credit],
  })
  assert.equal(replay.idempotent,true)
  assert.equal(replay.completed_tasks,1)
  assert.equal(applyCompletionCredit({ run,taskId:'SS-SA-CUSTOM-OFFER-001',idempotencyKey:'wrong' }).reason,'task_not_attributed_to_run')
})

test('resume refuses missing controller proof and stale admissions', () => {
  const run = { maintenance_requested:true,controller_protocol:'cp-batch-v2',controller_fingerprint:'controller-content-v2' }
  assert.equal(evaluateSafeResume({ run,controllerProof:{ available:false },admissions:[] }).resumable,false)
  assert.deepEqual(evaluateSafeResume({
    run,controllerProof:{ available:true,protocol:'cp-batch-v2',fingerprint:'controller-content-v2' },admissions:[{ current:true,blockers:[] }],
  }),{ resumable:true,reasons:[] })
  assert.ok(evaluateSafeResume({
    run,controllerProof:{ available:true,protocol:'cp-batch-v2',fingerprint:'cp-batch-v2' },admissions:[{ current:true,blockers:[] }],
  }).reasons.includes('controller_protocol_is_not_content_proof'))
})

test('approved evidence validation fails closed on changed bytes', () => {
  const result = validateBatchEvidence(fixture(),Buffer.from('changed'))
  assert.equal(result.valid,false)
  assert.ok(result.errors.includes('evidence_sha256_mismatch'))
})

test('fresh state and task-parent evidence are independent from original provenance', () => {
  const evidence = fixture()
  evidence.current_state_snapshot.runs[0] = { ...evidence.current_state_snapshot.runs[0],run_id:'00000000-0000-0000-0000-000000000000' }
  delete evidence.task_parent_snapshots['SAS-M1-CONFIG-001']
  const report = buildBatchAdmissionReport({ evidence,rawEvidence:Buffer.from('{}'),registry,repositoryRoot:root })
  assert.ok(report.current_state.errors.includes('current_state_run_identity_mismatch:shared'))
  const config = report.candidates.find(candidate => candidate.task_id === 'SAS-M1-CONFIG-001')
  assert.ok(config.blockers.includes('task_parent_context_unverified'))
  assert.ok(config.blockers.includes('database_lifecycle_missing_or_invalid') || config.database.lifecycle.valid)
  assert.notEqual(report.evidence.digest, report.current_state.digest)
})

test('actual controller Code nodes preserve maintenance, dependency waits, and completed-claim credit', () => {
  const controller = workflow()
  const maintenance = executeCodeNode(controller, 'Route Run Gate', {
    payload:{ run:{ reason:'maintenance_requested',should_continue:false,status:'running' } },
  })
  assert.equal(maintenance.state, 'maintenance-wait')
  assert.equal(switchDestination(controller, 'Run Gate State', maintenance.state), 'maintenance-wait')

  const acquired = executeCodeNode(controller, 'Route Acquired Task', {
    payload:{ acquisition:{ acquired:true,action:'credit_completion',packet:{ task:{ task_id:'SS-SA-EVIDENCE-001' } } } },
  })
  assert.equal(acquired.state, 'credit-completion')
  assert.equal(switchDestination(controller, 'Acquired Task State', acquired.state), 'Record Task Success')

  const dependencyWait = executeCodeNode(controller, 'Route Acquired Task', {
    payload:{ acquisition:{ acquired:false,action:'wait',reason:'dependency_wait',task_id:'SAS-M1-AUTH-001' } },
  })
  assert.equal(dependencyWait.state, 'wait')
  assert.equal(switchDestination(controller, 'Acquired Task State', dependencyWait.state), 'Wait Without Admitted Task')

  const claimNode = controller.nodes.find(node => node.name === 'Acquire or Resume Admitted Task')
  const command = claimNode.parameters.workflowInputs.value.command
  assert.match(command, /cp-batch-v2/)
  assert.match(command, /BS_BATCH_CONTROLLER_FINGERPRINT/)
  assert.match(command, /\$execution\.id/)
  assert.doesNotMatch(command, /run-claim-task[^']* cp-batch-v2'\s*}}/)
})
