import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl, nativeServerEnvironment } from '../pilot/local-backend.mjs'

const status = { API_URL: apiUrl, ANON_KEY: 'synthetic-public-key', SERVICE_ROLE_KEY: 'synthetic-server-key' }

test('native pilot supplies real email lookup only through a private server variable', () => {
  const environment = nativeServerEnvironment(status)
  assert.equal(environment.SUPABASE_URL, apiUrl)
  assert.equal(environment.SHOP_AUTH_EMAIL_LOOKUP_KEY, status.SERVICE_ROLE_KEY)
  assert.equal(environment.NUXT_PUBLIC_SUPABASE_KEY, status.ANON_KEY)
  assert.equal(environment.NUXT_PUBLIC_SUPABASE_URL, apiUrl)
  for (const [name, value] of Object.entries(environment)) {
    if (name.startsWith('NUXT_PUBLIC_')) assert.notEqual(value, status.SERVICE_ROLE_KEY)
  }
})

test('native pilot refuses hosted, credential-bearing and wrong local API targets', () => {
  for (const API_URL of ['https://project.supabase.co', 'http://127.0.0.1:64321', 'http://user:password@127.0.0.1:61321']) {
    assert.throws(() => nativeServerEnvironment({ ...status, API_URL }))
  }
})

test('native pilot refuses missing or shared public/private credentials', () => {
  for (const keys of [{ ANON_KEY: '' }, { SERVICE_ROLE_KEY: '' }, { SERVICE_ROLE_KEY: status.ANON_KEY }]) {
    assert.throws(() => nativeServerEnvironment({ ...status, ...keys }))
  }
})
