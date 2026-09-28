import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'

const messages = Object.fromEntries(['en', 'ar'].map(locale => [locale, JSON.parse(readFileSync(new URL(`../../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))]))

function flatten(value, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object') flatten(child, path, result)
    else result[path] = child
  }
  return result
}

function placeholders(value) {
  return [...new Set([...value.matchAll(/\{[^}]+\}/g)].map(match => match[0]))].sort()
}

test('English and Arabic locale trees have identical keys and interpolation contracts', () => {
  const en = flatten(messages.en)
  const ar = flatten(messages.ar)
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort())
  for (const key of Object.keys(en)) {
    assert.equal(typeof ar[key], typeof en[key], key)
    if (typeof en[key] === 'string') assert.deepEqual(placeholders(ar[key]), placeholders(en[key]), key)
  }
})

test('Arabic copy does not leak raw locale implementation keys', () => {
  const ar = flatten(messages.ar)
  for (const [key, value] of Object.entries(ar)) {
    assert.ok(!/^(?:common|auth|billing|migration|admin|support|errors)\.[A-Za-z0-9_.-]+$/.test(value), key)
  }
})
