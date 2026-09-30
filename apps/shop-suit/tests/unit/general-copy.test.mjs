import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

const browserRoots = [
  new URL('../../app/', import.meta.url),
  new URL('../../i18n/', import.meta.url),
]
const allowedBarberLiterals = new Set([
  // The role and industry labels are genuinely optional barber-specific copy.
  'barber',
  'Barber / operator',
  'حلاق / مقدم خدمة',
  'Barbers',
  'الحلاقين',
  // This existing DOM id is internal and is not browser-facing copy.
  'barber-setup-title',
  'copy.barber',
])
const barberOnly = /\b(?:barber(?:s|shop)?|salons?)\b|حلاق|حلاقة|صالون/iu

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
    if (entry.isDirectory()) return sourceFiles(url)
    return /\.(?:ts|vue)$/.test(entry.name) ? [url] : []
  }))
  return nested.flat()
}

function stringLiterals(source) {
  return [...source.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map(match => match[2])
}

test('general browser copy does not assume the shop is a barber business', async () => {
  const files = (await Promise.all(browserRoots.map(sourceFiles))).flat()
  const violations = []
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const literal of stringLiterals(source)) {
      if (barberOnly.test(literal) && !allowedBarberLiterals.has(literal)) {
        violations.push(`${file.pathname.split('/apps/shop-suit/')[1]}: ${literal}`)
      }
    }
  }
  assert.deepEqual(violations, [])
})

test('dashboard setup and POS staff copy stay neutral in English and Arabic', async () => {
  const guide = await readFile(new URL('../../app/components/BarberSetupGuide.vue', import.meta.url), 'utf8')
  const english = await readFile(new URL('../../i18n/locales/en.ts', import.meta.url), 'utf8')
  const arabic = await readFile(new URL('../../i18n/locales/ar.ts', import.meta.url), 'utf8')

  for (const expected of [
    'Prepare your shop for its first customer',
    'Services and durations',
    'جهّز متجرك لاستقبال أول عميل',
    'الخدمات ومددها',
  ]) assert.match(guide, new RegExp(expected))
  assert.match(english, /staff: 'Staff member'/)
  assert.match(arabic, /staff: 'الموظف'/)
})
