import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
const text = { en: 'Deployed counter update', ar: 'تحديث نقطة البيع المنشور' }
const now = '2026-10-15T12:00:00Z'
const entry = { id: 'deployed', suit: 'shop-suit', visibility: 'public', status: 'released', version: '2.8.0', publishedAt: '2026-10-14T12:00:00Z', releasedAt: '2026-10-14T12:00:00Z', title: text, summary: text, details: text, links: [] }
const suits = [{ id: 'shop-suit', name: { en: 'Shop Suit', ar: 'شوب سوت' } }, { id: 'ledger-suit', name: { en: 'Ledger Suit', ar: 'ليدجر سوت' } }]
const entries = [entry,
  { ...entry, id: 'at-48-hours', version: '2.7.9', publishedAt: '2026-10-13T12:00:00Z', releasedAt: '2026-10-13T12:00:00Z' },
  { ...entry, id: 'old', version: '2.7.8', publishedAt: '2026-10-12T12:00:00Z', releasedAt: '2026-10-12T12:00:00Z' },
  { ...entry, id: 'older', version: '2.7.7', publishedAt: '2026-10-11T12:00:00Z', releasedAt: '2026-10-11T12:00:00Z' },
  { ...entry, id: 'internal', visibility: 'internal', title: {en:'PRIVATE TASK',ar:'خاص'} },
  { ...entry, id: 'future', publishedAt: '2026-11-01T12:00:00Z', title: {en:'Future claim',ar:'مستقبلي'} },
  { ...entry, id: 'other-suit', suit: 'ledger-suit', title: {en:'Ledger only',ar:'ليدجر فقط'} },
  { id: 'planned', suit: 'shop-suit', visibility: 'public', status: 'coming-soon', targetVersion: '3.0.0', publishedAt: entry.publishedAt, title: {en:'Planned claim',ar:'مخطط'}, summary:text,details:text,links:[] },
]
// More than three notes in one target release exercises entry limiting independently of grouping.
for (let index = 0; index < 4; index++) entries.push({ ...entries.at(-1)!, id: `planned-${index}` })
for (const locale of ['en','ar'] as const) for (const theme of ['light','dark'] as const) {
  test(`${locale} ${theme}: landing defaults to released entries and separates upcoming work`, async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
    await page.addInitScript(theme => { localStorage.setItem('building-suit.theme',theme); Date.now=()=>0 },theme)
    await page.route('**/api/changelog',route=>route.fulfill({json:{serverNow:now,suits,entries}}))
    await page.goto('/')
    const section=page.locator('#whats-new')
    await section.scrollIntoViewIfNeeded()
    await expect(section.getByRole('heading',{name:locale==='ar'?'ما الجديد':'What’s new',exact:true})).toBeVisible()
    await expect(section.locator('article')).toHaveCount(3)
    await expect(section.locator('[data-entry="planned"]')).toHaveCount(0)
    await expect(section.locator('[data-entry="planned"] [data-status="new"]')).toHaveCount(0)
    await expect(section.getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(1)
    await expect(section.locator('.bs-changelog')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr')
    for(const id of ['internal','future','other-suit','older']) await expect(section.locator(`[data-entry="${id}"]`)).toHaveCount(0)
    const tabs = section.getByRole('tab')
    await tabs.nth(0).focus()
    await page.keyboard.press(locale === 'ar' ? 'ArrowLeft' : 'ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(section.locator('article')).toHaveCount(3)
    await expect(section.locator('bdi, time')).toHaveCount(0)
    await page.keyboard.press('Home')
    await expect(section.locator('article')).toHaveCount(3)
    const fullLink = section.getByRole('link', { name: locale === 'ar' ? 'عرض سجل التحديثات الكامل' : 'View the full changelog' })
    await expect(fullLink).toHaveCSS('color', 'rgb(216, 155, 66)')
    await page.getByRole('button', { name: locale === 'ar' ? 'رفض الاختياري' : 'Reject optional', exact: true }).click()
    await page.setViewportSize({width:390,height:844})
    expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBeTruthy()
    await section.screenshot({path:testInfo.outputPath(`${locale}-${theme}-landing.png`)})
    await section.getByRole('link',{name:locale==='ar'?'عرض سجل التحديثات الكامل':'View the full changelog'}).click()
    await expect(page).toHaveURL(/\/changelog$/)
    await expect(page.locator('main .bs-changelog article')).toHaveCount(4)
    await expect(page.locator('main .bs-changelog [data-entry="older"]')).toHaveCount(1)
    await expect(page.locator('main .bs-changelog').getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(1)
    for(const id of ['internal','future','other-suit']) await expect(page.locator(`main [data-entry="${id}"]`)).toHaveCount(0)
    await page.locator('main .bs-changelog').getByRole('tab').nth(1).click()
    await expect(page.locator('main .bs-changelog article')).toHaveCount(5)
    await expect(page.locator('main .bs-changelog bdi, main .bs-changelog time')).toHaveCount(0)

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
  await expect(section.getByText('No released updates yet')).toBeVisible()
  await expect(section.getByRole('link',{name:'View the full changelog'})).toBeVisible()
})
test('resuming and navigating refreshes the trusted clock without resetting first publication',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.context().addCookies([{name:'building-suit-locale',value:'en',url:'http://127.0.0.1:4393'}])
  let serverNow=now,calls=0
  await page.route('**/api/changelog',route=>{calls++;return route.fulfill({json:{serverNow,suits,entries:[entry]}})})
  await page.goto('/')
  const section=page.locator('#whats-new')
  await expect(section.getByText('New',{exact:true})).toHaveCount(1)
  const publication=await section.locator('time').first().getAttribute('datetime')
  const before=calls
  serverNow='2026-10-16T12:00:00Z'
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await expect.poll(()=>calls).toBeGreaterThan(before)
  await expect(section.locator('article')).toHaveCount(1)
  await expect(section.getByText('New',{exact:true})).toHaveCount(0)
  expect(await section.locator('time').first().getAttribute('datetime')).toBe(publication)
  await section.getByRole('link',{name:'View the full changelog'}).click()
  await expect(page.locator('main .bs-changelog article')).toHaveCount(1)
  await expect(page.locator('main .bs-changelog').getByText('New',{exact:true})).toHaveCount(0)
})

for (const locale of ['en','ar'] as const) test(`${locale}: actual batch promotion feed keeps at most three newest entries in the teaser`,async({page},testInfo)=>{
  test.setTimeout(60000)
  const output=testInfo.outputPath('promoted-public-feed.json')
  // This creates only uniquely named disposable Docker databases; the output is the actual anon RPC projection.
  execFileSync(process.execPath,['tooling/releases/catalog-disposable.mjs','--public-feed',output],{
    cwd:fileURLToPath(new URL('../../../../',import.meta.url)),timeout:45000,stdio:'pipe',
  })
  const feed=JSON.parse(readFileSync(output,'utf8'))
  const publishedAt=feed.entries[0].publishedAt
  expect(new Set(feed.entries.map((row:{publishedAt:string})=>row.publishedAt)).size).toBe(1)
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
  await page.addInitScript(()=>{Date.now=()=>0})
  // Deliberately scramble server delivery order; neither MD5 IDs nor response position may decide newest.
  await page.route('**/api/changelog',route=>route.fulfill({json:{...feed,entries:[...feed.entries].reverse()}}))
  await page.goto('/')
  const section=page.locator('#whats-new')
  await expect(section.locator('article')).toHaveCount(3)
  await expect(section.locator('article bdi')).toHaveText(['3.0.3','3.0.3','3.0.2'])
  await expect(section.getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(3)
  expect(await section.locator('time[datetime]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('datetime')))).toEqual(Array(3).fill(publishedAt))
  await section.getByRole('link',{name:locale==='ar'?'عرض سجل التحديثات الكامل':'View the full changelog'}).click()
  await expect(page.locator('main .bs-changelog article')).toHaveCount(10)
  await expect(page.locator('main .bs-changelog article bdi')).toHaveText(['3.0.3','3.0.3','3.0.2','3.0.2','3.0.2','3.0.1','3.0.1','3.0.0','3.0.0','2.8.0'])
  await page.unroute('**/api/changelog')
  const serverNow=new Date(Date.parse(publishedAt)+48*60*60*1000).toISOString()
  await page.route('**/api/changelog',route=>route.fulfill({json:{...feed,serverNow}}))
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.locator('main .bs-changelog article')).toHaveCount(10)
  await expect(page.locator('main .bs-changelog').getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(0)
  expect(await page.locator('main .bs-changelog time').first().getAttribute('datetime')).toBe(publishedAt)
})

for (const locale of ['en','ar'] as const) test(`${locale}: actual evolving candidate stays in its separate tab`,async({page},testInfo)=>{
  test.setTimeout(60000)
  const output=testInfo.outputPath('candidate-public-feed.json')
  execFileSync(process.execPath,['tooling/releases/catalog-disposable.mjs','--candidate-feed',output],{
    cwd:fileURLToPath(new URL('../../../../',import.meta.url)),timeout:45000,stdio:'pipe',
  })
  const feed=JSON.parse(readFileSync(output,'utf8'))
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
  await page.route('**/api/changelog',route=>route.fulfill({json:feed}))
  await page.goto('/')
  const section=page.locator('#whats-new')
  await expect(section.locator('article')).toHaveCount(2)
  await expect(section.locator('[data-release]')).toHaveCount(1)
  await section.getByRole('tab').nth(1).click()
  await expect(section.locator('article')).toHaveCount(1)
  await expect(section.locator('bdi, time')).toHaveCount(0)
  await expect(section.locator('article').first().getByText(locale==='ar'?'مراجعة العمل القادم':'Review upcoming work',{exact:true})).toHaveCount(1)
  await section.getByRole('link').last().click()
  const timeline = page.locator('main .bs-changelog')
  await expect(timeline.locator('article')).toHaveCount(2)
  await timeline.getByRole('tab').nth(1).click()
  await expect(timeline.locator('article')).toHaveCount(1)
  await page.getByRole('button',{name:locale==='en'?'Language · Theme':'اللغة · المظهر',exact:true}).first().click()
  await page.getByRole('menuitemradio',{name:locale==='en'?'العربية':'English',exact:true}).click()
  await expect(page.locator('main .bs-changelog')).toHaveAttribute('dir',locale==='en'?'rtl':'ltr')
  await expect(page.locator('main .bs-changelog article').first().getByText(locale==='en'?'مراجعة العمل القادم':'Review upcoming work',{exact:true}).first()).toBeVisible()
})

for(const locale of ['en','ar'] as const) test(`${locale}: empty state describes only the selected status`,async({page})=>{
  await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
  let currentEntries=entries.filter(row=>row.status==='coming-soon')
  await page.route('**/api/changelog',route=>route.fulfill({json:{serverNow:now,suits,entries:currentEntries}}))
  await page.goto('/changelog')
  const timeline=page.locator('main .bs-changelog')
  await expect(timeline.getByText(locale==='ar'?'لا توجد إصدارات منشورة بعد':'No released updates yet',{exact:true})).toBeVisible()
  await timeline.getByRole('tab').nth(1).click()
  await expect(timeline.locator('article')).toHaveCount(5)
  currentEntries=entries.filter(row=>row.status==='released')
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
  await expect(timeline.getByText(locale==='ar'?'لا توجد تحديثات قادمة في هذا التبويب':'No upcoming updates in this tab',{exact:true})).toBeVisible()
})

for(const locale of ['en','ar'] as const) test(`${locale}: retrospective milestones show version, verified date and explicit numbering label`,async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'})
  const plan=JSON.parse(readFileSync(new URL('../../../../tooling/releases/retrospective-shop.json',import.meta.url),'utf8'))
  const history=plan.releases.map((row:{version:string;releasedAt:string;notes:object})=>({id:`history-${row.version}`,suit:'shop-suit',visibility:'public',status:'released',version:row.version,versionOrigin:'retrospective',releasedAt:row.releasedAt,publishedAt:'2026-10-16T18:00:00Z',...row.notes,links:[]}))
  await page.context().addCookies([{name:'building-suit-locale',value:locale,url:'http://127.0.0.1:4393'}])
  await page.route('**/api/changelog',route=>route.fulfill({json:{serverNow:'2026-10-16T18:00:00Z',suits,entries:history}}))
  await page.goto('/')
  const section=page.locator('#whats-new')
  await section.scrollIntoViewIfNeeded()
  await expect(section.locator('article')).toHaveCount(3)
  await page.getByRole('button',{name:locale==='ar'?'رفض الاختياري':'Reject optional',exact:true}).click()
  await expect(section.locator('article bdi')).toHaveText(['0.4.0','0.3.0','0.2.0'])
  await expect(section.getByText(locale==='ar'?'ترقيم بأثر رجعي':'Retrospective version',{exact:true})).toHaveCount(3)
  await expect(section.getByText(locale==='ar'?'جديد':'New',{exact:true})).toHaveCount(0)
  await expect(section.locator('article time').first()).toHaveAttribute('datetime','2026-10-14T11:29:16.099Z')
  await section.getByRole('link').last().click()
  const timeline=page.locator('main .bs-changelog')
  await expect(timeline.locator('article')).toHaveCount(4)
  await timeline.getByRole('tab').nth(1).click()
  await expect(timeline.getByText(locale==='ar'?'لا توجد تحديثات قادمة في هذا التبويب':'No upcoming updates in this tab',{exact:true})).toBeVisible()
})
