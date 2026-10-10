import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const wrapper = path.join(root, 'tooling/control-plane/runner/bs-agent-ssh.sh')
const controller = JSON.parse(readFileSync(path.join(root, 'tooling/control-plane/n8n/artifacts/pg0BEkbP9E4H4RqB.json'), 'utf8'))
const runId = '4f3b1b7f-0c82-4667-a420-563a43953326'
const taskId = 'BS-UI-ZN-DATA-001'
const fingerprint = 'a'.repeat(64)
const executionId = '1475'
const key = `${runId}:${taskId}`

// Run the actual Bash adapter with an isolated HOME and an argv-only fake node.
// No runtime configuration, database, SSH connection, worker, or task is used.
function invoke(command, exitCode = 0) {
  const home = mkdtempSync(path.join(tmpdir(), 'bs-batch-ssh-'))
  try {
    const bin = path.join(home, 'bin')
    const release=path.join(home,'.local/lib/building-suit-control-plane/releases/synthetic')
    const agent = path.join(release, 'tooling/control-plane/runner/runtime-bootstrap.mjs')
    mkdirSync(bin, { recursive:true })
    mkdirSync(path.dirname(agent), { recursive:true })
    writeFileSync(agent, '// Test placeholder: never executed.\n')
    writeFileSync(path.join(release,'release.json'),'{}')
    symlinkSync(release,path.join(home,'.local/lib/building-suit-control-plane/current'))
    const fakeNode = path.join(bin, 'node')
    writeFileSync(fakeNode, '#!/bin/sh\nprintf \'%s\\0\' "$@"\nexit "${BS_SSH_TEST_EXIT_CODE:-0}"\n')
    chmodSync(fakeNode, 0o700)
    const result = spawnSync('/bin/bash', [wrapper], {
      encoding:'utf8',
      timeout:10000,
      env:{ HOME:home, PATH:`${bin}:/usr/bin:/bin`, LANG:'C', SSH_ORIGINAL_COMMAND:command, BS_SSH_TEST_EXIT_CODE:String(exitCode) },
    })
    assert.equal(result.error, undefined)
    return { ...result, agent, args:result.stdout.endsWith('\0') ? result.stdout.split('\0').slice(0, -1) : null }
  } finally {
    rmSync(home, { recursive:true, force:true })
  }
}

function accepted(command, expected, exitCode = 0) {
  const result = invoke(command, exitCode)
  assert.equal(result.status, exitCode, result.stderr || result.stdout)
  assert.deepEqual(result.args, [result.agent, 'runner', ...expected])
}

function rejected(command, error, code = 64) {
  const result = invoke(command)
  assert.equal(result.status, code, result.stderr || result.stdout)
  assert.equal(result.args, null, 'Invalid input reached the agent')
  assert.deepEqual(JSON.parse(result.stdout), { ok:false, error })
}

function emittedCommand(nodeName) {
  const expression = controller.nodes.find(node => node.name === nodeName)?.parameters?.workflowInputs?.value?.command
  assert.equal(typeof expression, 'string')
  assert.ok(expression.startsWith('={{') && expression.endsWith('}}'))
  const values = {
    'Start Bounded Run':{ payload:{ run:{ run_id:runId } } },
    'Acquire or Resume Admitted Task':{ payload:{ acquisition:{ packet:{ task:{ task_id:taskId } } } } },
  }
  const $ = name => ({ first:() => ({ json:values[name] }) })
  // Evaluate only the repository-controlled producer expression, not its output.
  const evaluate = new Function('$', '$env', '$execution', `return (${expression.slice(3, -2).trim()});`)
  return evaluate($, { BS_BATCH_CONTROLLER_FINGERPRINT:fingerprint }, { id:executionId })
}

const acquire = `bs-agent run-acquire-task ${runId} cp-batch-v2 ${fingerprint} ${executionId}`
const complete = `bs-agent run-complete-task ${runId} ${taskId} ${key}`
const acquireArgs = ['run-acquire-task', runId, 'cp-batch-v2', fingerprint, executionId]
const completeArgs = ['run-complete-task', runId, taskId, key]

test('BS20 hands the exact existing run to the immutable Supervisor adapter',()=>{
 const command=emittedCommand('Delegate Run to Supervisor')
 assert.equal(command,`bs-agent run-supervise ${runId}`)
 accepted(command,['run-supervise',runId])
 rejected(`${command}; echo unsafe`,'invalid_run_supervise',64)
})
test('known n8n cd prefix preserves acquire arguments', () => accepted(`cd / ; ${acquire}`, acquireArgs))
test('known n8n cd prefix preserves attributed completion arguments', () => accepted(`cd / ; ${complete}`, completeArgs))
test('anonymous completion fails closed before any database or credit action', () => rejected(`bs-agent run-complete-task ${runId}`, 'attributed_task_credit_required'))
test('acquire preserves child exit status', () => accepted(acquire, acquireArgs, 23))
test('completion preserves child exit status', () => accepted(complete, completeArgs, 23))
test('unrelated supervisor command is unchanged', () => accepted(`bs-agent task-supervise ${taskId}`, ['task-supervise', taskId]))
test('unknown commands remain forbidden', () => rejected('bs-agent arbitrary-command', 'command_not_allowed', 126))
test('actual BS-31 watchdog command reaches the immutable runner without extra authority', () => {
  const watchdog = JSON.parse(readFileSync(path.join(root, 'tooling/control-plane/n8n/artifacts/BS31SelfHealingRecovery.json'), 'utf8'))
  const command = watchdog.nodes.find(node => node.name === 'Wake Eligible Existing Runs').parameters.workflowInputs.value.command
  assert.equal(command, 'bs-agent recovery-watch')
  accepted(command, ['recovery-watch'])
  accepted(`cd / ; ${command}`, ['recovery-watch'])
  rejected(`${command}; echo unsafe`, 'command_not_allowed', 126)
  rejected(`${command} arbitrary`, 'command_not_allowed', 126)
})
test('an unapproved working-directory prefix remains forbidden', () => rejected(`cd /tmp ; ${acquire}`, 'command_not_allowed', 126))

const invalidAcquisitions = [
  ['missing all arguments', 'bs-agent run-acquire-task '],
  ['malformed run ID', acquire.replace(runId, 'not-a-run')],
  ['unknown protocol', acquire.replace('cp-batch-v2', 'cp-batch-v3')],
  ['missing fingerprint', `bs-agent run-acquire-task ${runId} cp-batch-v2 ${executionId}`],
  ['undefined fingerprint', acquire.replace(fingerprint, 'undefined')],
  ['short fingerprint', acquire.replace(fingerprint, 'abcd')],
  ['missing execution ID', acquire.slice(0, -executionId.length)],
  ['zero execution ID', acquire.replace(/1475$/, '0')],
  ['non-decimal execution ID', acquire.replace(/1475$/, 'wait-1475')],
  ['extra argument', `${acquire} unexpected`],
  ['shell control operator', `${acquire}; echo unsafe`],
  ['command substitution', acquire.replace(/1475$/, '$(echo unsafe)')],
  ['embedded newline', `${acquire}\necho unsafe`],
  ['embedded carriage return', `${acquire}\recho unsafe`],
]
for (const [name, command] of invalidAcquisitions) {
  test(`acquire rejects ${name} without invoking the agent`, () => rejected(command, 'invalid_run_acquire_task'))
}
const invalidCompletions = [
  ['missing run', 'bs-agent run-complete-task '],
  ['malformed run', complete.replace(runId, 'not-a-run')],
  ['missing replay key', `bs-agent run-complete-task ${runId} ${taskId}`],
  ['invalid task', `bs-agent run-complete-task ${runId} lowercase ${runId}:lowercase`],
  ['wrong replay key', `${complete}-WRONG`],
  ['extra argument', `${complete} unexpected`],
  ['shell operator', `${complete}; echo unsafe`],
  ['command substitution', `bs-agent run-complete-task ${runId} ${taskId} $(echo unsafe)`],
  ['embedded newline', `${complete}\necho unsafe`],
  ['embedded carriage return', `${complete}\recho unsafe`],
]
for (const [name, command] of invalidCompletions) {
  test(`completion rejects ${name} without invoking the agent`, () => rejected(command, 'invalid_run_complete_task'))
}
