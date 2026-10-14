import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function assertHostedDisposable(environment) {
  assert.equal(environment.GITHUB_ACTIONS, 'true', 'Requires GitHub Actions')
  assert.equal(environment.RUNNER_ENVIRONMENT, 'github-hosted', 'Self-hosted runners are forbidden')
  assert.equal(environment.SHOP_MEDIA_DISPOSABLE, '1', 'Requires explicit disposable job')
}

export function assertLocalShopUrl(value) {
  const url = new URL(value)
  assert.equal(url.origin, 'http://127.0.0.1:61321', 'Only the isolated Shop loopback API is permitted')
  assert.equal(url.username + url.password, '', 'URL credentials forbidden')
  return url.origin
}

function command(program, args, input) {
  const result = spawnSync(program, args, { input, encoding: 'utf8', timeout: 120000 })
  // Do not print CLI status, environment, credentials, or HTTP response bodies.
  assert.equal(result.status, 0, `${program} command failed; exit ${result.status}`)
  return result.stdout
}

async function run() {
  assertHostedDisposable(process.env)
  const status = JSON.parse(command('pnpm', ['exec', 'supabase', '--workdir', 'apps/shop-suit', 'status', '-o', 'json']))
  const origin = assertLocalShopUrl(status.API_URL)
  const key = status.ANON_KEY
  const admin = status.SERVICE_ROLE_KEY
  assert.ok(key && admin, 'Disposable CLI must supply local API keys')
  const bucket = 'shop-catalog-images'
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==', 'base64')

  for (const suite of ['shop_catalog_media', 'shop_catalog_image_upload']) {
    const sql = await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
    command('docker', ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], `BEGIN;\n${sql}\nROLLBACK;`)
    console.log(`${suite}: authorization/validation fixtures passed and rolled back`)
  }

  async function request(path, token, body, method = 'POST', contentType = 'application/json') {
    const multipart = body instanceof FormData
    return fetch(origin + path, {
      method, headers: { apikey: token === admin ? admin : key, Authorization: `Bearer ${token}`, ...(!multipart ? { 'Content-Type': contentType } : {}), 'x-upsert': 'false' },
      body: body === undefined ? undefined : multipart ? body : contentType === 'application/json' ? JSON.stringify(body) : body,
    })
  }
  async function success(response, label) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      const detail = [error.code, error.error, error.message].filter(value => typeof value === 'string').join(' ').slice(0, 600)
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted token]')
        .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[redacted key]')
      assert.fail(`${label}: HTTP ${response.status} ${detail}`)
    }
    return response.json()
  }
  async function denied(response, label) {
    assert.equal(response.ok, false, `${label}: must reject access`)
  }
  async function account() {
    const email = `media-${randomUUID()}@example.test`
    const password = `Media-${randomUUID()}!`
    // Bootstrap only the disposable Auth fixture. All business/storage requests
    // use the real user's password-grant token, never the administrator key.
    await success(await request('/auth/v1/admin/users', admin, { email, password, email_confirm: true, user_metadata: { display_name: 'Disposable owner' } }), 'Auth fixture')
    const session = await success(await request('/auth/v1/token?grant_type=password', key, { email, password }), 'Password sign-in')
    assert.ok(session.access_token && session.user?.id)
    await success(await request('/auth/v1/user', session.access_token, undefined, 'GET'), 'Authenticated user')
    return session.access_token
  }
  const owner = await account()
  const outsider = await account()
  const shopArgs = { p_shop_name: 'Disposable upload shop', p_business_mode: 'mixed', p_main_location_name: 'Main', p_main_location_code: 'MAIN', p_main_location_address: null, p_main_location_phone: null }
  const shop = await success(await request('/rest/v1/rpc/create_owner_shop', owner, shopArgs), 'Create owner shop')
  await success(await request('/rest/v1/rpc/create_owner_shop', outsider, { ...shopArgs, p_shop_name: 'Separate tenant' }), 'Create outsider shop')
  assert.match(shop, /^[0-9a-f-]{36}$/)
  const rpc = (token, action, payload) => request('/rest/v1/rpc/shop_catalog_media', token, { p_shop_id: shop, p_action: action, p_payload: payload })
  const upload = (token, name, bytes = png, mime = 'image/png', method = 'POST', multipart = false) => {
    if (!multipart) return request(`/storage/v1/object/${bucket}/${name}`, token, bytes, method, mime)
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', new Blob([bytes], { type: mime }), 'fixture.png')
    return request(`/storage/v1/object/${bucket}/${name}`, token, form, method)
  }
  const sign = (token, name) => request(`/storage/v1/object/sign/${bucket}/${name}`, token, { expiresIn: 60 })

  for (const kind of ['products', 'services']) {
    const action = kind === 'products' ? 'save_product' : 'save_service'
    const payload = kind === 'products' ? { p_name: 'Uploaded product', p_sale_price: 12 } : { p_name: 'Uploaded service', p_base_sale_price: 20, p_discount_type: 'amount', p_discount_value: 0, p_scheduling_enabled: false, p_duration_minutes: 30, p_cleanup_minutes: 0, p_location_ids: [], p_staff_membership_ids: [] }
    const name = `${shop}/${kind}/${randomUUID()}.png`
    await denied(await upload(outsider, name), 'Cross-tenant upload')
    await denied(await upload(key, name), 'Anonymous upload')
    await denied(await upload(owner, name, Buffer.from('<svg/>'), 'image/svg+xml'), 'Active MIME upload')
    await denied(await upload(owner, name, Buffer.alloc(5242881)), 'Oversize upload')
    await denied(await upload(owner, name, Buffer.alloc(5242881), 'image/png', 'POST', true), 'Oversize multipart upload')
    await denied(await rpc(owner, action, { ...payload, imageObjectName: name, imageUrl: null }), 'Missing object save')
    await success(await upload(owner, name), 'Owner upload')
    const id = await success(await rpc(owner, action, { ...payload, imageObjectName: name, imageUrl: null }), 'Save image reference')
    const idKey = kind === 'products' ? 'p_product_id' : 'p_service_id'
    const saved = await success(await rpc(owner, kind, {}), 'Read saved catalog')
    assert.equal(saved.supportsUploads, true)
    assert.equal(saved.items.find(item => item.id === id)?.imageObjectName, name)
    const signed = await success(await sign(owner, name), 'Owner signed preview')
    const preview = await fetch(origin + '/storage/v1' + signed.signedURL)
    assert.equal(preview.status, 200, 'Signed preview fetch')
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), png)
    await denied(await sign(outsider, name), 'Cross-tenant signed preview')
    await denied(await sign(key, name), 'Anonymous signed preview')
    await denied(await rpc(outsider, kind, {}), 'Cross-tenant catalog read')
    await denied(await rpc(outsider, action, { ...payload, [idKey]: id, imageObjectName: name }), 'Cross-tenant catalog save')
    await denied(await upload(owner, name, png, 'image/png', 'PUT'), 'Immutable object overwrite')
    const replacement = `${shop}/${kind}/${randomUUID()}.png`
    await success(await upload(owner, replacement, png, 'image/png', 'POST', true), 'Multipart replacement upload')
    await success(await rpc(owner, action, { ...payload, [idKey]: id, imageObjectName: replacement, imageUrl: null }), 'Replacement save')
    const replaced = await success(await rpc(owner, kind, {}), 'Read replacement')
    assert.equal(replaced.items.find(item => item.id === id)?.imageObjectName, replacement)
    await success(await rpc(owner, action, { ...payload, [idKey]: id, imageObjectName: null, imageUrl: null }), 'Remove image reference')
    const removed = await success(await rpc(owner, kind, {}), 'Read removal')
    assert.equal(removed.items.find(item => item.id === id)?.imageObjectName, null)
    console.log(`${kind}: real Auth/Storage/save/preview/replace/remove and tenant isolation passed`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1 })
}
