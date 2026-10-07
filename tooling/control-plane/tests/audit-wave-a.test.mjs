import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { failureEvidence, validateFailureEvidence, evidenceDigest } from '../runner/failure-evidence.mjs'
import { verifierReceipt, validateTrustedReceipt, trustedCommandRegistration } from '../runner/trusted-verifier-receipt.mjs'
import { verificationCommandFailureClass } from '../runner/verification-mode.mjs'
import { auditAttempts } from '../runner/retry-exhaustion-audit.mjs'
import { recoveryErrorEnvelope } from '../runner/recovery-error.mjs'

function fixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), 'cp-trusted-receipt-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = args => assert.equal(spawnSync('git', args, { cwd: root }).status, 0)
  git(['init', '-q'])
  writeFileSync(path.join(root, 'source.mjs'), 'export const example = 1\n')
  writeFileSync(path.join(root, '.gitignore'), '*.log\n')
  git(['add', '.'])
  git(['-c', 'user.name=CP Synthetic', '-c', 'user.email=cp-synthetic@example.invalid', 'commit', '-qm', 'Synthetic baseline'])
  const check = { verification_id: 10, name: 'registered-test', check_name: 'registered-test', command: 'node --test source.mjs',
    exit_code: 1, status: 'fail', log_path: path.join(root, 'check.log') }
  writeFileSync(check.log_path, 'AssertionError from fixture configuration\n')
  check.trusted_registration=trustedCommandRegistration({check,executionId:30,verificationRunId:20,taskId:'CP-SYNTHETIC-001',registry:{fixture:true},obligationIds:['synthetic-product-invariant'],verifierBytes:Buffer.from('synthetic verifier')})
  check.trusted_receipt = verifierReceipt({ check, artifactRoot: root, sourceRoot: root,
    executionId: 30, verificationRunId: 20, taskId: 'CP-SYNTHETIC-001',
    startedAt: '2026-10-07T00:00:00Z', finishedAt: '2026-10-07T00:00:01Z' })
  const evidence = failureEvidence({ execution_id: 30, verification_run_id: 20, check,
    artifact: 'AssertionError from fixture configuration\n', classification: 'PRODUCT_DEFECT',
    origin: 'product-test', review: { root_cause: 'Synthetic reviewed product violation', source: [{ path: 'source.mjs', sha256: evidenceDigest('export const example = 1\n') }] } })
  const context = { execution_id: 30, verification_run_id: 20, check, artifactRoot: root, sourceRoot: root }
  return { root, check, evidence, context }
}

test('P001 generic fixture, assertion text and nonzero exits remain UNKNOWN and uncharged', () => {
  for (const output of ['AssertionError: expect(false)', 'SQL missing fixture column', 'generic failure']) {
    assert.equal(verificationCommandFailureClass({ name: 'test', passed: false, output }), 'unknown-outcome')
    const audited = auditAttempts({ executions: [{ execution_id: 1, attempt: 1, status: 'failed' }],
      failures: [{ execution_id: 1, failure_class: 'verification-product-defect', metadata: {
        checks: [{ name: 'test', required: true, status: 'fail', summary: output }] } }] })
    assert.equal(audited.consumed, 0)
    assert.equal(audited.entries[0].classification, 'UNKNOWN')
  }
})

test('P005 genuine command-host receipt binds execution, generation, check and bytes', t => {
  const { evidence, context } = fixture(t)
  assert.equal(validateFailureEvidence(evidence, context).classification, 'PRODUCT_DEFECT')
  for (const override of [{ check_id: 11 }, { execution_id: 31 }, { verification_run_id: 21 },
    { command: 'forged command' }, { artifact: { ...evidence.artifact, sha256: 'f'.repeat(64) } }]) {
    assert.throws(() => validateFailureEvidence({ ...evidence, ...override }, context))
  }
  assert.throws(() => validateFailureEvidence(evidence, { ...context, check: { ...context.check, trusted_receipt: null } }))
})

test('P005 modified artifact and changed source refuse reviewed charging', t => {
  const { root, check, evidence, context } = fixture(t)
  writeFileSync(check.log_path, 'substituted artifact')
  assert.throws(() => validateFailureEvidence(evidence, context), /digest_mismatch/)
  writeFileSync(check.log_path, 'AssertionError from fixture configuration\n')
  writeFileSync(path.join(root, 'source.mjs'), 'export const example = 2\n')
  assert.throws(() => validateFailureEvidence(evidence, context), /fingerprint_stale/)
})

test('P005 file and parent-directory symlinks cannot replace trusted artifacts', t => {
  const { root, check, evidence } = fixture(t)
  rmSync(check.log_path)
  writeFileSync(path.join(root, 'replacement.log'), 'AssertionError from fixture configuration\n')
  symlinkSync(path.join(root, 'replacement.log'), check.log_path)
  assert.throws(() => validateTrustedReceipt(evidence, check, { executionId: 30,
    verificationRunId: 20, artifactRoot: root, sourceRoot: root }), /symlink_refused/)
})

for (const [code, message, transient] of [
  ['EAI_AGAIN', 'DNS unavailable', true], ['ECONNRESET', 'connection reset', true],
  ['42501', 'permission denied', false], ['42883', 'undefined function', false],
  ['EVIDENCE_REFUSED', 'trusted_verifier_receipt_required', false],
  ['MALFORMED_RESPONSE', 'malformed supervisor response', false],
]) test(`P008 ${code} retains typed cause`, () => {
  const error = Object.assign(new Error(message), { code })
  const result = recoveryErrorEnvelope(error, 'synthetic-component')
  assert.equal(result.error_code, code)
  assert.equal(result.component, 'synthetic-component')
  assert.equal(result.retry_after_ms !== null, transient)
  if (/^[0-9A-Z]{5}$/.test(code)) assert.equal(result.sqlstate, code)
})

test('P008 one rejected candidate cannot abort the remaining watchdog candidates', async () => {
  const { isolateRecoveryCandidates } = await import('../runner/recovery-error.mjs')
  const visited = [], rejected = []
  await isolateRecoveryCandidates([{run_id:'first'}, {run_id:'refused'}, {run_id:'last'}], async candidate => {
    if (candidate.run_id === 'refused') throw Object.assign(new Error('evidence receipt refusal'), {code:'EVIDENCE_REFUSED'})
    visited.push(candidate.run_id)
  }, (candidate, error) => rejected.push({candidate, error}))
  assert.deepEqual(visited, ['first', 'last'])
  assert.equal(rejected.length, 1)
  assert.equal(rejected[0].error.retry_after_ms, null)
  assert.equal(rejected[0].error.error_code, 'EVIDENCE_REFUSED')
})

test('P001 trusted reviewed product evidence charges one execution exactly once on replay', t => {
  const {root, check, evidence} = fixture(t)
  const snapshot = { executions:[{execution_id:30,attempt:1,status:'succeeded',worktree_path:root}],
    verification_runs:[{execution_id:30,verification_run_id:20,status:'failed'}],
    verification_results:[{...check,verification_run_id:20,execution_id:30,metadata:{failure_evidence:evidence,required:true}}],
    policy:{max_attempts:3} }
  for(let replay=0;replay<3;replay++) {
    const result=auditAttempts(snapshot)
    assert.equal(result.consumed,1)
    assert.equal(result.entries.length,1)
    assert.equal(result.entries[0].classification,'PRODUCT_DEFECT')
  }
})

test('trusted PASS rechecks bytes and allows only unchanged bytes after attributed publication commit', async t => {
 const {validatePassedVerifierCheck}=await import('../runner/trusted-verifier-receipt.mjs')
 const {root,check}=fixture(t)
 check.status='pass';check.exit_code=0
 check.trusted_receipt=verifierReceipt({check,artifactRoot:root,sourceRoot:root,executionId:30,verificationRunId:20,taskId:'CP-SYNTHETIC-001',startedAt:'2026-10-07T00:00:00Z',finishedAt:'2026-10-07T00:00:01Z'})
 const context={executionId:30,verificationRunId:20,artifactRoot:root,sourceRoot:root,allowTaskPublicationCommit:true}
 assert.equal(validatePassedVerifierCheck(check,context).status,'pass')
 assert.equal(spawnSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','-qm','Synthetic publication','-m','Task: CP-SYNTHETIC-001'],{cwd:root}).status,0)
 assert.equal(validatePassedVerifierCheck(check,context).status,'pass')
 assert.throws(()=>validatePassedVerifierCheck(check,{...context,allowTaskPublicationCommit:false}),/source_fingerprint_stale/)
 writeFileSync(path.join(root,'source.mjs'),'export const example=2\n')
 assert.throws(()=>validatePassedVerifierCheck(check,context),/source_fingerprint_stale/)
})
