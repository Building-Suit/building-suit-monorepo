import assert from 'node:assert/strict'
import test from 'node:test'
import { platformReceiptUrl } from '../../app/utils/platformReceiptUrl.ts'
const path = '/storage/v1/object/sign/manual-payment-receipts/tenant/request/evidence?token=synthetic-signed-token'

test('private receipt links use the configured project while retaining their signed path/token', () => {
  assert.equal(platformReceiptUrl('https://project.supabase.co' + path, 'https://project.supabase.co'), 'https://project.supabase.co' + path)
  assert.equal(platformReceiptUrl('http://kong:8000' + path, 'http://127.0.0.1:60821'), 'http://127.0.0.1:60821' + path)
  assert.equal(platformReceiptUrl(path, 'https://project.supabase.co'), 'https://project.supabase.co' + path)
  assert.equal(platformReceiptUrl('https://other.example' + path, 'https://project.supabase.co'), 'https://project.supabase.co' + path)
})

test('receipt navigation rejects other endpoints, missing tokens and unsafe URL forms', () => {
  for (const value of [null, '', 'https://example.test/', '/storage/v1/object/sign/other-bucket/file?token=synthetic', path.replace('?token=', '?absent='), 'javascript:alert(1)', 'https://user:password@example.test' + path, path + '#fragment']) {
    assert.throws(() => platformReceiptUrl(value, 'https://project.supabase.co'))
  }
  for (const project of ['http://remote.example', 'https://user:password@project.supabase.co', 'https://project.supabase.co/prefix', 'https://project.supabase.co/?token=synthetic']) {
    assert.throws(() => platformReceiptUrl(path, project))
  }
})
