import {drainLoopbackRoutes} from '../fixtures/loopback-teardown'
import {test,expect,type Page} from '@playwright/test'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
import {websiteLaunchApiPorts} from './website-launch-fixture-server.mjs'
const hosts=/^https:\/\/(?:[a-z-]+\.shops\.building-suit\.com|shop\.building-suit\.com)\//
test.afterEach(async({page},info)=>drainLoopbackRoutes(page,info,hosts))
async function mounted(page:Page){await page.waitForFunction(()=>{const root=document.getElementById('__nuxt') as HTMLElement&{__vue_app__?:{config:{globalProperties:{$nuxt:{isHydrating:boolean}}}}};return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating===false})}
async function keyboardChoice(page:Page,label:string){const field=page.getByRole('combobox',{name:label,exact:true});await field.focus();await field.press('Enter');await field.press('ArrowDown');await field.press('Enter');await expect(page.getByRole('listbox')).toHaveCount(0)}
async function transport(page:Page){await page.route(hosts,async route=>{const request=route.request(),url=new URL(request.url());const response=await route.fetch({url:'http://127.0.0.1:4341'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0,maxRetries:request.method()==='GET'?1:0});await route.fulfill({response})})}
async function semantics(page:Page,locale:'en'|'ar'){await expect(page.locator('html')).toHaveAttribute('lang',locale);await expect(page.locator('html')).toHaveAttribute('dir',locale==='ar'?'rtl':'ltr');await expect(page.getByRole('main')).toHaveCount(1);await expect(page.getByRole('heading',{level:1})).toHaveCount(1);await expectNoPageOverflow(page);await page.keyboard.press('Tab');expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('BODY')}
test.beforeEach(async({request})=>{await request.post(`http://127.0.0.1:${websiteLaunchApiPorts.production}/control`,{data:{reset:true}})})
for(const locale of ['en','ar'])for(const width of [390,820,1440])for(const theme of ['light','dark'])test(`launch owner-published/customer journey ${locale} ${width} ${theme}`,async({page,context,request})=>{
 const ar=locale==='ar';await page.setViewportSize({width,height:1000});await page.addInitScript(v=>localStorage.setItem('building-suit.theme',v),theme);await transport(page)
 const url='https://alpha-tools.shops.building-suit.com/',suffix=ar?'':'?lang=en'
 const initial=await page.goto(url+suffix);await mounted(page);expect(initial?.headers()['cache-control']).toBe('private, no-store');expect(await initial?.text()).not.toMatch(/LEAK-|PRIVATE|Guest launch/)
 await expect(page.getByRole('heading',{name:'Alpha Tools',exact:true})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr');await semantics(page,locale)
 const book=page.getByRole('link',{name:ar?'حجز موعد':'Book an appointment',exact:true});await book.focus();await page.keyboard.press('Enter');await mounted(page)
 await keyboardChoice(page,ar?'الخدمة والموقع والموظف':'Service, location and staff');await page.getByRole('button',{name:ar?'عرض الأوقات':'Show times',exact:true}).click();await keyboardChoice(page,ar?'الوقت المتاح':'Available time');await semantics(page,locale)
 await page.getByRole('textbox',{name:ar?'الاسم':'Name',exact:true}).fill('Guest launch');await page.getByRole('textbox',{name:ar?'رقم الهاتف':'Phone number',exact:true}).fill('+201000000002');await page.getByRole('button',{name:ar?'تأكيد الحجز':'Confirm booking',exact:true}).click();await expect(page.locator('output')).toHaveText('0123-ABCD-EFGH')
 expect((await context.cookies()).some(c=>c.name==='bs-shop-production-appointment-access'&&c.httpOnly&&c.secure&&c.domain==='alpha-tools.shops.building-suit.com')).toBeTruthy()
 await page.getByRole('link',{name:ar?'مواعيدي والسجل':'My appointments and history',exact:true}).click();await mounted(page);await expect(page.getByRole('heading',{name:'Alpha appointment',exact:true})).toBeVisible();await semantics(page,locale)
 expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},payload:(window as Window&{__NUXT__?:unknown}).__NUXT__}))).not.toMatch(/Guest launch|0123-ABCD-EFGH|PRIVATE|LEAK-/)
 await page.getByRole('button',{name:ar?'إنهاء الوصول':'End access',exact:true}).click();await expect(page.locator('ol > li')).toHaveCount(0)
 await page.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true}).fill('0123ABCDEFGH');await page.getByRole('textbox',{name:ar?'الهاتف المحفوظ للموعد':'Phone saved with the appointment',exact:true}).fill('+201000000002');await page.getByRole('button',{name:ar?'عرض مواعيدي':'View my appointments',exact:true}).click();await expect(page.locator('ol > li')).toHaveCount(1)
 await page.screenshot({path:test.info().outputPath('verified-portal.png'),fullPage:true})
 await page.goto('https://beta-tools.shops.building-suit.com/my-appointments'+suffix);await mounted(page);await expect(page.locator('ol > li')).toHaveCount(0);await expect(page.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Alpha appointment',exact:true})).toHaveCount(0)
 if(width===390&&theme==='light'){
  await request.post(`http://127.0.0.1:${websiteLaunchApiPorts.production}/control`,{data:{slug:'alpha-tools',state:'draft'}})
  const hidden=await page.goto(url+suffix);expect(hidden?.status()).toBe(404);await expect(page.locator('body')).toHaveText('Not Found')
  await request.post(`http://127.0.0.1:${websiteLaunchApiPorts.production}/control`,{data:{slug:'alpha-tools',state:'published'}})
 }
 // Changelog UI uses a synthetic public contract; the real SAS adapter and
 // provider baseline readiness are qualified separately, never bypassed here.
 await context.addCookies([{name:'building-suit-locale',value:locale,url:'https://shop.building-suit.com'}])
 const now=Date.now(),copy={en:'Verified public update',ar:'تحديث عام موثّق'}
 await page.route('https://shop.building-suit.com/api/changelog',r=>r.fulfill({json:{serverNow:new Date(now).toISOString(),suits:[{id:'shop-suit',name:{en:'Shop Suit',ar:'شوب سوت'}}],entries:[{id:'launch-fixture',suit:'shop-suit',visibility:'public',status:'released',version:'2.8.0',publishedAt:new Date(now-3600000).toISOString(),releasedAt:new Date(now-3600000).toISOString(),title:copy,summary:copy,details:copy,links:[]}]}}))
 await page.goto('https://shop.building-suit.com/changelog');await mounted(page);await expect(page.getByText(ar?copy.ar:copy.en,{exact:true}).first()).toBeVisible();await expect(page.locator('main .bs-changelog')).toHaveAttribute('dir',ar?'rtl':'ltr');await semantics(page,locale)
 await page.screenshot({path:test.info().outputPath('public-changelog.png'),fullPage:true})
})
