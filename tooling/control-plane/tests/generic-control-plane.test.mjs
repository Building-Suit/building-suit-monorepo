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
