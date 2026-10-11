import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { Server } from 'node:http'
import test, { mock } from 'node:test'

const root = new URL('../../../../', import.meta.url)

test('production Shop serves canonical public assets and renders the Shop favicon', async () => {
  // Require a real build; a missing output must fail, never silently skip.
  await readFile(new URL('apps/shop-suit/.output/server/index.mjs', root))
  // Use the built Nitro request pipeline without opening a socket. This also
  // runs in verification sandboxes where local TCP listeners are prohibited.
  const listen = mock.method(Server.prototype, 'listen', function () { return this })
  const env = { ...process.env }
  process.env.NUXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:61321'
  process.env.NUXT_PUBLIC_SUPABASE_KEY = 'local-brand-test-publishable-key'
  let app
  try {
    await import(new URL('apps/shop-suit/.output/server/index.mjs', root))
    const chunkUrl = new URL('apps/shop-suit/.output/server/chunks/nitro/nitro.mjs', root)
    const source = await readFile(chunkUrl, 'utf8')
    const exportName = source.match(/useNitroApp as (\w+)/)?.[1]
    assert.ok(exportName, 'built Nitro exposes its request pipeline')
    const chunk = await import(chunkUrl)
    app = chunk[exportName]()
    for (const [file, type] of [
      ['shop-suit-email-mark.png', 'image/png'],
      ['shop-suit-mark-light.svg', 'image/svg+xml'],
      ['shop-suit-mark-dark.svg', 'image/svg+xml'],
      ['shop-suit-wordmark-light.svg', 'image/svg+xml'],
      ['shop-suit-wordmark-dark.svg', 'image/svg+xml'],
      ['ledger-suit-app-icon.svg', 'image/svg+xml'],
    ]) {
      const response = await app.localFetch(`/brand/${file}`)
      assert.equal(response.status, 200, file)
      assert.ok(response.headers.get('content-type').startsWith(type), file)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()),
        await readFile(new URL(`packages/brand/assets/${file}`, root)), file)
    }
    const response = await app.localFetch('/auth/login')
    assert.equal(response.status, 200)
    const html = await response.text()
    const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1]
    assert.ok(head, 'SSR head is present')
    const icons = [...head.matchAll(/<link\b[^>]*rel="icon"[^>]*>/g)].map(match => match[0])
    assert.equal(icons.length, 2)
    assert.ok(icons.some(icon => icon.includes('href="/brand/shop-suit-mark-light.svg"') && icon.includes('type="image/svg+xml"')))
    assert.ok(icons.some(icon => icon.includes('href="/brand/shop-suit-email-mark.png"') && icon.includes('type="image/png"')))
    assert.ok(!head.includes('/favicon.ico'))
  } finally {
    await app?.hooks.callHook('close')
    listen.mock.restore()
    for (const key of Object.keys(process.env)) if (!(key in env)) delete process.env[key]
    Object.assign(process.env, env)
  }
})
