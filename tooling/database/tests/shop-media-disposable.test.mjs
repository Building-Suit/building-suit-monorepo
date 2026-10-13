import assert from 'node:assert/strict'
import test from 'node:test'
import { assertHostedDisposable, assertLocalShopUrl } from '../shop-media-disposable.mjs'

test('media runner rejects non-Actions, self-hosted and non-disposable execution', () => {
  const allowed = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted', SHOP_MEDIA_DISPOSABLE: '1' }
  assert.doesNotThrow(() => assertHostedDisposable(allowed))
  for (const field of Object.keys(allowed)) assert.throws(() => assertHostedDisposable({ ...allowed, [field]: '' }))
  assert.throws(() => assertHostedDisposable({ ...allowed, RUNNER_ENVIRONMENT: 'self-hosted' }))
})

test('media runner rejects hosted projects, arbitrary local services and URL credentials', () => {
  assert.equal(assertLocalShopUrl('http://127.0.0.1:61321'), 'http://127.0.0.1:61321')
  for (const url of ['https://example.supabase.co', 'http://localhost:61321', 'http://127.0.0.1:60321', 'http://user:pass@127.0.0.1:61321', 'https://127.0.0.1:61321']) assert.throws(() => assertLocalShopUrl(url))
})
