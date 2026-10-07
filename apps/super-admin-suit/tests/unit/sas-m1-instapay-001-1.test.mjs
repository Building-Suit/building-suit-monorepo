import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyTransfer, parseTransfer, transferState, transferCommand, safeTransferUrl, confirmTransferCommand } from '../../app/utils/manual-transfer.ts'
const fixture = () => ({ version: 4, enabled: true, recipientAlias: 'Synthetic recipient', recipientDetails: 'Synthetic details', instructions: { en: 'Synthetic instructions', ar: 'تعليمات اختبار' }, paymentLink: 'https://payment.example.invalid/share', qr: { assetUrl: 'https://assets.example.invalid/qr.png', alt: { en: 'Synthetic QR', ar: 'رمز اختبار' } } })
test('configured, empty, disabled and incomplete records display only supplied values', () => {
  assert.deepEqual(parseTransfer(fixture()), fixture())
  assert.equal(transferState(parseTransfer(fixture())), 'configured')
  assert.equal(transferState(parseTransfer(null)), 'empty')
  assert.equal(emptyTransfer().enabled, null)
  assert.equal(transferState({ ...fixture(), enabled: false }), 'disabled')
  assert.equal(transferState({ ...fixture(), instructions: { en: '', ar: '' } }), 'incomplete')
  assert.throws(() => parseTransfer({ ...fixture(), enabled: undefined }))
  assert.throws(() => parseTransfer({ ...fixture(), paymentLink: 'javascript:alert(1)' }))
  assert.equal('secret' in parseTransfer({ ...fixture(), secret: 'never project' }), false)
})
test('edit command pins expected version, reason, actor binding and immutable retry bytes', () => {
  let id = 0
  const draft = fixture()
  const request = transferCommand('synthetic-binding', draft, 'Synthetic reviewed change', () => `id-${++id}`)
  const original = JSON.stringify(request)
  draft.recipientAlias = 'Later draft'
  assert.equal(JSON.stringify(request), original)
  assert.equal(request.payload.expectedVersion, 4)
  assert.equal(request.operation, 'shop.billing.command')
  assert.equal(request.payload.action, 'configure-manual-transfer')
  assert.equal(request.reason, 'Synthetic reviewed change')
  assert.equal(id, 2)
  assert.throws(() => transferCommand('binding', emptyTransfer(), 'Synthetic reason', () => 'id'))
  assert.throws(() => transferCommand('binding', fixture(), 'short', () => 'id'))
  assert.throws(() => transferCommand('binding', { ...fixture(), instructions: { en: '', ar: '' } }, 'Synthetic reason', () => 'id'))
  assert.equal(transferCommand('binding', { ...fixture(), enabled: false, recipientAlias: '' }, 'Synthetic reason', () => 'id').payload.configuration.enabled, false)
})
test('payment URLs reject executable protocols and embedded credentials', () => {
  for (const url of ['//evil.invalid', 'data:text/html,x', 'http://example.invalid', 'https://user:password@example.invalid']) assert.equal(safeTransferUrl(url), false)
})

test('ambiguous save retries identical command and requires confirmed audit plus a newer version', async () => {
  const request = transferCommand('binding', fixture(), 'Synthetic reviewed change', () => 'synthetic-id')
  const sent = []
  const transport = async value => {
    sent.push(JSON.stringify(value))
    if (sent.length === 1) throw new Error('outcome_unknown')
    return { targetAuditId: 'synthetic-audit', data: { configuration: { ...fixture(), version: 5 } } }
  }
  await assert.rejects(confirmTransferCommand(request, transport))
  assert.equal((await confirmTransferCommand(request, transport)).version, 5)
  assert.equal(sent[0], sent[1])
  await assert.rejects(confirmTransferCommand(request, async () => ({ data: { configuration: fixture() } })))
  await assert.rejects(confirmTransferCommand(request, async () => ({ targetAuditId: 'audit', data: { configuration: fixture() } })))
})
