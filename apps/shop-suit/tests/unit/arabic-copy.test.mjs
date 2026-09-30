import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const files = {
  locale: new URL('../../i18n/locales/ar.ts', import.meta.url),
  signup: new URL('../../app/pages/auth/signup.vue', import.meta.url),
  dashboard: new URL('../../app/pages/dashboard.vue', import.meta.url),
  appointments: new URL('../../app/pages/appointments/index.vue', import.meta.url),
  cashShifts: new URL('../../app/pages/cash-shifts.vue', import.meta.url),
  billing: new URL('../../app/pages/billing.vue', import.meta.url),
  team: new URL('../../app/pages/team.vue', import.meta.url),
  expenses: new URL('../../app/pages/expenses/index.vue', import.meta.url),
  reports: new URL('../../app/pages/reports/index.vue', import.meta.url),
  products: new URL('../../app/pages/products/index.vue', import.meta.url),
  services: new URL('../../app/pages/services/index.vue', import.meta.url),
  catalogImport: new URL('../../app/pages/catalog-import.vue', import.meta.url),
  settings: new URL('../../app/pages/settings.vue', import.meta.url),
  convention: new URL('../../docs/arabic-copy.md', import.meta.url),
}

async function sources() {
  return Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, file]) => [name, await readFile(file, 'utf8')])))
}

test('primary owner journeys keep natural Egyptian action and recovery copy', async () => {
  const source = await sources()
  const expected = {
    locale: ['حاول تاني', 'مقدرناش نحفظ العميل', 'مفيش مبالغ مستحقة', 'حصّل {amount}'],
    signup: ['اكتب كود التأكيد', 'مقدرناش نكمّل التسجيل', 'ابعت كود جديد'],
    dashboard: ['شوف المبيعات والتحصيلات والمواعيد', 'ده ملخص للشغل بس'],
    appointments: ['مفيش عملاء مستنيين', 'تسجل إن العميل ماجاش؟'],
    cashShifts: ['مقدرناش نحمّل ورديات الخزنة', 'تقفل الوردية'],
    billing: ['ابعت إشعار الدفع', 'بنراجعها يدويًا', 'مقدرناش نبعت إشعار الدفع'],
    team: ['ضيف الموظفين', 'مفيش أعضاء في الفريق لسه', 'مقدرناش نحمّل الفريق'],
    expenses: ['الفلوس اللي المتجر صرفها', 'الفترة المحاسبية دي مقفولة', 'مقدرناش نحفظ المصروف'],
    reports: ['دي تقارير للشغل بس', 'مبالغ مستحقة من العملاء', 'مقدرناش نحمّل التقرير'],
    products: ['ضيف منتجات متجرك', 'مفيش منتجات لسه', 'مقدرناش نحفظ المنتج'],
    services: ['ظبط الخدمات وأسعارها', 'مفيش خدمات لسه', 'مقدرناش نحفظ الخدمة'],
    catalogImport: ['بعد ما تفحصها', 'فحص من غير حفظ', 'مقدرناش نقرا الملف'],
    settings: ['ظبط طريقة الشغل', 'مقدرناش نحدّث ملف المتجر', 'مقدرناش نحفظ الفرع'],
  }

  for (const [file, phrases] of Object.entries(expected)) {
    for (const phrase of phrases) assert.ok(source[file].includes(phrase), `${file} must keep: ${phrase}`)
  }
})

test('plain explanations retain operational and compliance precision', async () => {
  const source = await sources()
  assert.match(source.locale, /FIFO \(الأقدم يتباع الأول\)/)
  assert.match(source.locale, /فترة محاسبية مقفولة/)
  assert.match(source.locale, /مش معناه إن فلوس هتخرج/)
  assert.match(source.locale, /ليس فاتورة ضريبية مصرية أو إيصالًا إلكترونيًا معتمدًا من مصلحة الضرائب/)
  assert.match(source.billing, /مش هيتغيّر غير بعد اعتماد مسؤول المنصة/)
  assert.match(source.convention, /المعنى المرجعي|meaning reference/)
})

test('the maintained convention documents concise RTL review', async () => {
  const { convention } = await sources()
  for (const phrase of ['phone', 'tablet', 'desktop', 'RTL', 'Keep the same meaning as English']) {
    assert.ok(convention.includes(phrase), `convention must cover ${phrase}`)
  }
})
