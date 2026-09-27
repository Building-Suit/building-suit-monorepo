import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const appRoot = new URL('../../', import.meta.url)
const read = relative => readFileSync(new URL(relative, appRoot), 'utf8')

function sourceFiles(directory) {
  const absolute = new URL(directory, appRoot)
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(`${relative}/`) : [relative]
  })
}

test('browser-reachable Ledger source contains no server-secret identifiers', () => {
  const forbidden = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'PAYMOB_SECRET_KEY',
    'PAYMOB_HMAC_SECRET',
    'RESEND_API_KEY',
    'ledger_suit_service_role_key',
  ]
  const browserSources = sourceFiles('app/').filter(file => /\.(?:ts|vue|css)$/.test(file))
  const violations = browserSources.flatMap(file => forbidden
    .filter(identifier => read(file).includes(identifier))
    .map(identifier => `${file}: ${identifier}`))
  assert.deepEqual(violations, [])
})

test('deployed browser examples expose only the publishable Supabase contract', () => {
  for (const file of ['.env.staging.example', '.env.production.example']) {
    const publicNames = read(file).split('\n')
      .map(line => line.match(/^(NUXT_PUBLIC_[A-Z0-9_]+)=/)?.[1])
      .filter(Boolean)
    assert.deepEqual(publicNames, [
      'NUXT_PUBLIC_SUPABASE_URL',
      'NUXT_PUBLIC_SUPABASE_KEY',
      'NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX',
    ], file)
  }
})

test('Edge Function JWT exceptions are limited to verified webhook and service workers', () => {
  const config = read('supabase/config.toml')
  const configured = [...config.matchAll(/\[functions\.([^\]]+)\]\s*\nverify_jwt = (true|false)/g)]
    .map(([, name, verify]) => [name, verify === 'true'])
  assert.deepEqual(configured, [
    ['paymob-checkout', true],
    ['paymob-webhook', false],
    ['scheduled-notifications', false],
    ['storage-cleanup', false],
    ['send-invitation', true],
  ])

  const webhook = read('supabase/functions/paymob-webhook/index.ts')
  const subscriptionHandler = webhook.slice(
    webhook.indexOf('async function processSubscriptionCallback'),
    webhook.indexOf('Deno.serve'),
  )
  assert.ok(subscriptionHandler.indexOf('verifyPaymobSubscriptionHmac') >= 0)
  assert.ok(subscriptionHandler.indexOf('verifyPaymobSubscriptionHmac') < subscriptionHandler.indexOf('const admin = adminClient()'))

  const transactionHandler = webhook.slice(webhook.indexOf('Deno.serve'))
  assert.ok(transactionHandler.indexOf('verifyPaymobTransactionHmac') >= 0)
  assert.ok(transactionHandler.indexOf('verifyPaymobTransactionHmac') < transactionHandler.indexOf('const admin = adminClient()'))
  assert.ok(transactionHandler.indexOf('checkoutMetadata(object)') < transactionHandler.indexOf('const admin = adminClient()'))
  assert.match(transactionHandler, /sanitizePaymobPayload\(callback\)/)

  for (const file of [
    'supabase/functions/paymob-checkout/index.ts',
    'supabase/functions/send-invitation/index.ts',
  ]) assert.match(read(file), /authenticatedClient\(request\)/, file)

  for (const file of [
    'supabase/functions/scheduled-notifications/index.ts',
    'supabase/functions/storage-cleanup/index.ts',
  ]) {
    const worker = read(file)
    assert.match(worker, /Bearer \$\{requiredEnv\('SUPABASE_SERVICE_ROLE_KEY'\)\}/, file)
    assert.match(worker, /request\.headers\.get\('Authorization'\) !== expected/, file)
  }
})
