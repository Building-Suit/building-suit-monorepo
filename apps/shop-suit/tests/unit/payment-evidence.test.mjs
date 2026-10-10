import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  isPaymentEvidenceAccess, signPaymentEvidenceAccess,
} from '../../supabase/functions/_shared/payment-evidence.mjs'

const evidence = {
  evidenceId: '10000000-0000-4000-a000-000000000001',
  submissionId: '10000000-0000-4000-a000-000000000002',
  bucket: 'shop-payment-evidence',
  objectName: '10000000-0000-4000-a000-000000000003/10000000-0000-4000-a000-000000000002/receipt.png',
  originalFileName: 'receipt.png', mimeType: 'image/png', sizeBytes: 1024,
  expiresIn: 60, expiresAt: '2026-10-05T12:01:00Z',
}

const encodedObject = evidence.objectName.split('/').map(encodeURIComponent).join('/')
const storagePath = `/object/sign/shop-payment-evidence/${encodedObject}`
const publicPath = `/storage/v1${storagePath}`
const tokenQuery = '?token=eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3OTEyMDgwNjB9.test_signature-1'
const responseFor = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: { 'content-type': 'application/json' },
})
const signingOptions = {
  data: evidence, supabaseUrl: 'https://shop.example.invalid', serviceRoleKey: 'server-only',
}

test('actual Storage-relative and gateway-prefixed responses sign the exact object and strip private metadata', async () => {
  for (const path of [storagePath, publicPath]) {
    for (const field of ['signedURL', 'signedUrl']) {
      let request
      const result = await signPaymentEvidenceAccess({
        ...signingOptions,
        fetchImpl: async (url, options) => {
          request = { url, options }
          return responseFor({ [field]: `${path}${tokenQuery}` })
        },
      })
      assert.equal(request.url, `https://shop.example.invalid${publicPath}`)
      assert.equal(request.options.method, 'POST')
      assert.deepEqual(JSON.parse(request.options.body), { expiresIn: 60 })
      assert.deepEqual(request.options.headers, {
        'content-type': 'application/json', apikey: 'server-only', authorization: 'Bearer server-only',
      })
      const metadata = { ...evidence }
      delete metadata.bucket
      delete metadata.objectName
      delete metadata.expiresIn
      assert.deepEqual(result, { ...metadata, signedUrl: `https://shop.example.invalid${publicPath}${tokenQuery}` })
      assert.equal(JSON.stringify(result).includes('server-only'), false)
    }
  }
})

test('server-side signing stays internal while access uses the configured public origin', async () => {
  let request
  const objectName = evidence.objectName.replace('receipt.png', 'receipt scan #1.png')
  const encodedPath = `${publicPath.slice(0, publicPath.lastIndexOf('/') + 1)}receipt%20scan%20%231.png`
  const result = await signPaymentEvidenceAccess({
    ...signingOptions, data: { ...evidence, objectName },
    supabaseUrl: 'http://kong:8000/', publicSupabaseUrl: 'http://127.0.0.1:61321/',
    fetchImpl: async (url, options) => {
      request = { url, options }
      return responseFor({ signedURL: `${encodedPath.slice('/storage/v1'.length)}${tokenQuery}` })
    },
  })
  assert.equal(request.url, `http://kong:8000${encodedPath}`)
  assert.equal(result.signedUrl, `http://127.0.0.1:61321${encodedPath}${tokenQuery}`)
  assert.equal(request.options.headers.apikey, 'server-only')
  assert.equal(result.objectName, undefined)
})

test('expiry boundaries remain 30 through 300 seconds and invalid inputs never fetch', async () => {
  for (const expiresIn of [30, 300]) {
    await signPaymentEvidenceAccess({
      ...signingOptions, data: { ...evidence, expiresIn },
      fetchImpl: async (_url, options) => {
        assert.deepEqual(JSON.parse(options.body), { expiresIn })
        return responseFor({ signedURL: `${storagePath}${tokenQuery}` })
      },
    })
  }
  const invalidData = [
    null,
    ...[29, 301, 30.5, '60', null, undefined, NaN, Infinity].map(expiresIn => ({ ...evidence, expiresIn })),
    { ...evidence, bucket: 'public' },
    ...['', '/receipt.png', '../receipt.png', 'shop/../receipt.png'].map(objectName => ({ ...evidence, objectName })),
  ]
  for (const data of invalidData) {
    await assert.rejects(() => signPaymentEvidenceAccess({
      ...signingOptions, data,
      fetchImpl: () => assert.fail('invalid input must not fetch'),
    }), /payment_evidence_signing_invalid/)
  }
})

test('both trusted base URLs reject unsafe or ambiguous configuration before fetching', async () => {
  const invalidUrls = [
    '', null, 123, '//host.invalid', 'ftp://host.invalid', 'javascript:alert(1)',
    'https:host.invalid', 'https:///host.invalid', 'https://', 'https://host.invalid:',
    'https://user:password@host.invalid', 'https://@host.invalid',
    'https://host.invalid/path', 'https://host.invalid/..', 'https://host.invalid//',
    'https://host.invalid?token=x', 'https://host.invalid?', 'https://host.invalid#',
    ' https://host.invalid', 'https://host.invalid ', 'https://host.invalid\n',
    'https://host.invalid\\attacker.invalid', 'https://ho%73t.invalid',
  ]
  for (const field of ['supabaseUrl', 'publicSupabaseUrl']) {
    for (const url of invalidUrls) {
      await assert.rejects(() => signPaymentEvidenceAccess({
        ...signingOptions, [field]: url,
        fetchImpl: () => assert.fail('invalid configuration must not fetch'),
      }), /payment_evidence_signing_invalid/, `${field}: ${JSON.stringify(url)}`)
    }
  }
  for (const supabaseUrl of ['http://127.0.0.1:61321', 'http://localhost:61321', 'http://[::1]:61321']) {
    const result = await signPaymentEvidenceAccess({
      ...signingOptions, supabaseUrl,
      fetchImpl: async () => responseFor({ signedURL: `${storagePath}${tokenQuery}` }),
    })
    assert.equal(result.signedUrl, `${supabaseUrl}${publicPath}${tokenQuery}`)
  }
})

test('hostile signing responses fail closed before returning any URL', async () => {
  const invalidPaths = [
    undefined, null, 123, '', storagePath, `${storagePath}?token=`,
    `https://shop.example.invalid${publicPath}${tokenQuery}`,
    `https://attacker.invalid${publicPath}${tokenQuery}`,
    `//attacker.invalid${publicPath}${tokenQuery}`,
    `${publicPath}${tokenQuery}#fragment`, `${publicPath}${tokenQuery}&token=another`,
    `${publicPath}?download=1&token=abc`, `${publicPath}?token=has%20space`,
    `${publicPath}?token=.`, `${publicPath}?token=a..b`, `${publicPath}?token=a/b`,
    `${publicPath}?token=abc\n`,
    ...[storagePath, publicPath].flatMap(path => [
      `${path.replace('shop-payment-evidence', 'another-bucket')}${tokenQuery}`,
      `${path.replace('receipt.png', 'another.png')}${tokenQuery}`,
      `${path.replace('receipt.png', '../receipt.png')}${tokenQuery}`,
      `${path.replace('receipt.png', '%2e%2e/receipt.png')}${tokenQuery}`,
      `${path.replace('receipt.png', '%72eceipt.png')}${tokenQuery}`,
      `${path.replace('receipt.png', 'receipt.png/../receipt.png')}${tokenQuery}`,
      `${path.replace('receipt.png', 'receipt.png\\other')}${tokenQuery}`,
      `${path}/${tokenQuery}`, `/prefix${path}${tokenQuery}`,
      `${path.replace('/sign/', '//sign/')}${tokenQuery}`,
    ]),
  ]
  for (const signedURL of invalidPaths) {
    await assert.rejects(() => signPaymentEvidenceAccess({
      ...signingOptions, fetchImpl: async () => responseFor({ signedURL }),
    }), /payment_evidence_signing_failed/, String(signedURL))
  }
  await assert.rejects(() => signPaymentEvidenceAccess({
    ...signingOptions, fetchImpl: async () => responseFor({ signedURL: `${storagePath}${tokenQuery}` }, 503),
  }), /payment_evidence_signing_failed/)
  await assert.rejects(() => signPaymentEvidenceAccess({
    ...signingOptions, fetchImpl: async () => new Response('not JSON', { status: 200 }),
  }), /payment_evidence_signing_failed/)
})

test('only the explicit billing evidence bridge query selects signed access', () => {
  assert.equal(isPaymentEvidenceAccess({ operation: 'shop.billing.query', payload: { resource: 'evidence' } }), true)
  assert.equal(isPaymentEvidenceAccess({ operation: 'shop.billing.query', payload: { resource: 'queue' } }), false)
  assert.equal(isPaymentEvidenceAccess({ operation: 'shop.billing.command', payload: { resource: 'evidence' } }), false)
})

test('migration keeps evidence private, immutable, bounded and outside approval state', async () => {
  const migration = await readFile(new URL('../../supabase/migrations/20261005120000_private_billing_payment_evidence.sql', import.meta.url), 'utf8')
  const bridge = await readFile(new URL('../../supabase/functions/shop-super-admin-bridge/index.ts', import.meta.url), 'utf8')
  assert.match(migration, /'shop-payment-evidence', 'shop-payment-evidence', false, 5242880/)
  assert.match(migration, /mime_type in \([\s\S]*application\/pdf[\s\S]*image\/webp/)
  assert.match(migration, /count\(\*\)[\s\S]*>= 5/)
  assert.match(migration, /shop_billing_payment_evidence_immutable/)
  assert.match(migration, /submission\.status in \('submitted', 'under_review'\)/)
  assert.doesNotMatch(migration, /update public\.shop_billing_submissions set status = 'approved'/)
  assert.match(migration, /p_expires_in not between 30 and 300/)
  assert.match(bridge, /shop_super_admin_bridge_evidence_access/)
})
