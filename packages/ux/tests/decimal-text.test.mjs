import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeDecimalText } from '../src/utils/decimalText.js'
test('Arabic and Persian decimal entry retains exact high precision as strings', () => {
 assert.equal(normalizeDecimalText(' ٩٩٩٩٩٩٩٩٩٩٩٩٫٩٩٩٩٩٩ '),'999999999999.999999')
 assert.equal(normalizeDecimalText('۹۹۹۹۹۹۹۹۹۹٫۱۲۳۴۵۶۷۸۹۰۱۲'),'9999999999.123456789012')
 assert.equal(normalizeDecimalText('٠٠١٠٠٠٫٠٠'),'1000.00')
})
test('decimal normalization preserves signs and every fraction without floating arithmetic', () => {
 for (const value of ['0','0.000001','1000.00','9999999999.999999999999','-0.000001']) assert.equal(normalizeDecimalText(value),value)
 assert.equal(normalizeDecimalText('−٠٫٠٠٠٠٠١'),'-0.000001')
})
test('grouping, exponents and hidden controls remain invalid for canonical decimal validation', () => {
 const decimal = /^-?[0-9]+(?:\.[0-9]+)?$/
 for (const value of ['١٬٠٠٠٫٠٠','1,000.00','1e6','١ ٢','\u200f١٠٠']) assert.equal(decimal.test(normalizeDecimalText(value)),false)
})
