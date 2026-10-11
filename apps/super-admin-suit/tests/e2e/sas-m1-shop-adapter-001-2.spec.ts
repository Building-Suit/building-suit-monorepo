import { test, expect } from '@playwright/test'
const sentinel = 'sas-adapter-server-only-sentinel-DO-NOT-EXPOSE'
const forbidden = /sas-adapter-server-only-sentinel-DO-NOT-EXPOSE|vault_secret_id|decrypted_secret|x-bs-signature|x-bs-key-id|adapter_base_url|target_identity_fingerprint|secretReferenceId/

test('real unauthorized adapter endpoint and loaded browser assets expose no privileged connection material', async ({ page }) => {
  const requests: string[] = []
  const responses: Promise<string>[] = []
  page.on('request', request => requests.push(JSON.stringify({ url: request.url(), headers: request.headers(), body: request.postData() })))
  page.on('response', response => {
    if (new URL(response.url()).origin === 'http://127.0.0.1:4324') responses.push(response.text().catch(() => ''))
  })
  await page.goto('/')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: { $nuxt: { isHydrating: boolean } } }) | null
    return root?.__vue_app__?.$nuxt.isHydrating === false
  })
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/adapters/shop', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bindingId: '11111111-1111-4111-8111-111111111111', operation: 'shop.plan.command', requestId: '22222222-2222-4222-8222-222222222222', correlationId: '33333333-3333-4333-8333-333333333333', reason: 'Synthetic test request', payload: {} }),
    })
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.text() }
  })
  expect(result.status).toBe(401)
  expect(result.cache).toBe('private, no-store')
  expect(result.body).not.toMatch(forbidden)
  expect(requests.join('\n')).not.toMatch(forbidden)
  expect((await Promise.all(responses)).join('\n')).not.toMatch(forbidden)
  expect(await page.content()).not.toContain(sentinel)
  expect(requests.some(value => value.includes('/shop-super-admin-bridge/'))).toBe(false)
})
