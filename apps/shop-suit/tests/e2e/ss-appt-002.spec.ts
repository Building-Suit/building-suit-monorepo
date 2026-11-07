import {drainLoopbackRoutes} from '../fixtures/loopback-teardown'
import {expect,test,type Page} from '@playwright/test'
import {expectNoPageOverflow} from '../../../../packages/testing/browser-foundation'
// Drain background loopback prefetches before Playwright disposes responses.
test.afterEach(async({page},info)=>drainLoopbackRoutes(page,info,'https://*.shops.building-suit.com/**'))
async function transport(page:Page){await page.route('https://*.shops.building-suit.com/**',async route=>{const request=route.request(),url=new URL(request.url());const response=await route.fetch({url:'http://127.0.0.1:4337'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0,maxRetries:request.method()==='GET'?1:0});await route.fulfill({response})})}
async function mounted(page:Page){await page.waitForFunction(()=>{const root=document.getElementById('__nuxt') as HTMLElement & {__vue_app__?:{config:{globalProperties:{$nuxt:{isHydrating:boolean}}}}};return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating===false})}
async function choose(page:Page,label:string,index=0){await page.getByRole('combobox',{name:label,exact:true}).click();await page.getByRole('option').nth(index).click();await expect(page.getByRole('listbox')).toHaveCount(0)}
async function times(page:Page,ar=false){await choose(page,ar?'الخدمة والموقع والموظف':'Service, location and staff');await page.getByRole('button',{name:ar?'عرض الأوقات':'Show times',exact:true}).click();await expect(page.getByRole('combobox',{name:ar?'الوقت المتاح':'Available time',exact:true})).toBeVisible();await choose(page,ar?'الوقت المتاح':'Available time')}
test.beforeEach(async({request})=>{await request.post('http://127.0.0.1:46927/control',{data:{}})})
for(const locale of ['en','ar'])for(const width of [390,820,1440])for(const theme of ['light','dark'])test(`public booking ${locale} ${width} ${theme}`,async({page,context})=>{
 const ar=locale==='ar';await page.setViewportSize({width,height:1000});await page.addInitScript(v=>localStorage.setItem('building-suit.theme',v),theme);await transport(page)
 await page.goto(`https://alpha-tools.shops.building-suit.com/${ar?'':'?lang=en'}`);await mounted(page);await page.getByRole('navigation',{name:ar?'تصفح المتجر':'Shop navigation',exact:true}).getByRole('link',{name:ar?'احجز موعدك':'Book an appointment',exact:true}).click();await mounted(page)
 await expect(page.getByRole('heading',{name:ar?'حجز موعد':'Book an appointment',exact:true})).toBeVisible();await expect(page.locator('html')).toHaveAttribute('dir',ar?'rtl':'ltr')
 expect(await page.locator('body').innerText()).not.toContain('PRIVATE');await times(page,ar);await expectNoPageOverflow(page)
 await page.screenshot({path:test.info().outputPath('booking.png'),fullPage:true})
 if(width===390&&theme==='light'){
  await page.getByRole('textbox',{name:ar?'الاسم':'Name',exact:true}).fill('Guest visitor');await page.getByRole('textbox',{name:ar?'رقم الهاتف':'Phone number',exact:true}).fill('+201000000002')
  await page.getByRole('button',{name:ar?'تأكيد الحجز':'Confirm booking',exact:true}).click();await expect(page.getByRole('status').filter({hasText:ar?'تم تأكيد الحجز.':'Booking confirmed.'})).toBeVisible()
  await expect(page.locator('output')).toHaveText('0123-ABCD-EFGH');await expect(page.locator('ol > li')).toHaveCount(1)
  expect((await context.cookies()).some(c=>c.name==='bs-shop-production-appointment-access'&&c.httpOnly&&c.secure)).toBeTruthy()
  expect(await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},payload:(window as Window&{__NUXT__?:unknown}).__NUXT__}))).not.toContain('Guest visitor')
  await page.getByRole('button',{name:ar?'تعديل الموعد':'Reschedule',exact:true}).click();await page.getByRole('button',{name:ar?'عرض الأوقات':'Show times',exact:true}).click();await choose(page,ar?'الوقت المتاح':'Available time',1)
  await page.getByRole('button',{name:ar?'تعديل الموعد':'Reschedule',exact:true}).click();await expect(page.getByRole('status').filter({hasText:ar?'تم تعديل الموعد.':'Appointment rescheduled.'})).toBeVisible()
  await page.getByRole('button',{name:ar?'إلغاء الموعد':'Cancel appointment',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:ar?'إلغاء الموعد':'Cancel appointment',exact:true}).click();await expect(page.getByRole('status').filter({hasText:ar?'تم إلغاء الموعد.':'Appointment cancelled.'})).toBeVisible();await expect(page.locator('ol > li')).toHaveCount(0)
 }
})
test('verified customer creates only within its identity; disabled booking and cross-host private state fail closed',async({page})=>{
 await transport(page);await page.goto('https://alpha-tools.shops.building-suit.com/book?lang=en');await mounted(page)
 await page.getByRole('button',{name:'I have an access code',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('textbox',{name:'Access code',exact:true}).fill('5678ABCDEFGH');await dialog.getByRole('textbox',{name:'Phone number',exact:true}).fill('+201000000002');await dialog.getByRole('button',{name:'I have an access code',exact:true}).click()
 await expect(page.locator('ol > li')).toHaveCount(1);await page.getByRole('button',{name:'New booking',exact:true}).click();await times(page);await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Confirm booking',exact:true}).click();await expect(page.locator('ol > li')).toHaveCount(2)
 await page.goto('https://beta-tools.shops.building-suit.com/book?lang=en');await mounted(page);await expect(page.locator('ol > li')).toHaveCount(0)
 await page.goto('https://disabled-tools.shops.building-suit.com/book?lang=en');await mounted(page);await expect(page.getByText('Online booking is currently unavailable. Contact the shop.',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Confirm booking',exact:true})).toHaveCount(0)
})

test('failed verification retains the public form and supports a safe retry',async({page})=>{
 await transport(page);await page.goto('https://alpha-tools.shops.building-suit.com/book?lang=en');await mounted(page)
 await page.getByRole('button',{name:'I have an access code',exact:true}).click();const dialog=page.getByRole('dialog')
 await dialog.getByRole('textbox',{name:'Access code',exact:true}).fill('BAD');await dialog.getByRole('textbox',{name:'Phone number',exact:true}).fill('+201000000002');await dialog.getByRole('button',{name:'I have an access code',exact:true}).click();await expect(dialog.getByRole('alert')).toBeVisible();await expect(dialog.getByRole('textbox',{name:'Access code',exact:true})).toHaveValue('')
 await dialog.getByRole('textbox',{name:'Access code',exact:true}).fill('5678ABCDEFGH');await dialog.getByRole('textbox',{name:'Phone number',exact:true}).fill('+201000000002');await dialog.getByRole('button',{name:'I have an access code',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.locator('ol > li')).toHaveCount(1)
})
test('a suspended in-flight guest booking cannot reveal its late code or history; returning busy revalidates',async({page})=>{
 await page.addInitScript(()=>{window.AbortController=class extends AbortController{override abort(){}}})
 let release=()=>{},started=()=>{};const arrived=new Promise<void>(r=>{started=r}),gate=new Promise<void>(r=>{release=r});let held=false,optionsReads=0
 await page.route('https://*.shops.building-suit.com/**',async route=>{const request=route.request(),url=new URL(request.url());const response=await route.fetch({url:'http://127.0.0.1:4337'+url.pathname+url.search,headers:{...request.headers(),host:url.host},maxRedirects:0,maxRetries:request.method()==='GET'?1:0});if(url.pathname==='/api/website/booking/options')optionsReads++;if(url.pathname==='/api/website/booking/command'&&!held){held=true;started();await gate}await route.fulfill({response})})
 await page.goto('https://beta-tools.shops.building-suit.com/book?lang=en');await mounted(page);await times(page);await page.getByRole('textbox',{name:'Name',exact:true}).fill('Private delayed visitor');await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('+201000000002');await page.getByRole('button',{name:'Confirm booking',exact:true}).click();await arrived
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await expect(page.locator('output')).toHaveCount(0);await expect(page.locator('ol > li')).toHaveCount(0)
 const reads=optionsReads;await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});release()
 await expect(page.locator('ol > li')).toHaveCount(1);expect(optionsReads).toBe(reads+1);await expect(page.locator('output')).toHaveCount(0);expect(await page.locator('body').innerText()).not.toContain('Private delayed visitor')
})

for(const locale of ['en','ar'])test(`verified customer explicitly opts in and out of one private reminder ${locale}`,async({page})=>{
 const ar=locale==='ar';await page.setViewportSize({width:ar?390:1440,height:1000});await transport(page);await page.goto(`https://alpha-tools.shops.building-suit.com/book${ar?'':'?lang=en'}`);await mounted(page)
 const verify=ar?'لدي رمز وصول':'I have an access code';await page.getByRole('button',{name:verify,exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('textbox',{name:ar?'رمز الوصول':'Access code',exact:true}).fill('5678ABCDEFGH');await dialog.getByRole('textbox',{name:ar?'رقم الهاتف':'Phone number',exact:true}).fill('+201000000002');await dialog.getByRole('button',{name:verify,exact:true}).click()
 const on=page.getByRole('button',{name:ar?'أوافق على تذكير بالبريد':'Request email reminder',exact:true}),off=page.getByRole('button',{name:ar?'إيقاف تذكير البريد':'Stop email reminder',exact:true})
 await expect(on).toHaveCount(1);await expect(off).toHaveCount(0);await on.click();await expect(off).toHaveCount(1);await expect(off).toHaveAttribute('aria-pressed','true');await expectNoPageOverflow(page)
 expect(await page.locator('body').innerText()).not.toContain('@example');await off.click();await expect(on).toHaveCount(1);await expect(on).toHaveAttribute('aria-pressed','false')
})
