import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorProviderDiagnostics,DoctorProviderFailure,doctorProviderFailureSummary } from '../provider-diagnostics.mjs'
test('provider diagnostics return fixed categories and validated SQLSTATE without raw SQL or short secrets',() => {
  const secret = 'pin42'; const sql = 'update private_patients set confidential_note=\'short!\''
  const output = `ERROR: must be owner of table buckets (SQLSTATE 42501)\nDETAIL: ${sql}; API key: ${secret}\nfailed authorization: tiny\nError response from daemon: toomanyrequests: Rate exceeded`
  assert.equal(doctorProviderDiagnostics(output),'database-object-ownership-denied,container-registry-rate-limited; sqlstate=42501')
  for (const value of [secret,sql,'short!','tiny','buckets','ERROR','DETAIL']) assert.equal(doctorProviderDiagnostics(output).includes(value),false)
})
test('arbitrary error lines, fabricated SQLSTATE and injected service identifiers cannot become output',() => {
  assert.equal(doctorProviderDiagnostics('error tiny-secret\nfailed dbpassword=abc\nSQLSTATE TOKEN\nSQLSTATE 12345\nSQLSTATE 42501secret\nsupabase_customer-secret_building-suit-doctor'),'provider-operation-failed')
  assert.equal(doctorProviderDiagnostics('SQLSTATE 42501; SQLSTATE 42P01; SQLSTATE 42501\nsupabase_storage_building-suit-doctor\nsecret=pw'),'provider-operation-failed; sqlstate=42501,42P01; services=storage')
})
test('multiple short tokens, multiline JSON and punctuation are suppressed even in a known failing line',() => {
  const source = 'permission denied: {"secret":"x","password":"!","sql":"select patient_note"}\nno space left on device: pwd=123\nconnection refused: Bearer abc'
  assert.equal(doctorProviderDiagnostics(source),'database-permission-denied,executor-disk-capacity,local-service-unavailable')
  assert.equal(doctorProviderDiagnostics(null),'provider-operation-failed')
})

test('final error rendering accepts only the fixed diagnostic wrapper and ignores arbitrary Error detail',() => {
  const error = new DoctorProviderFailure('ERROR: must be owner of table buckets (SQLSTATE 42501) secret=pin42')
  assert.equal(error.message,'provider operation failed')
  assert.equal(doctorProviderFailureSummary(error),'database-object-ownership-denied; sqlstate=42501')
  const injected = Object.assign(new Error('secret=pin42'),{ diagnostic: 'secret=pin42' })
  assert.equal(doctorProviderFailureSummary(injected),'provider-acceptance-assertion-failed')
})
