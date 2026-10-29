// CI-only production asset contract. No socket, provider or deployment is started.
import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { Server } from 'node:http'
import { mock } from 'node:test'
if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('Doctor brand runtime acceptance is GitHub CI only')
const root = new URL('../../../', import.meta.url), files = new Map(), original = new Map()
for (const kind of ['mark','wordmark']) for (const tone of ['light','dark']) {
  const filename = `doctor-suit-${kind}-${tone}.svg`, wide = kind === 'wordmark'
  files.set(filename, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wide ? 1200 : 512} ${wide ? 320 : 512}"><title>Synthetic CI asset only</title><rect width="100%" height="100%" fill="${tone === 'light' ? '#fff' : '#111'}"/></svg>`))
}
let app, listen
try {
  for (const [filename, bytes] of files) {
    const target = new URL(`packages/brand/assets/${filename}`, root)
    try { original.set(filename, await readFile(target)) } catch (error) { if (error.code !== 'ENOENT') throw error; original.set(filename, null) }
    await writeFile(target, bytes)
  }
  const built = spawnSync('pnpm',['--filter','@building-suit/doctor-suit','build'], { cwd: root, env: { ...process.env, DOCTOR_SUPABASE_URL: '', DOCTOR_SUPABASE_PUBLISHABLE_KEY: '', NUXT_PUBLIC_DOCTOR_AUTH_CONFIGURED: 'false' }, encoding: 'utf8', timeout: 180000, maxBuffer: 1048576 })
  assert.equal(built.status, 0, 'Synthetic asset build must succeed')
  listen = mock.method(Server.prototype, 'listen', function () { return this })
  await import(new URL('apps/doctor-suit/.output/server/index.mjs', root))
  const chunkUrl = new URL('apps/doctor-suit/.output/server/chunks/nitro/nitro.mjs', root), source = await readFile(chunkUrl,'utf8')
  const exported = source.match(/useNitroApp as (\w+)/)?.[1]; assert.ok(exported)
  app = (await import(chunkUrl))[exported]()
  for (const [filename, bytes] of files) {
    const response = await app.localFetch(`/brand/${filename}`)
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^image\/svg\+xml/)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  }
  for (const suffix of ['app-icon.svg','app-icon.png','email-mark.png']) {
    const filename = `doctor-suit-${suffix}`
    const bytes = await readFile(new URL(`packages/brand/assets/${filename}`, root)).catch(error => { if (error.code !== 'ENOENT') throw error; return null })
    if (!bytes) continue
    const response = await app.localFetch(`/brand/${filename}`)
    assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').startsWith(suffix.endsWith('.png') ? 'image/png' : 'image/svg+xml'))
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes)
  }
  for (const path of ['/','/sign-in','/sign-up','/recover']) {
    const response = await app.localFetch(path); assert.equal(response.status, 200)
    const html = await response.text(), head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/)?.[1]
    assert.ok(head); assert.match(html, /\/brand\/doctor-suit-(?:mark|wordmark)-(?:light|dark)\.svg/)
    // A real optional app-icon may already have been committed by the owner.
    const appIcon = await readFile(new URL('packages/brand/assets/doctor-suit-app-icon.svg', root)).then(() => true, () => false)
    assert.ok(head.includes(appIcon ? '/brand/doctor-suit-app-icon.svg' : '/brand/doctor-suit-mark-light.svg'))
  }
  console.log('Doctor canonical asset slots: fresh build, exact production SVG bytes, shared logo consumers and supplied favicon links passed; no socket/provider/deployment started.')
} finally {
  try { await app?.hooks.callHook('close') } finally {
    listen?.mock.restore()
    for (const [filename, bytes] of original) {
      const target = new URL(`packages/brand/assets/${filename}`, root)
      if (bytes) await writeFile(target,bytes); else await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
  }
}
