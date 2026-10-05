#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateControllerReplacements } from '../lib/n8n-workflows.mjs'

const root = fileURLToPath(new URL('./artifacts/', import.meta.url))
const checkOnly = process.argv.includes('--check')
const runnerWorkflowId = 'rzoRWvnSBG7sU1Oh'
const taskEngineId = '9aWPOijyhfmnEtRy'

function node(id, name, type, parameters, position) {
  const versions = {
    'n8n-nodes-base.code': 2,
    'n8n-nodes-base.executeWorkflow': 1.3,
    'n8n-nodes-base.executeWorkflowTrigger': 1.1,
    'n8n-nodes-base.formTrigger': 2.6,
    'n8n-nodes-base.if': 2.3,
    'n8n-nodes-base.switch': 3.2,
    'n8n-nodes-base.wait': 1.1,
  }
  return { id, name, type, typeVersion: versions[type] ?? 1, position, parameters }
}

function runner(id, name, command, position) {
  return node(id, name, 'n8n-nodes-base.executeWorkflow', {
    workflowId: { __rl: true, value: runnerWorkflowId, mode: 'list', cachedResultName: 'BS-00 — Runner Command' },
    workflowInputs: {
      mappingMode: 'defineBelow', value: { command }, matchingColumns: ['command'],
      schema: [{ id: 'command', displayName: 'command', type: 'string', canBeUsedToMatch: true }],
      attemptToConvertTypes: false, convertFieldsToString: true,
    },
    options: { waitForSubWorkflow: true },
  }, position)
}

function connection(target, output = 0) {
  const outputs = []
  outputs[output] = [{ node: target, type: 'main', index: 0 }]
  return { main: outputs }
}

function branches(...targets) {
  return { main: targets.map(target => target ? [{ node: target, type: 'main', index: 0 }] : []) }
}

const normalizeSupervisorCode = `const source = $input.first().json;
const payload = source.payload ?? source;
const recovery = payload.recovery ?? null;
const reason = payload.reason ?? recovery?.reason ?? payload.error ?? 'supervisor_result';
const wakeAt = recovery?.next_wake_at ?? payload.lease_expires_at ?? recovery?.lease_expires_at ?? null;
const automaticResume = payload.status === 'wait' && (
  recovery?.next_action === 'wait-external' ||
  reason === 'supervisor_lease_active' ||
  reason === 'supervisor_lease_contended'
) && !!wakeAt;
const terminalSuccess = payload.status === 'terminal' && payload.ok === true && ['task_complete', 'task_cancelled'].includes(reason);
const recoverableReconcile = payload.status === 'reconcile' && recovery?.recoverable !== false;
const outcome = automaticResume ? 'automatic-resume' : payload.status === 'wait' || recoverableReconcile ? 'wait' : terminalSuccess ? 'success' : 'safety-stop';
return [{ json: { outcome, task_id: payload.task_id ?? $('Task Engine Input').first().json.task_id, reason, next_action: recovery?.next_action ?? null, next_wake_at: wakeAt, heartbeat_at: recovery?.heartbeat_at ?? null, lease_owner: payload.lease_owner ?? recovery?.lease_owner ?? null, lease_expires_at: payload.lease_expires_at ?? recovery?.lease_expires_at ?? null, recovery, supervisor: payload } }];`

const bs10 = {
  id: taskEngineId,
  name: 'BS-10 — Task Engine',
  active: false,
  nodes: [
    node('bs10-input', 'Task Engine Input', 'n8n-nodes-base.executeWorkflowTrigger', { workflowInputs: { values: [{ name: 'task_id' }] } }, [0, 0]),
    runner('bs10-supervisor', 'Call Control-Plane Supervisor', "={{ 'bs-agent task-supervise ' + $('Task Engine Input').first().json.task_id }}", [240, 0]),
    node('bs10-normalize', 'Normalize Supervisor Result', 'n8n-nodes-base.code', { jsCode: normalizeSupervisorCode }, [480, 0]),
    node('bs10-route', 'Route Supervisor Outcome', 'n8n-nodes-base.switch', {
      rules: { values: ['success', 'automatic-resume', 'wait', 'safety-stop'].map(value => ({ conditions: { conditions: [{ leftValue: '={{ $json.outcome }}', rightValue: value, operator: { type: 'string', operation: 'equals' } }] } })) },
      options: { fallbackOutput: 'extra' },
    }, [720, 0]),
    node('bs10-wait', 'Wait Until Persisted Wake', 'n8n-nodes-base.wait', { resume: 'specificTime', dateTime: '={{ $json.next_wake_at }}' }, [960, -80]),
    node('bs10-success', 'Return Success', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,ok:true,status:'success'}}];" }, [960, -240]),
    node('bs10-held', 'Return Recoverable Wait', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,ok:true,status:'wait'}}];" }, [960, 80]),
    node('bs10-stop', 'Return Safety Stop', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,ok:false,status:'safety-stop'}}];" }, [960, 240]),
  ],
  connections: {
    'Task Engine Input': connection('Call Control-Plane Supervisor'),
    'Call Control-Plane Supervisor': connection('Normalize Supervisor Result'),
    'Normalize Supervisor Result': connection('Route Supervisor Outcome'),
    'Route Supervisor Outcome': branches('Return Success', 'Wait Until Persisted Wake', 'Return Recoverable Wait', 'Return Safety Stop', 'Return Safety Stop'),
    'Wait Until Persisted Wake': connection('Call Control-Plane Supervisor'),
  },
  settings: { executionOrder: 'v1' },
  meta: { templateCredsSetupCompleted: false },
}

const formFields = [
  { fieldLabel: 'Workstream', fieldType: 'text', fieldName: 'workstream_ref', placeholder: 'project/workstream', requiredField: true },
  { fieldLabel: 'Maximum Tasks', fieldType: 'number', fieldName: 'max_tasks', defaultValue: 1, requiredField: true },
]

const bs20 = {
  id: 'pg0BEkbP9E4H4RqB',
  name: 'BS-20 — Continue Suit',
  active: false,
  nodes: [
    node('bs20-form', 'Continue Workstream', 'n8n-nodes-base.formTrigger', { authentication: 'n8nUserAuth', formTitle: 'Continue Building Suit Workstream', formFields: { values: formFields }, responseMode: 'lastNode', options: { path: 'building-suit-continue' } }, [0, 0]),
    runner('bs20-resolve', 'Validate Active Workstream', "={{ 'bs-agent workstream-resolve ' + $('Continue Workstream').first().json.workstream_ref }}", [220, 0]),
    node('bs20-resolved', 'Workstream Valid?', 'n8n-nodes-base.if', { conditions: { conditions: [{ leftValue: '={{ $json.runner_ok }}', operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, [440, 0]),
    runner('bs20-start', 'Start Bounded Run', "={{ 'bs-agent run-start ' + $('Validate Active Workstream').first().json.payload.suit_slug + ' ' + $('Continue Workstream').first().json.max_tasks }}", [660, -80]),
    runner('bs20-gate', 'Check Graceful Run Gate', "={{ 'bs-agent run-check ' + $('Start Bounded Run').first().json.payload.run.run_id }}", [880, -80]),
    node('bs20-gate-route', 'Route Run Gate', 'n8n-nodes-base.code', { jsCode: "const run=$json.payload?.run??{}; const state=run.reason==='maintenance_requested'?'maintenance-wait':run.reason==='stop_requested'?'stop-requested':run.reason==='limit_reached'?'task-limit':run.should_continue===true?'continue':'safety-stop'; return [{json:{...$json,state,run}}];" }, [1100, -80]),
    node('bs20-gate-switch', 'Run Gate State', 'n8n-nodes-base.switch', { rules: { values: ['continue', 'maintenance-wait', 'stop-requested', 'task-limit', 'safety-stop'].map(value => ({ conditions: { conditions: [{ leftValue: '={{ $json.state }}', rightValue: value, operator: { type: 'string', operation: 'equals' } }] } })) } }, [1320, -80]),
    runner('bs20-acquire', 'Acquire or Resume Admitted Task', "={{ 'bs-agent run-acquire-task ' + $('Start Bounded Run').first().json.payload.run.run_id + ' cp-batch-v2 ' + $env.BS_BATCH_CONTROLLER_FINGERPRINT + ' ' + $execution.id }}", [1540, -240]),
    node('bs20-acquire-route', 'Route Acquired Task', 'n8n-nodes-base.code', { jsCode: "const acquisition=$json.payload?.acquisition??{}; const state=acquisition.action==='credit_completion'?'credit-completion':acquisition.acquired===true&&['execute','resume'].includes(acquisition.action)?'execute':['wait','wait_for_owner'].includes(acquisition.action)?'wait':'safety-stop'; return [{json:{...$json,state,acquisition}}];" }, [1760, -240]),
    node('bs20-acquire-switch', 'Acquired Task State', 'n8n-nodes-base.switch', { rules: { values: ['execute', 'credit-completion', 'wait', 'safety-stop'].map(value => ({ conditions: { conditions: [{ leftValue: '={{ $json.state }}', rightValue: value, operator: { type: 'string', operation: 'equals' } }] } })) } }, [1980, -240]),
    node('bs20-engine', 'Delegate Claimed Task to Supervisor', 'n8n-nodes-base.executeWorkflow', { workflowId: { __rl: true, value: taskEngineId, mode: 'list', cachedResultName: 'BS-10 — Task Engine' }, workflowInputs: { mappingMode: 'defineBelow', value: { task_id: "={{ $('Acquire or Resume Admitted Task').first().json.payload.acquisition.packet.task.task_id }}" }, matchingColumns: ['task_id'], schema: [{ id: 'task_id', displayName: 'task_id', type: 'string', canBeUsedToMatch: true }] }, options: { waitForSubWorkflow: true } }, [2200, -320]),
    node('bs20-outcome', 'Supervisor State', 'n8n-nodes-base.switch', { rules: { values: ['success', 'wait', 'safety-stop'].map(value => ({ conditions: { conditions: [{ leftValue: '={{ $json.status }}', rightValue: value, operator: { type: 'string', operation: 'equals' } }] } })) } }, [2420, -320]),
    runner('bs20-complete', 'Record Task Success', "={{ 'bs-agent run-complete-task ' + $('Start Bounded Run').first().json.payload.run.run_id + ' ' + $('Acquire or Resume Admitted Task').first().json.payload.acquisition.packet.task.task_id + ' ' + $('Start Bounded Run').first().json.payload.run.run_id + ':' + $('Acquire or Resume Admitted Task').first().json.payload.acquisition.packet.task.task_id }}", [2640, -400]),
    node('bs20-finish-empty', 'Wait Without Admitted Task', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:'wait',reason:$json.acquisition?.reason??$json.payload?.acquisition?.reason??'acquisition_wait',run_preserved:true}}];" }, [1980, -120]),
    runner('bs20-finish-failed', 'Finish Safety Stop', "={{ 'bs-agent run-finish ' + $('Start Bounded Run').first().json.payload.run.run_id + ' failed' }}", [2640, -160]),
    node('bs20-success', 'success', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:'success'}}];" }, [2860, -400]),
    node('bs20-wait', 'wait', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:'wait',run_preserved:true}}];" }, [2640, -280]),
    node('bs20-empty', 'no-ready-task', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:$json.acquisition?.action==='wait_for_owner'?'owner-wait':$json.acquisition?.reason==='no_admitted_task'||$json.acquisition?.reason==='no_ready_task'?'no-ready-task':'wait',reason:$json.acquisition?.reason??$json.reason??'acquisition_wait'}}];" }, [2200, -120]),
    node('bs20-stopped', 'stop-requested', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:'stop-requested'}}];" }, [1540, -40]),
    node('bs20-limit', 'task-limit', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,status:'task-limit'}}];" }, [1540, 80]),
    node('bs20-maintenance', 'maintenance-wait', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,ok:true,status:'maintenance-wait',run_preserved:true,requires_explicit_resume:true}}];" }, [1540, 20]),
    node('bs20-stop', 'safety-stop', 'n8n-nodes-base.code', { jsCode: "return [{json:{...$json,ok:false,status:'safety-stop'}}];" }, [2860, -160]),
    node('bs20-invalid', 'Rejected Workstream', 'n8n-nodes-base.code', { jsCode: "return [{json:{ok:false,status:'safety-stop',reason:$json.payload?.error??'unknown_or_inactive_workstream'}}];" }, [660, 100]),
  ],
  connections: {
    'Continue Workstream': connection('Validate Active Workstream'),
    'Validate Active Workstream': connection('Workstream Valid?'),
    'Workstream Valid?': branches('Start Bounded Run', 'Rejected Workstream'),
    'Start Bounded Run': connection('Check Graceful Run Gate'),
    'Check Graceful Run Gate': connection('Route Run Gate'),
    'Route Run Gate': connection('Run Gate State'),
    'Run Gate State': branches('Acquire or Resume Admitted Task', 'maintenance-wait', 'stop-requested', 'task-limit', 'Finish Safety Stop'),
    'Acquire or Resume Admitted Task': connection('Route Acquired Task'),
    'Route Acquired Task': connection('Acquired Task State'),
    'Acquired Task State': branches('Delegate Claimed Task to Supervisor', 'Record Task Success', 'Wait Without Admitted Task', 'Finish Safety Stop'),
    'Delegate Claimed Task to Supervisor': connection('Supervisor State'),
    'Supervisor State': branches('Record Task Success', 'wait', 'Finish Safety Stop'),
    'Record Task Success': connection('Check Graceful Run Gate'),
    'Wait Without Admitted Task': connection('no-ready-task'),
    'Finish Safety Stop': connection('safety-stop'),
  },
  settings: { executionOrder: 'v1' },
}

const bs21 = {
  id: 'qHGzP3b0PS82IYSw',
  name: 'BS-21 — Stop Suit Run',
  active: false,
  nodes: [
    node('bs21-form', 'Stop Workstream', 'n8n-nodes-base.formTrigger', { authentication: 'n8nUserAuth', formTitle: 'Stop Building Suit Run', formFields: { values: [{ fieldLabel: 'Workstream', fieldType: 'text', fieldName: 'workstream_ref', placeholder: 'project/workstream', requiredField: true }] }, responseMode: 'lastNode', options: { path: 'building-suit-stop' } }, [0, 0]),
    runner('bs21-resolve', 'Validate Stop Target', "={{ 'bs-agent workstream-resolve ' + $('Stop Workstream').first().json.workstream_ref }}", [240, 0]),
    node('bs21-valid', 'Stop Target Valid?', 'n8n-nodes-base.if', { conditions: { conditions: [{ leftValue: '={{ $json.runner_ok }}', operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, [480, 0]),
    runner('bs21-stop', 'Request Graceful Stop', "={{ 'bs-agent run-stop ' + $('Validate Stop Target').first().json.payload.suit_slug }}", [720, -80]),
    node('bs21-result', 'Stop Requested', 'n8n-nodes-base.code', { jsCode: "return [{json:{ok:$json.runner_ok,status:$json.payload?.stop?.requested?'stop-requested':'no-active-run',details:$json.payload}}];" }, [960, -80]),
    node('bs21-rejected', 'Rejected Stop Target', 'n8n-nodes-base.code', { jsCode: "return [{json:{ok:false,status:'rejected',reason:$json.payload?.error??'unknown_or_inactive_workstream'}}];" }, [720, 80]),
  ],
  connections: {
    'Stop Workstream': connection('Validate Stop Target'),
    'Validate Stop Target': connection('Stop Target Valid?'),
    'Stop Target Valid?': branches('Request Graceful Stop', 'Rejected Stop Target'),
    'Request Graceful Stop': connection('Stop Requested'),
  },
  settings: { executionOrder: 'v1' },
}

const bs30 = {
  id: 'BS31SelfHealingRecovery', name: 'BS-31 — Persisted Recovery Watchdog', active: false,
  nodes: [
    node('bs30-cadence','Recovery Cadence','n8n-nodes-base.scheduleTrigger',{rule:{interval:[{field:'minutes',minutesInterval:1}]}},[0,0]),
    runner('bs30-watch','Wake Eligible Existing Runs','bs-agent recovery-watch',[240,0]),
    node('bs30-status','Recovery Status','n8n-nodes-base.code',{jsCode:"return [{json:{...$json,component:'persisted-recovery-watchdog',no_new_runs:true}}];"},[480,0]),
  ],
  connections: {'Recovery Cadence':connection('Wake Eligible Existing Runs'),'Wake Eligible Existing Runs':connection('Recovery Status')},
  settings:{executionOrder:'v1'},
}
const workflows = [bs10, bs20, bs21, bs30]
// Preserve the published production form identity across regeneration/import.
bs20.nodes.find(node => node.id === 'bs20-form').webhookId = '64a5715c-5c8f-5729-a2b2-5f11cc1afae7'

const validation = validateControllerReplacements(workflows)
if (!validation.valid) throw new Error(`generated_workflow_validation_failed:${validation.errors.join(',')}`)

const files = new Map(workflows.map(workflow => [`${workflow.id}.json`, `${JSON.stringify(workflow, null, 2)}\n`]))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const manifest = {
  version: 2,
  task_id: 'CP-RES-007',
  source_snapshot: {
    exported_at: '2026-10-02T14:24:40.777Z',
    source: 'container-cli',
    fixture: '../fixtures/live-2026-10-02.json',
    sha256: '068636531fa71de2fb37944bc6b896dca827ab9f7268ee3dad6b1ecf87f460d7',
  },
  runner_workflow_id: runnerWorkflowId,
  replacements: workflows.map(workflow => {
    const artifact = `${workflow.id}.json`
    return {
      name: workflow.name,
      live_id: workflow.id,
      artifact,
      sha256: sha256(files.get(artifact)),
      preserves_identity: true,
      generated_active: false,
    }
  }),
  acceptance_gate: {
    task_id: 'CP-RES-009',
    command: 'node tooling/control-plane/resilience/run-acceptance.mjs --check',
    machine_report: '../../resilience/reports/cutover-readiness.json',
    human_report: '../../resilience/reports/cutover-readiness.md',
  },
  runtime_mutation_performed: false,
}
files.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)

if (checkOnly) {
  for (const [file, expected] of files) {
    const target = path.join(root, file)
    if (!existsSync(target) || readFileSync(target, 'utf8') !== expected) throw new Error(`generated_artifact_out_of_date:${file}`)
  }
} else {
  mkdirSync(root, { recursive: true })
  for (const [file, contents] of files) writeFileSync(path.join(root, file), contents)
}

process.stdout.write(`${JSON.stringify({ ok: true, check: checkOnly, output_directory: root, workflows: workflows.map(({ id, name }) => ({ id, name })), validation }, null, 2)}\n`)
