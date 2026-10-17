import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorMilestoneReceiptIssues } from '../milestone-evidence.mjs'
const candidate = { headSha: '1'.repeat(40),baseSha: '2'.repeat(40),implementationIdentity: 'synthetic-implementer',inputHashes: { 'acceptance.json': 'a'.repeat(64) },requiredCommands: ['unit','sql','browser','shared','boundary','lint','typecheck','build','release'] }
function receipt() { return { candidateSha: candidate.headSha,baseSha: candidate.baseSha,executionId: 'synthetic-independent-run',verifierIdentity: 'synthetic-independent-reviewer',inputHashes: { ...candidate.inputHashes },cases: { 'DOS-M1-020-C03': 'passed','DOS-M1-020-C04': 'passed' },commands: candidate.requiredCommands.map(id => ({ id,status: 'passed',exitCode: 0,argv: ['synthetic-command',id],startedAt: '2026-10-17T00:00:00Z',finishedAt: '2026-10-17T00:01:00Z',immutableLog: 'synthetic-immutable-log-reference' })) } }
test('C03/C04 independent acceptance cannot use missing, stale, self-issued or altered-artifact receipts',() => {
  assert.ok(doctorMilestoneReceiptIssues(candidate,null).length>0)
  for(const change of [{ candidateSha: '3'.repeat(40) },{ baseSha: '3'.repeat(40) },{ verifierIdentity: candidate.implementationIdentity },{ executionId: '' },{ inputHashes: { 'acceptance.json': 'b'.repeat(64) } }])assert.ok(doctorMilestoneReceiptIssues(candidate,{ ...receipt(),...change }).length>0)
  assert.deepEqual(doctorMilestoneReceiptIssues(candidate,receipt()),[])
})
test('C03 skipped, failed, unavailable and unrun required checks remain distinct acceptance blockers',() => {
  for(const status of ['skipped','failed','unavailable','unrun']) { const r = receipt();r.commands[2].status=status;assert.ok(doctorMilestoneReceiptIssues(candidate,r).includes('command:browser')) }
  for(const change of [{ exitCode: 1 },{ argv: [] },{ immutableLog: '' },{ startedAt: null },{ finishedAt: null }]) { const r = receipt();Object.assign(r.commands[2],change);assert.ok(doctorMilestoneReceiptIssues(candidate,r).includes('command:browser')) }
  const r = receipt();delete r.cases['DOS-M1-020-C04'];assert.ok(doctorMilestoneReceiptIssues(candidate,r).includes('case:DOS-M1-020-C04'))
})
test('C04 synthetic implementation evidence cannot confer integration deployment or clinical authority',() => {
  for(const key of ['domainApprovalGranted','deploymentClaimed','integrationClaimed'])assert.ok(doctorMilestoneReceiptIssues(candidate,{ ...receipt(),[key]: true }).includes('authority-overreach'))

})
