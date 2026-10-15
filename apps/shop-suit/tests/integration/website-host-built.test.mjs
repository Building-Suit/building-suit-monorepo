import assert from 'node:assert/strict'
import test from 'node:test'
import { request as httpRequest, createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

test('built host boundary ignores spoofed forwarding and blocks every private route on website hosts', async () => {
  let backendCalls = 0
  const backend = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk
    backendCalls++
    const slug = JSON.parse(body || '{}').p_slug
    res.setHeader('Content-Type', 'application/json')
    if (slug === 'backend-failed') { res.statusCode = 503; res.end('{}'); return }
    res.end(JSON.stringify(slug === 'previous-shop' ? { canonicalSlug: 'current-shop', isAlias: true } : null))
  })
  backend.listen(0, '127.0.0.1'); await once(backend, 'listening')
  const fixturePort = backend.address().port
  const port = 4387
  const child = spawn(process.execPath, ['apps/shop-suit/.output/server/index.mjs'], { stdio: ['ignore','ignore','pipe'], env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), NUXT_PUBLIC_APP_URL: 'https://shop.building-suit.com', NUXT_PUBLIC_APP_ENVIRONMENT: 'production', NUXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NUXT_PUBLIC_SUPABASE_KEY: 'local-fixture-publishable-key' } })
  let serverError = ''; child.stderr.on('data', data => { serverError += data })
  const request = (host, path = '/', extra = {}, method = 'GET') => new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: '127.0.0.1', port, path, method, headers: { Host: host, ...extra } }, res => {
      const chunks = []
      res.on('data', value => chunks.push(value))
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers })))
    })
    req.on('error', reject); req.end()
  })
  try {
    const deadline = Date.now() + 30000
    for (;;) {
      try { await request('invalid.test'); break } catch {
        assert.ok(Date.now() < deadline, serverError || 'Built server unavailable')
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    for (const path of ['/', '/dashboard', '/settings', '/auth/login', '/api/changelog', '/robots.txt', '/sitemap.xml', '/brand/shop-suit-mark-light.svg', '/_nuxt/test.js']) {
      const response = await request('unknown-shop.shops.building-suit.com', path, { 'X-Forwarded-Host': 'shop.building-suit.com', Forwarded: 'host=shop.building-suit.com', 'X-Shop-Id': 'other-tenant', 'X-Tenant-Id': 'other-tenant' })
      assert.equal(response.status, 404, path)
      assert.equal(await response.text(), 'Not Found', path)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow')
      assert.equal(response.headers.get('set-cookie'), null)
    }
    for (const host of ['unpublished-shop', 'suspended-shop', 'archived-shop', 'backend-failed']) {
      const response = await request(`${host}.shops.building-suit.com`)
      assert.equal(response.status, 404); assert.equal(await response.text(), 'Not Found')
    }
    const before = backendCalls
    const invalid = await request('evil.test', '/', { 'X-Forwarded-Host': 'previous-shop.shops.building-suit.com' })
    assert.equal(invalid.status, 404); assert.equal(backendCalls, before)
    const alias = await request('previous-shop.shops.building-suit.com', '/settings?returnTo=https://evil.test')
    assert.equal(alias.status, 308)
    assert.equal(alias.headers.get('location'), 'https://current-shop.shops.building-suit.com')
    const postAlias = await request('previous-shop.shops.building-suit.com', '/', {}, 'POST')
    assert.equal(postAlias.status, 404, 'Mutation methods must not redirect')
    const canonical = await request('current-shop.shops.building-suit.com')
    assert.equal(canonical.status, 404, 'No customer publication in this task')
    const privateLogin = await request('shop.building-suit.com', '/auth/login', { 'X-Forwarded-Host': 'previous-shop.shops.building-suit.com', 'X-Tenant-Id': 'other-shop' })
    assert.equal(privateLogin.status, 200)
    assert.notEqual(privateLogin.headers.get('location'), 'https://current-shop.shops.building-suit.com')
  } finally {
    child.kill('SIGTERM'); backend.closeAllConnections(); backend.close()
    await once(child, 'exit')
  }
})
