import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import { saleCopy } from '../../app/utils/saleCopy.js'

const sensitiveKeys = ['sales.issueConfirm', 'sales.checkoutConfirm', 'sales.fastPayConfirm', 'sales.stockNotice', 'sales.issuedSuccess', 'sales.checkoutSuccess', 'sales.insufficientStock', 'pos.confirm', 'pos.serverTotal', 'pos.insufficientStock', 'saleCorrections.warning', 'saleCorrections.confirm']
for (const locale of ['en', 'ar']) {
  const source = await readFile(new URL(`../../i18n/locales/${locale}.ts`, import.meta.url), 'utf8')
  const messages = await vm.runInNewContext(source.replace('export default ', ''), { defineI18nLocale: fn => fn })()
  const translate = (key, values = {}) => {
    const message = key.split('.').reduce((value, part) => value?.[part], messages)
    assert.equal(typeof message, 'string', `Missing ${locale} translation: ${key}`)
    return message.replace(/\{(\w+)\}/g, (_, name) => { assert.ok(name in values, `Missing ${name}`); return values[name] })
  }
  for (const kind of ['product', 'service', 'mixed']) {
    const lines = (kind === 'mixed' ? ['product', 'service'] : [kind]).map(item_type => ({ item_type }))
    test(`${locale} audit: ${kind} messages describe only the actual line inventory effects`, () => {
      for (const key of sensitiveKeys) {
        const message = saleCopy(translate, key, lines, { amount: '100 EGP', method: 'Card' })
        assert.doesNotMatch(message, /\{\w+\}/)
        if (kind === 'service') {
          assert.doesNotMatch(message, /FIFO|deduct|restor(?:ed|ation)|not enough|هيتخصم|اتخصم|هيرجع|لا يكفي/i, `${key}: ${message}`)
        } else if (['Confirm', 'stockNotice', 'issuedSuccess', 'checkoutSuccess', 'warning', 'confirm'].some(suffix => key.endsWith(suffix))) {
          assert.match(message, /FIFO/, key)
        }
        if (kind === 'mixed') assert.match(message, locale === 'en' ? /service lines/i : /بنود الخدمات/, key)
      }
      const effects = messages.sales.inventoryCopy[kind]
      assert.deepEqual(Object.keys(effects).sort(), ['check', 'effect', 'error', 'restore', 'result'])
    })
  }
}

test('audit: every inventory-sensitive page message uses line-aware translation', async () => {
  for (const path of ['sales/index.vue', 'sales/[id]/index.vue', 'pos.vue']) {
    const source = await readFile(new URL(`../../app/pages/${path}`, import.meta.url), 'utf8')
    for (const key of sensitiveKeys) {
      assert.ok(!source.includes(`t('${key}'`), `${path} bypasses line types for ${key}`)
    }
  }
})

test('audit: remaining fixed inventory copy describes catalog stock or observed history only', async () => {
  const intentional = new Set(['sales.inventoryTrace', 'sales.noInventoryEffect', 'sales.batch', 'saleCorrections.restored', 'pos.stock'])
  for (const locale of ['en', 'ar']) {
    const source = await readFile(new URL(`../../i18n/locales/${locale}.ts`, import.meta.url), 'utf8')
    const messages = await vm.runInNewContext(source.replace('export default ', ''), { defineI18nLocale: fn => fn })()
    for (const section of ['sales', 'pos', 'saleCorrections']) {
      for (const [key, value] of Object.entries(messages[section])) {
        if (typeof value !== 'string' || !/stock|inventory|FIFO|مخزون/iu.test(value)) continue
        const path = `${section}.${key}`
        assert.ok(intentional.has(path) || /\{inventory\w+\}/u.test(value), `Review unconditional inventory wording: ${locale} ${path}: ${value}`)
      }
    }
  }
})
