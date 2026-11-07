import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { brands, resolveBrandAssets, productLogoImages } from '../src/index.ts'
test('Doctor uses the existing canonical prefix and absent artwork retains the monogram without broken head links', () => {
  assert.equal(brands.doctor.assetPrefix, '/brand/doctor-suit')
  assert.deepEqual(resolveBrandAssets(brands.doctor.assetPrefix, () => false), { assetPrefix: '', icons: [] })
  assert.deepEqual(productLogoImages('', 'mark'), [])
})
test('a later normal build detects the exact logo filenames and optional favicon slots without code changes', () => {
  const files = new Set(['doctor-suit-mark-light.svg','doctor-suit-mark-dark.svg','doctor-suit-wordmark-light.svg','doctor-suit-wordmark-dark.svg'])
  const read = () => resolveBrandAssets(brands.doctor.assetPrefix, filename => files.has(filename))
  assert.deepEqual(read(), { assetPrefix: brands.doctor.assetPrefix, icons: [{ rel: 'icon', type: 'image/svg+xml', href: brands.doctor.icon }] })
  files.add('doctor-suit-app-icon.svg'); files.add('doctor-suit-app-icon.png')
  assert.deepEqual(read().icons, [{ rel: 'icon', type: 'image/svg+xml', href: '/brand/doctor-suit-app-icon.svg' }, { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/brand/doctor-suit-app-icon.png' }])
  assert.throws(() => resolveBrandAssets('https://other.example.test/logo', () => true))
})
test('each logo kind uses both variants, then its available sibling, then the original fallback', () => {
  for (const kind of ['mark','wordmark']) {
    const initial = productLogoImages(brands.doctor.assetPrefix, kind)
    assert.deepEqual(initial.map(image => image.variant), ['light','dark'])
    const missing = productLogoImages(brands.doctor.assetPrefix, kind, ['dark'])
    assert.deepEqual(missing.map(image => image.variant), ['light','light'])
    assert.ok(missing.every(image => image.src === `/brand/doctor-suit-${kind}-light.svg`))
    assert.deepEqual(productLogoImages(brands.doctor.assetPrefix, kind, ['light','dark']), [])
  }
})
test('existing Ledger and Shop assets retain their registered prefix and supplied icon conventions', () => {
  const exists = filename => existsSync(new URL(`../assets/${filename}`, import.meta.url))
  assert.equal(resolveBrandAssets(brands.ledger.assetPrefix, exists).icons[0].href, brands.ledger.icon)
  assert.equal(resolveBrandAssets(brands.shop.assetPrefix, exists).icons[0].href, brands.shop.icon)
  assert.equal(resolveBrandAssets(brands.shop.assetPrefix, exists).icons[1].href, brands.shop.emailLogo)
})
