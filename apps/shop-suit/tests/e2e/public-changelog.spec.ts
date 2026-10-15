import { test, expect } from '@playwright/test'
const text = { en: 'Deployed counter update', ar: 'تحديث نقطة البيع المنشور' }
const now = '2026-10-15T12:00:00Z'
const entry = { id: 'deployed', suit: 'shop-suit', visibility: 'public', status: 'released', version: '2.8.0', publishedAt: '2026-10-14T12:00:00Z', releasedAt: '2026-10-14T12:00:00Z', title: text, summary: text, details: text, links: [] }
const suits = [{ id: 'shop-suit', name: { en: 'Shop Suit', ar: 'شوب سوت' } }, { id: 'ledger-suit', name: { en: 'Ledger Suit', ar: 'ليدجر سوت' } }]
const entries = [entry,
  { ...entry, id: 'at-48-hours', publishedAt: '2026-10-13T12:00:00Z', releasedAt: '2026-10-13T12:00:00Z' },
  { ...entry, id: 'old', publishedAt: '2026-10-12T12:00:00Z', releasedAt: '2026-10-12T12:00:00Z' },
  { ...entry, id: 'older', publishedAt: '2026-10-11T12:00:00Z', releasedAt: '2026-10-11T12:00:00Z' },
  { ...entry, id: 'internal', visibility: 'internal', title: {en:'PRIVATE TASK',ar:'خاص'} },
  { ...entry, id: 'future', publishedAt: '2026-11-01T12:00:00Z', title: {en:'Future claim',ar:'مستقبلي'} },
  { ...entry, id: 'other-suit', suit: 'ledger-suit', title: {en:'Ledger only',ar:'ليدجر فقط'} },
  { id: 'planned', suit: 'shop-suit', visibility: 'public', status: 'coming-soon', targetVersion: '3.0.0', publishedAt: entry.publishedAt, title: {en:'Planned claim',ar:'مخطط'}, summary:text,details:text,links:[] },
]
for (const locale of ['en','ar'] as const) for (const theme of ['light','dark'] as const) {
  test(`${locale} ${theme}: landing discovers only deployed Shop releases and links to full history`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
    await page.addInitScript(theme => { localStorage.setItem('building-suit.theme',theme); Date.now=()=>0 },theme)
    await page.route('**/api/changelog',route=>route.fulfill({json:{serverNow:now,suits,entries}}))
    await page.goto('/')
    const section=page.locator('#whats-new')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('heading',{name:locale==='ar'?'ما الجديد':'What’s new',exact:true})).toBeVisible()
    await expect(section.locator('article')).toHaveCount(3)
    await expect(section.getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(1)
    await expect(section.locator('.bs-changelog')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr')
    for(const id of ['internal','future','other-suit','planned','older']) await expect(section.locator(`[data-entry="${id}"]`)).toHaveCount(0)
    await page.setViewportSize({width:390,height:844})
    expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy()
    await section.screenshot({path:testInfo.outputPath(`${locale}-${theme}-landing.png`)})
    await section.getByRole('link',{name:locale==='ar'?'عرض سجل التحديثات الكامل':'View the full changelog'}).click()
    await expect(page).toHaveURL(/\/changelog$/)
    await expect(page.locator('main .bs-changelog article')).toHaveCount(4)
    await expect(page.locator('main .bs-changelog [data-entry="older"]')).toHaveCount(1)
    await expect(page.locator('main .bs-changelog').getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(1)
    for(const id of ['internal','future','other-suit','planned']) await expect(page.locator(`main [data-entry="${id}"]`)).toHaveCount(0)
  })
}
test('landing failure retries to an empty public feed without fixture announcements',async({page})=>{
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.context().addCookies([{name:'building-suit-locale',value:'en',url:'http://127.0.0.1:4393'}])
  let fail=true
  await page.route('**/api/changelog',route=>fail?route.fulfill({status:503,json:{message:'Unavailable'}}):route.fulfill({json:{serverNow:now,suits,entries:[]}}))
  await page.goto('/')
  const section=page.locator('#whats-new')
  await expect(section.getByText('Unable to load updates')).toBeVisible()
  await expect(section.locator('article')).toHaveCount(0)
  fail=false
  await section.getByRole('button',{name:'Retry'}).click()
  await expect(section.getByText('No published updates yet')).toBeVisible()
  await expect(section.getByRole('link',{name:'View the full changelog'})).toBeVisible()
})
