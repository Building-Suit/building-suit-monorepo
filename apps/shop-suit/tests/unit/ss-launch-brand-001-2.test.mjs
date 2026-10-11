import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { brands } from '../../../../packages/brand/src/index.ts'

const root = new URL('../../../../', import.meta.url)
const read = path => readFile(new URL(path, root))

test('email uses a canonical raster path with a valid PNG and absolute URL', async () => {
  assert.equal(brands.shop.emailLogo, '/brand/shop-suit-email-mark.png')
  const png = await read(`packages/brand/assets/${brands.shop.emailLogo.split('/').at(-1)}`)
  assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert.equal(png.toString('ascii', 12, 16), 'IHDR')
  assert.equal(png.readUInt32BE(16), 512)
  assert.equal(png.readUInt32BE(20), 512)
  assert.ok(png.includes(Buffer.from('IDAT')), 'PNG contains raster data')
  const docs = (await read('packages/brand/README.md')).toString()
  const markup = docs.match(/<img\s[^>]*>/)?.[0]
  assert.ok(markup, 'documented representative email markup exists')
  const src = markup.match(/src="([^"]+)"/)[1]
  const url = new URL(src)
  assert.equal(url.protocol, 'https:')
  assert.equal(url.pathname, brands.shop.emailLogo)
  assert.ok(markup.includes('alt="Shop Suit"'))
})

test('Shop declares canonical icons without app-local logo copies; Ledger stays compatible', async () => {
  const config = (await read('apps/shop-suit/nuxt.config.ts')).toString()
  assert.ok(config.includes(`href: '${brands.shop.icon}'`))
  assert.ok(config.includes(`href: '${brands.shop.emailLogo}'`))
  const publicFiles = await readdir(new URL('apps/shop-suit/public/', root))
  assert.ok(!publicFiles.some(file => /favicon|shop-suit.*\.(svg|png|ico)$/i.test(file)))
  const layer = (await read('packages/nuxt-layer/nuxt.config.ts')).toString()
  assert.ok(layer.includes("dir: here('../brand/assets'), baseURL: '/brand'"))
  assert.equal(brands.ledger.icon, '/brand/ledger-suit-app-icon.svg')
  await read(`packages/brand/assets/${brands.ledger.icon.split('/').at(-1)}`)
})
