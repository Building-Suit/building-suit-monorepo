import assert from 'node:assert/strict'
import test from 'node:test'
import { inspectWorkflowSnapshot, normalizeWorkflow, workflowGraphSummary } from '../lib/n8n-workflows.mjs'
import { validateProjectConfig } from '../lib/project-config.mjs'
import { redact } from '../lib/redaction.mjs'
import { profileForAttempt, retryDecision, validateRetryPolicy } from '../lib/retry-policy.mjs'

test('retry policy requires one explicit profile per attempt', () => {
  assert.throws(() => validateRetryPolicy({ policy_id:'broken',max_attempts:5,attempt_profiles:['standard','standard','deep'] }), /count/)
  const policy=validateRetryPolicy({ policy_id:'critical-five',max_attempts:5,attempt_profiles:['standard','standard','deep','deep','deep'] })
  assert.equal(profileForAttempt(policy,3),'deep')
  assert.deepEqual(retryDecision(policy,4),{allowed:true,next_attempt:5,next_profile:'deep',max_attempts:5})
  assert.equal(retryDecision(policy,5).allowed,false)
})

test('project registration rejects incomplete and ambiguous config', () => {
  assert.throws(() => validateProjectConfig({slug:'Bad Slug'}), /slug/)
  assert.throws(() => validateProjectConfig({slug:'example',metadata:{api_key:'secret'}}), /secrets are not allowed/)
  const project=validateProjectConfig({slug:'example',display_name:'Example',github_repository:'owner/repo',integration_branch:'stg',production_branch:'main',local_repository_root:'.',worktree_root:'.local/worktrees',workstreams:[{slug:'backend',stack_key:'backend'}]})
  assert.equal(project.active,false)
  assert.equal(project.default_model_profile,'standard')
})

test('diagnostic redaction removes keyed and inline credentials', () => {
  const safe=redact({api_key:'top-secret',message:'Bearer abcdefghijklmnopqrstuvwxyz',url:'postgresql://user:pass@example/db'})
  assert.equal(safe.api_key,'[REDACTED]')
  assert.doesNotMatch(safe.message,/abcdefgh/)
  assert.doesNotMatch(safe.url,/user:pass/)
})

test('n8n exports normalize nodes and render a graph without mutation', () => {
  const workflow={id:'1',name:'Continue',active:true,nodes:[{id:'b',name:'Run',type:'ssh'},{id:'a',name:'Trigger',type:'form'}],connections:{Trigger:{main:[[{node:'Run',type:'main',index:0}]]}}}
  const normalized=normalizeWorkflow(workflow)
  assert.deepEqual(normalized.nodes.map(node=>node.name),['Run','Trigger'])
  assert.match(workflowGraphSummary(workflow),/Trigger -> Run/)
  assert.equal(workflow.nodes[0].name,'Run')
})

test('n8n inspection identifies hard-coded registry options and retry graphs', () => {
  const inspection=inspectWorkflowSnapshot([{name:'Legacy engine',nodes:[{name:'Retry Attempt 02',parameters:{}},{name:'Form',parameters:{fieldName:'suit_slug',fieldOptions:{values:[{option:'ledger-suit'}]}}}]}])
  assert.equal(inspection.compatible,false)
  assert.deepEqual(inspection.findings.map(item=>item.code).sort(),['hardcoded_registry_options','n8n_owned_retry_graph'])
})


test('control-plane runner permits configured retries until the policy limit', async () => {
  const { readFile } = await import('node:fs/promises')
  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  const stoppedMarker = ['automatic', 'repair_stopped'].join('_')
  assert.doesNotMatch(runner, new RegExp(stoppedMarker))
  assert.doesNotMatch(runner, /execution\.metadata\?\.retry === true/)
  assert.match(runner, /maxRepairCycles/)
  assert.match(runner, /maxRepairCycles\s*=\s*1/)
  assert.match(runner, /retry_limit_reached/)
  assert.match(runner, /decision\.allowed/)
  assert.match(runner, /failure_stage/)
  assert.match(runner, /verification_failures/)
  assert.match(runner, /legalActions\.push/)
})

test('worker prompt requires full Shop database regression after database changes', async () => {
  const { readFile } = await import('node:fs/promises')
  const prompt = await readFile(
    new URL('../runner/task-prompt.mjs', import.meta.url),
    'utf8',
  )

  assert.match(prompt, /pnpm db:test:shop/)
  assert.match(prompt, /full locally-safe regression command/)
  assert.match(prompt, /Do not claim a check passed unless/)
})

test('focused browser verification collects all failures before repair', async () => {
  const { readFile } = await import('node:fs/promises')
  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )

  assert.match(verifier, /'--workers=1'/)
  assert.match(verifier, /'--retries=0'/)
  assert.match(verifier, /'--repeat-each=2'/)
  assert.doesNotMatch(verifier, /--max-failures=1/)
})

test('repair execution is gated by verifier probes', async () => {
  const { readFile } = await import('node:fs/promises')

  const verifier = await readFile(
    new URL('../runner/task-verifier.mjs', import.meta.url),
    'utf8',
  )

  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  assert.match(verifier, /verificationRunId === 'probe'/)
  assert.match(verifier, /if \(verificationProbe\)/)

  assert.match(runner, /maxRepairCycles/)
  assert.match(runner, /repair-verification-/)
  assert.match(runner, /verification_probe_passed/)
  assert.match(runner, /latestProbe\?\.passed ===/)
  assert.match(runner, /repair_verification_failed/)
})

test('repair acceptance requires a confirmation verifier pass', async () => {
  const { readFile } = await import('node:fs/promises')

  const runner = await readFile(
    new URL('../runner/bs-agent.mjs', import.meta.url),
    'utf8',
  )

  assert.match(runner, /repair-verification-\$\{cycle\}-confirmation/)
  assert.match(runner, /confirmationProbe\?\.passed ===/)
})
