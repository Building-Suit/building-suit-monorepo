import test from 'node:test'
import assert from 'node:assert/strict'
import { delegationProtocol } from '../fixtures/delegation-provider.mjs'
test('multi-account protocol fixture handles the private boolean lookup before requiring a browser session', () => {
  const state = { delegation: true }
  function lookup(email, key = 'sb_secret_synthetic_protocol_fixture') {
    let result, status = 200
    const handled = delegationProtocol({ state, req: { headers: { apikey: key } }, url: new URL('http://127.0.0.1/rest/v1/rpc/doctor_auth_email_exists'), input: { p_email: email }, send: (value, code = 200) => { result = value; status = code }, deny: () => { throw Error('A pre-auth probe must not demand a browser session') } })
    return { handled, result, status }
  }
  assert.deepEqual(lookup('synthetic-doctor-a@example.test'), { handled: true, result: true, status: 200 })
  assert.deepEqual(lookup('absent@example.test'), { handled: true, result: false, status: 200 })
  assert.deepEqual(lookup('synthetic-doctor-a@example.test', 'sb_publishable_fixture'), { handled: true, result: {}, status: 403 })
})
