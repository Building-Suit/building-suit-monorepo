import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

// Exercise the translation runtime actually selected by the app's Nuxt module.
const appRequire = createRequire(new URL('../../apps/ledger-suit/package.json', import.meta.url))
const integrationRequire = createRequire(appRequire.resolve('@nuxtjs/i18n'))
const { createI18n } = integrationRequire('vue-i18n')
const composer = (messages, options = {}) => createI18n({
  legacy: false, locale: 'en', fallbackLocale: 'en', escapeParameter: true,
  warnHtmlMessage: false, missingWarn: false, fallbackWarn: false,
  messages, ...options,
}).global

test('translation escaping protects both named values and list values in one call', () => {
  const runtime = composer({ en: { combined: '{0} / {label}' } })
  const named = { label: '<strong>named marker</strong>' }
  const result = runtime.t('combined', ['<em>list marker</em>'], { named })
  assert.doesNotMatch(result, /[<>]/)
  assert.match(result, /list marker/)
  assert.match(result, /named marker/)
  assert.deepEqual(named, { label: '<strong>named marker</strong>' })
})

test('translation escaping preserves caller values and identical repeated output', () => {
  const runtime = composer({ en: { name: 'Account: {label}' } })
  const named = { label: '<strong>unchanged marker</strong>' }
  const first = runtime.t('name', named)
  const second = runtime.t('name', named)
  assert.equal(second, first)
  assert.deepEqual(named, { label: '<strong>unchanged marker</strong>' })
  assert.doesNotMatch(first, /[<>]/)
})

test('translated HTML cannot retain an executable iframe srcdoc attribute', () => {
  const runtime = composer({ en: {
    literal: '<iframe srcdoc="<strong>synthetic nested document</strong>"></iframe>',
    parameter: '<iframe srcdoc="{body}"></iframe>',
    combined: '{0} / {label}',
  } })
  const body = '<strong>synthetic parameter document</strong>'
  for (const html of [runtime.t('literal'), runtime.t('parameter', { body })]) {
    assert.doesNotMatch(html, /\ssrcdoc\s*=/i)
  }
  const combined = runtime.t('combined', ['safe'], {
    named: { label: '<iframe srcdoc="synthetic"></iframe>' },
  })
  assert.doesNotMatch(combined, /<iframe\b/i)
})

test('ordinary English and Arabic interpolation, fallback and currency formatting remain usable', () => {
  const runtime = composer({
    en: { account: 'Account: {label}', fallback: 'Ledger fallback' },
    ar: { account: 'الحساب: {label}' },
  }, { numberFormats: {
    en: { money: { style: 'currency', currency: 'EGP' } },
    ar: { money: { style: 'currency', currency: 'EGP' } },
  } })
  assert.equal(runtime.t('account', { label: 'Cash' }), 'Account: Cash')
  assert.equal(runtime.n(1234.5, 'money'), new Intl.NumberFormat('en', { style: 'currency', currency: 'EGP' }).format(1234.5))
  runtime.locale.value = 'ar'
  assert.equal(runtime.t('account', { label: 'النقدية' }), 'الحساب: النقدية')
  assert.equal(runtime.t('fallback'), 'Ledger fallback')
  assert.equal(runtime.n(1234.5, 'money'), new Intl.NumberFormat('ar', { style: 'currency', currency: 'EGP' }).format(1234.5))
})
